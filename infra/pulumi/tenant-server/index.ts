// Tenant con Pulumi: firewall + una VM con disco cifrado, todo con la etiqueta tenant_id.
// Mismo contrato de entrada y salida que el modulo de OpenTofu (ver contrato/).

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();
const tenantId = config.require("tenantId");
const instanceType = config.get("instanceType") ?? "t3.micro";
const dbVolumeGb = config.getNumber("dbVolumeGb") ?? 10;
const amiId = config.get("amiId") ?? ""; // AMI de Packer (Integrante 3). Vacio = Ubuntu 24.04.
const adminPassword = config.getSecret("adminPassword") ?? pulumi.secret(""); // vacio = la VM genera una
const seedData = config.getBoolean("seedData") ?? false;
// IP de Prometheus (ej. 3.80.10.20/32): abre 9100, 9104 y 3000 solo a esa IP. Vacio = cerrados.
const monitoringCidr = config.get("monitoringCidr") ?? "";
if (monitoringCidr !== "" && (monitoringCidr === "0.0.0.0/0" || !/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(monitoringCidr))) {
    throw new Error("monitoringCidr debe ser un rango valido (ej. 3.80.10.20/32) y nunca 0.0.0.0/0");
}
const metricas: Record<number, string> = {
    9100: "Metricas del servidor (node_exporter)",
    9104: "Metricas de MySQL (mysqld_exporter)",
    3000: "Metricas de la app (contador)",
};
const versionPlantilla = "0.3.0";

if (!/^[a-z0-9-]{3,30}$/.test(tenantId)) {
    throw new Error("tenantId debe tener de 3 a 30 caracteres: minusculas, numeros y guiones");
}

// Todo recurso lleva la etiqueta tenant_id (costos, aislamiento y limpieza).
const tags = { tenant_id: tenantId, proyecto: "plataforma-tenants", gestionado_por: "pulumi" };

// Ubuntu 24.04 de Canonical, solo se usa si no se indica una AMI propia.
const ami: pulumi.Input<string> = amiId !== ""
    ? amiId
    : aws.ec2.getAmiOutput({
        mostRecent: true,
        owners: ["099720109477"],
        filters: [{ name: "name", values: ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"] }],
    }).id;

const firewall = new aws.ec2.SecurityGroup("tenant", {
    namePrefix: `tenant-${tenantId}-`,
    description: `Firewall del tenant ${tenantId}`,
    ingress: [
        {
            description: "Web (nginx de la app)",
            protocol: "tcp",
            fromPort: 80,
            toPort: 80,
            cidrBlocks: ["0.0.0.0/0"],
        },
        // Metricas para Prometheus: solo desde monitoringCidr. Vacio = puertos cerrados.
        ...(monitoringCidr === "" ? [] : Object.entries(metricas).map(([puerto, description]) => ({
            description,
            protocol: "tcp",
            fromPort: Number(puerto),
            toPort: Number(puerto),
            cidrBlocks: [monitoringCidr],
        }))),
    ],
    egress: [{
        description: "Salida a internet (paquetes y actualizaciones)",
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
    }],
    tags,
});

// Primer arranque: cloud-init escribe la configuracion de este tenant.
const userData = pulumi.interpolate`#!/bin/bash
# Primer arranque de la VM del tenant ${tenantId}.
set -e
mkdir -p /etc/tenant
cat > /etc/tenant/tenant.env <<ENV
TENANT_ID=${tenantId}
DB_VOLUME_GB=${dbVolumeGb}
ADMIN_PASSWORD=${adminPassword}
SEED_DATA=${seedData}
ENV
chmod 600 /etc/tenant/tenant.env
if ! command -v nginx >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y nginx
fi
echo "Tenant ${tenantId} funcionando" > /var/www/html/index.html
systemctl enable --now nginx
`;

const vm = new aws.ec2.Instance("tenant", {
    ami,
    instanceType,
    vpcSecurityGroupIds: [firewall.id],
    rootBlockDevice: { volumeType: "gp3", volumeSize: 8 + dbVolumeGb, encrypted: true },
    metadataOptions: { httpTokens: "required", httpEndpoint: "enabled" }, // IMDSv2 obligatorio
    userData,
    userDataReplaceOnChange: true,
    volumeTags: tags,
    tags: { ...tags, Name: `tenant-${tenantId}` },
});

// Mismo contrato de salida que el modulo de OpenTofu.
export const tenant_id = tenantId;
export const instance_id = vm.id;
export const public_ip = vm.publicIp;
export const url = pulumi.interpolate`http://${vm.publicIp}`;
export const version_plantilla = versionPlantilla;
