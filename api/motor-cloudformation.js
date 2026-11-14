// Motor CloudFormation: crea y borra un tenant con la plantilla infra/cloudformation/tenant-server.yaml.
// Un stack por tenant (tenant-<id>). Mismo contrato de entrada y salida que los otros motores.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { datosAdmin } = require('./tenant-admin');

const PLAN_A_INSTANCIA = { basico: 't3.micro', estandar: 't3.small', avanzado: 'c7i-flex.large' };
const PLAN_A_DB_GB = { basico: 10, estandar: 50, avanzado: 200 };

const PLANTILLA = process.env.CFN_TEMPLATE
  ? path.resolve(process.env.CFN_TEMPLATE)
  : path.join(__dirname, '..', 'infra', 'cloudformation', 'tenant-server.yaml');

function validar(tenant) {
  if (!/^[a-z0-9-]{3,30}$/.test(tenant.tenant_id)) {
    throw new Error('tenant_id invalido: solo minusculas, numeros y guiones (3 a 30 caracteres)');
  }
  if (!PLAN_A_INSTANCIA[tenant.plan]) throw new Error(`plan desconocido: ${tenant.plan}`);
  if (!fs.existsSync(PLANTILLA)) throw new Error(`No se encontro la plantilla en ${PLANTILLA}`);
}

function ocultarSecretos(texto) {
  return texto.replace(/AKIA[0-9A-Z]{16}/g, '***').replace(/ASIA[0-9A-Z]{16}/g, '***');
}

// Ejecuta aws, manda cada linea al log y falla si el codigo de salida no es 0.
function aws(args, onLog, soloStdout = false) {
  return new Promise((resolve, reject) => {
    const proceso = spawn('aws', args, { shell: false });
    let salida = '';
    const recibir = (esStdout) => (datos) => {
      const texto = ocultarSecretos(datos.toString());
      if (esStdout) salida += texto;
      if (!soloStdout) texto.split('\n').filter(Boolean).forEach(onLog);
    };
    proceso.stdout.on('data', recibir(true));
    proceso.stderr.on('data', recibir(false));
    proceso.on('error', (e) => reject(new Error(`No se pudo ejecutar aws: ${e.message}`)));
    proceso.on('close', (codigo) => {
      if (codigo === 0) resolve(salida.trim());
      else reject(new Error(`aws ${args.slice(0, 2).join(' ')} termino con codigo ${codigo}`));
    });
  });
}

const nombreStack = (tenant) => `tenant-${tenant.tenant_id}`;
const region = (tenant) => tenant.region || 'us-east-1';

async function apply(tenant, onLog = () => {}) {
  validar(tenant);
  const db = PLAN_A_DB_GB[tenant.plan];
  const { adminPassword, seedData } = datosAdmin();
  const parametros = [
    `TenantId=${tenant.tenant_id}`,
    `InstanceType=${PLAN_A_INSTANCIA[tenant.plan]}`,
    `DbVolumeGb=${db}`,
    `RootVolumeGb=${8 + db}`,
    `SeedData=${seedData}`,
  ];
  if (adminPassword) parametros.push(`AdminPassword=${adminPassword}`);
  if (/^ami-[0-9a-f]{8,17}$/.test(process.env.AMI_ID || '')) parametros.push(`AmiId=${process.env.AMI_ID}`);

  onLog(`[cloudformation] desplegando stack ${nombreStack(tenant)}...`);
  await aws(
    [
      'cloudformation', 'deploy',
      '--stack-name', nombreStack(tenant),
      '--template-file', PLANTILLA,
      '--parameter-overrides', ...parametros,
      '--tags', `tenant_id=${tenant.tenant_id}`, 'proyecto=plataforma-tenants',
      '--no-fail-on-empty-changeset',
      '--region', region(tenant),
    ],
    onLog
  );

  const crudo = await aws(
    ['cloudformation', 'describe-stacks', '--stack-name', nombreStack(tenant),
      '--query', 'Stacks[0].Outputs', '--output', 'json', '--region', region(tenant)],
    onLog,
    true
  );
  const salida = {};
  for (const o of JSON.parse(crudo)) salida[o.OutputKey] = o.OutputValue;

  return {
    tenant_id: salida.TenantId,
    instance_id: salida.InstanceId,
    public_ip: salida.PublicIp,
    url: salida.Url,
    versiones: {
      app: process.env.APP_VERSION || '1.0.0',
      plantilla: salida.VersionPlantilla || '0.0.0',
      motor: 'cloudformation',
    },
  };
}

async function destroy(tenant, onLog = () => {}) {
  validar(tenant);
  onLog(`[cloudformation] eliminando stack ${nombreStack(tenant)}...`);
  await aws(['cloudformation', 'delete-stack', '--stack-name', nombreStack(tenant), '--region', region(tenant)], onLog);
  await aws(['cloudformation', 'wait', 'stack-delete-complete', '--stack-name', nombreStack(tenant), '--region', region(tenant)], onLog);
  onLog('[cloudformation] stack eliminado');
}

module.exports = { apply, destroy };
