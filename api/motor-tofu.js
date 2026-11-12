// Motor real: ejecuta OpenTofu con el main.tf de esta carpeta.
// Cada tenant tiene su propia carpeta de trabajo (workdir/<tenant_id>) y por lo tanto su propio state.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PLAN_A_INSTANCIA = {
  basico: 't3.micro',
  estandar: 't3.small',
  avanzado: 'c7i-flex.large',
};

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

function prepararCarpeta(tenantId) {
  const dir = path.join(__dirname, 'workdir', tenantId);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'main.tf'), path.join(dir, 'main.tf'));
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
  return [
    '-var', `tenant_id=${tenant.tenant_id}`,
    '-var', `instance_type=${PLAN_A_INSTANCIA[tenant.plan]}`,
    '-var', `region=${tenant.region || 'us-east-1'}`,
  ];
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
    versiones: { app: '1.0.0', plantilla: '0.1.0', motor: 'opentofu' },
  };
}

async function destroy(tenant, onLog = () => {}) {
  validar(tenant);
  const dir = prepararCarpeta(tenant.tenant_id);
  await ejecutar('tofu', ['init', '-input=false', '-no-color'], dir, onLog);
  await ejecutar('tofu', ['destroy', '-auto-approve', '-input=false', '-no-color', ...variables(tenant)], dir, onLog);
}

module.exports = { apply, destroy };
