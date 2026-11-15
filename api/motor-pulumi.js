// Motor Pulumi: crea y borra un tenant con el proyecto infra/pulumi/tenant-server (TypeScript).
// Un stack por tenant (tenant-<id>). El estado se guarda en local: workdir/pulumi-state.
// Mismo contrato de entrada y salida que los otros motores.
// Requisitos: Pulumi CLI instalado y "npm install" hecho una vez en la carpeta del proyecto.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { datosAdmin } = require('./tenant-admin');

const PLAN_A_INSTANCIA = { basico: 't3.micro', estandar: 't3.small', avanzado: 'c7i-flex.large' };
const PLAN_A_DB_GB = { basico: 10, estandar: 50, avanzado: 200 };

const PROYECTO = process.env.PULUMI_PROJECT_DIR
  ? path.resolve(process.env.PULUMI_PROJECT_DIR)
  : path.join(__dirname, '..', 'infra', 'pulumi', 'tenant-server');
const ESTADO = path.join(__dirname, 'workdir', 'pulumi-state');

function validar(tenant) {
  if (!/^[a-z0-9-]{3,30}$/.test(tenant.tenant_id)) {
    throw new Error('tenant_id invalido: solo minusculas, numeros y guiones (3 a 30 caracteres)');
  }
  if (!PLAN_A_INSTANCIA[tenant.plan]) throw new Error(`plan desconocido: ${tenant.plan}`);
  if (!fs.existsSync(path.join(PROYECTO, 'Pulumi.yaml'))) {
    throw new Error(`No se encontro el proyecto de Pulumi en ${PROYECTO}`);
  }
  if (!fs.existsSync(path.join(PROYECTO, 'node_modules'))) {
    throw new Error('Falta ejecutar "npm install" en la carpeta del proyecto de Pulumi');
  }
}

function ocultarSecretos(texto) {
  return texto.replace(/AKIA[0-9A-Z]{16}/g, '***').replace(/ASIA[0-9A-Z]{16}/g, '***');
}

// Ejecuta pulumi, manda cada linea al log y falla si el codigo de salida no es 0.
function pulumi(args, onLog, soloStdout = false) {
  fs.mkdirSync(ESTADO, { recursive: true });
  const env = {
    ...process.env,
    PULUMI_BACKEND_URL: `file://${ESTADO.replace(/\\/g, '/')}`,
    PULUMI_CONFIG_PASSPHRASE: process.env.PULUMI_CONFIG_PASSPHRASE ?? 'plataforma',
    PULUMI_SKIP_UPDATE_CHECK: 'true',
  };
  return new Promise((resolve, reject) => {
    const proceso = spawn('pulumi', [...args, '--non-interactive'], { cwd: PROYECTO, env, shell: false });
    let salida = '';
    const recibir = (esStdout) => (datos) => {
      const texto = ocultarSecretos(datos.toString());
      if (esStdout) salida += texto;
      if (!soloStdout) texto.split('\n').filter(Boolean).forEach(onLog);
    };
    proceso.stdout.on('data', recibir(true));
    proceso.stderr.on('data', recibir(false));
    proceso.on('error', (e) => reject(new Error(`No se pudo ejecutar pulumi: ${e.message}`)));
    proceso.on('close', (codigo) => {
      if (codigo === 0) resolve(salida.trim());
      else reject(new Error(`pulumi ${args[0]} termino con codigo ${codigo}`));
    });
  });
}

const stack = (tenant) => `tenant-${tenant.tenant_id}`;

async function apply(tenant, onLog = () => {}) {
  validar(tenant);
  const s = stack(tenant);
  const config = (clave, valor) => pulumi(['config', 'set', clave, String(valor), '--stack', s], onLog);
  const { adminPassword, seedData } = datosAdmin();

  onLog(`[pulumi] preparando stack ${s}...`);
  await pulumi(['stack', 'select', s, '--create'], onLog);
  await config('tenantId', tenant.tenant_id);
  await config('instanceType', PLAN_A_INSTANCIA[tenant.plan]);
  await config('dbVolumeGb', PLAN_A_DB_GB[tenant.plan]);
  await config('aws:region', tenant.region || 'us-east-1');
  if (/^ami-[0-9a-f]{8,17}$/.test(process.env.AMI_ID || '')) await config('amiId', process.env.AMI_ID);
  await config('seedData', seedData);
  // La clave se guarda como secreto cifrado en la config del stack.
  if (adminPassword) await pulumi(['config', 'set', '--secret', 'adminPassword', adminPassword, '--stack', s], onLog);

  onLog('[pulumi] desplegando...');
  await pulumi(['up', '--yes', '--skip-preview', '--stack', s], onLog);

  const salida = JSON.parse(await pulumi(['stack', 'output', '--json', '--stack', s], onLog, true));
  return {
    tenant_id: salida.tenant_id,
    instance_id: salida.instance_id,
    public_ip: salida.public_ip,
    url: salida.url,
    versiones: {
      app: process.env.APP_VERSION || '1.0.0',
      plantilla: salida.version_plantilla || '0.0.0',
      motor: 'pulumi',
    },
  };
}

async function destroy(tenant, onLog = () => {}) {
  validar(tenant);
  const s = stack(tenant);
  onLog(`[pulumi] eliminando stack ${s}...`);
  await pulumi(['destroy', '--yes', '--skip-preview', '--stack', s], onLog);
  await pulumi(['stack', 'rm', s, '--yes'], onLog);
  onLog('[pulumi] stack eliminado');
}

module.exports = { apply, destroy };
