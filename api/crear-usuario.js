// Crea o cambia la clave de un usuario de la consola.
// Uso:
//   node crear-usuario.js <usuario> <clave> admin_plataforma
//   node crear-usuario.js <usuario> <clave> admin_tenant <tenant_id>
// La clave se guarda cifrada; nunca se escribe en el codigo.

const pool = require('./db');
const { cifrarClave } = require('./auth');

async function main() {
  const [usuario, clave, rol, tenantId] = process.argv.slice(2);
  const roles = ['admin_plataforma', 'admin_tenant'];

  if (!usuario || !clave || !roles.includes(rol) || (rol === 'admin_tenant' && !tenantId)) {
    console.error('Uso: node crear-usuario.js <usuario> <clave> admin_plataforma');
    console.error('     node crear-usuario.js <usuario> <clave> admin_tenant <tenant_id>');
    process.exit(1);
  }
  if (clave.length < 8) {
    console.error('La clave debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  await pool.query(
    `INSERT INTO users (usuario, clave_hash, rol, tenant_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT (usuario) DO UPDATE SET clave_hash = EXCLUDED.clave_hash, rol = EXCLUDED.rol, tenant_id = EXCLUDED.tenant_id`,
    [usuario, cifrarClave(clave), rol, rol === 'admin_tenant' ? tenantId : null]
  );
  console.log(`Usuario "${usuario}" guardado con rol ${rol}${tenantId && rol === 'admin_tenant' ? ` (tenant ${tenantId})` : ''}.`);
}

main()
  .catch((error) => {
    const mensaje = error.code === '23503' ? 'Ese tenant no existe.' : error.message;
    console.error(`No se pudo guardar el usuario: ${mensaje}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
