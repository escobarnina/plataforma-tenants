# Modulo tenant-server (OpenTofu)

Crea la infraestructura de UN tenant: firewall + una VM con disco cifrado, todo etiquetado con `tenant_id`.
Un solo modulo para los tres planes; el plan cambia solo las variables.

| Plan | instance_type | db_volume_gb |
| --- | --- | --- |
| basico | t3.micro | 10 |
| estandar | t3.small | 50 |
| avanzado | c7i-flex.large | 200 |

## Probar a mano
```
tofu init
tofu apply -var tenant_id=prueba-i4 -var instance_type=t3.micro -var db_volume_gb=10
tofu output
tofu destroy -var tenant_id=prueba-i4 -var instance_type=t3.micro -var db_volume_gb=10
```
Con `-var ami_id=ami-...` usa la imagen de Packer; sin ella, una Ubuntu 24.04 con una pagina de prueba.

## Notas
- Un state por tenant (la plataforma lo guarda en `workdir/<tenant_id>`).
- Sin SSH abierto por defecto; para abrirlo: `-var ssh_cidr=TU.IP.PUBLICA/32`.
- Salidas: `tenant_id`, `instance_id`, `public_ip`, `url`, `version_plantilla`.
