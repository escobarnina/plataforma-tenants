// Datos de arranque del administrador de cada tenant, comunes a los tres motores.
// ADMIN_PASSWORD_INICIAL y SEED_DATA vienen del .env de la API. Si la clave queda vacia, la VM genera una
// y la guarda en /etc/tenant/credenciales (ver ansible/roles/firstboot/files/tenant-configure).

// Misma regla que valida tenant-configure en la VM: sin espacios, comillas ni "$".
const CLAVE_VALIDA = /^[A-Za-z0-9._@%+=-]{8,64}$/;

function datosAdmin() {
  const clave = process.env.ADMIN_PASSWORD_INICIAL || '';
  if (clave !== '' && !CLAVE_VALIDA.test(clave)) {
    throw new Error('ADMIN_PASSWORD_INICIAL invalida: 8 a 64 caracteres, solo letras, numeros y . _ @ % + = -');
  }
  return { adminPassword: clave, seedData: process.env.SEED_DATA === 'true' };
}

<<<<<<< Updated upstream
module.exports = { datosAdmin };
=======
const { execSync } = require('child_process');

// IP de Prometheus para abrir los puertos de metricas (9100, 9104, 3000) solo a ella.
// Si no esta en el .env, intenta autodetectar la IP publica de esta maquina para que nunca quede cerrado.
function cidrMonitoreo() {
  let cidr = (process.env.MONITORING_CIDR || '').trim();
  if (!cidr) {
    try {
      const ip = execSync('curl.exe -k -s https://ifconfig.me', { timeout: 3000 }).toString().trim();
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
        cidr = `${ip}/32`;
      }
    } catch {}
  }
  if (!cidr) return '';
  if (cidr === '0.0.0.0/0' || !/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(cidr)) {
    throw new Error('MONITORING_CIDR invalido: usa la IP de Prometheus con /32 (ej. 3.80.10.20/32), nunca 0.0.0.0/0');
  }
  return cidr;
}

module.exports = { datosAdmin, cidrMonitoreo };
>>>>>>> Stashed changes
