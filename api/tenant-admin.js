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

module.exports = { datosAdmin };
