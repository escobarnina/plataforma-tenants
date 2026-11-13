// Motor real: ejecuta OpenTofu con el modulo tenant-server (infra/tofu/tenant-server, Integrante 4).
// Cada tenant tiene su propia carpeta de trabajo (workdir/<tenant_id>) y por lo tanto su propio state.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PLAN_A_INSTANCIA = {
  basico: 't3.micro',
  estandar: 't3.small',
  avanzado: 'c7i-flex.large',
};

// Espacio para la base de datos de cada plan (GB). Mismo valor que la tabla plans.
const PLAN_A_DB_GB = { basico: 10, estandar: 50, avanzado: 200 };

// Carpeta del modulo de OpenTofu. Se puede cambiar con TOFU_MODULE_DIR en el .env.
const MODULO = process.env.TOFU_MODULE_DIR
  ? path.resolve(process.env.TOFU_MODULE_DIR)
  : path.join(__dirname, '..', 'infra', 'tofu', 'tenant-server');

// Evita que se cuelen caracteres raros en los comandos.
function validar(tenant) {
  if (!/^[a-z0-9-]{3,30}$/.test(tenant.tenant_id)) {
    throw new Error('tenant_id invalido: solo minusculas, numeros y guiones (3 a 30 caracteres)');
  }
  if (!PLAN_A_INSTANCIA[tenant.plan]) {
    throw new Error(`plan desconocido: ${tenant.plan}`);
  }
}

// Nunca mostrar claves en los logs (requisito de seguridad del proyecto).
function ocultarSecretos(texto) {
  return texto.replace(/AKIA[0-9A-Z]{16}/g, '***').replace(/ASIA[0-9A-Z]{16}/g, '***');
}

// Copia al directorio del tenant solo el codigo del modulo (.tf, .tftpl y el lock),
// nunca .terraform ni el state: cada tenant conserva el suyo en workdir/<tenant_id>.
function prepararCarpeta(tenantId) {
  if (!fs.existsSync(path.join(MODULO, 'main.tf'))) {
    throw new Error(`No se encontro el modulo de OpenTofu en ${MODULO}`);
  }
  const dir = path.join(__dirname, 'workdir', tenantId);
  fs.mkdirSync(dir, { recursive: true });
  for (const archivo of fs.readdirSync(MODULO)) {
    if (/\.(tf|tftpl)$/.test(archivo) || archivo === '.terraform.lock.hcl') {
      fs.copyFileSync(path.join(MODULO, archivo), path.join(dir, archivo));
    }
  }
  return dir;
}

// Ejecuta un comando, manda cada linea al log y falla si el codigo de salida no es 0.
function ejecutar(comando, args, cwd, onLog, soloStdout = false) {
  return new Promise((resolve, reject) => {
    const proceso = spawn(comando, args, { cwd });
    let salida = '';
    const recibir = (esStdout) => (datos) => {
      const texto = ocultarSecretos(datos.toString());
      if (esStdout) salida += texto;
      if (!soloStdout) texto.split('\n').filter(Boolean).forEach(onLog);
    };
    proceso.stdout.on('data', recibir(true));
    proceso.stderr.on('data', recibir(false));
    proceso.on('error', reject);
    proceso.on('close', (codigo) => {
      if (codigo === 0) resolve(salida);
      else reject(new Error(`${comando} ${args[0]} termino con codigo ${codigo}`));
    });
  });
}

function variables(tenant) {
  const lista = [
    '-var', `tenant_id=${tenant.tenant_id}`,
    '-var', `instance_type=${PLAN_A_INSTANCIA[tenant.plan]}`,
    '-var', `db_volume_gb=${PLAN_A_DB_GB[tenant.plan]}`,
    '-var', `region=${tenant.region || 'us-east-1'}`,
  ];
  // Cuando el Integrante 3 entregue la AMI de Packer: AMI_ID=ami-... en el .env.
  if (/^ami-[0-9a-f]{8,17}$/.test(process.env.AMI_ID || '')) {
    lista.push('-var', `ami_id=${process.env.AMI_ID}`);
  }
  return lista;
}

async function apply(tenant, onLog = () => {}) {
  validar(tenant);
  const dir = prepararCarpeta(tenant.tenant_id);

  await ejecutar('tofu', ['init', '-input=false', '-no-color'], dir, onLog);
  await ejecutar('tofu', ['apply', '-auto-approve', '-input=false', '-no-color', ...variables(tenant)], dir, onLog);

  const crudo = await ejecutar('tofu', ['output', '-json'], dir, onLog, true);
  const salida = JSON.parse(crudo);

  return {
    tenant_id: salida.tenant_id.value,
    instance_id: salida.instance_id.value,
    public_ip: salida.public_ip.value,
    url: salida.url.value,
    versiones: {
      app: process.env.APP_VERSION || '1.0.0',
      plantilla: salida.version_plantilla ? salida.version_plantilla.value : '0.0.0',
      motor: 'opentofu',
    },
  };
}

async function destroy(tenant, onLog = () => {}) {
  validar(tenant);
  const dir = prepararCarpeta(tenant.tenant_id);
  await ejecutar('tofu', ['init', '-input=false', '-no-color'], dir, onLog);
  await ejecutar('tofu', ['destroy', '-auto-approve', '-input=false', '-no-color', ...variables(tenant)], dir, onLog);
}

module.exports = { apply, destroy };
