// Crea el administrador del tenant (idempotente) SIN cargar datos de ejemplo.
// Lo ejecuta tenant-configure cuando SEED_DATA no es "true".
// Usa los modelos de la app y las variables ADMIN_EMAIL / ADMIN_PASSWORD de /opt/asistencia/.env.
const base = '/opt/asistencia/backend/src';
const { sequelize, Usuario } = require(`${base}/models`);
const { hashPassword } = require(`${base}/core/security`);
const env = require(`${base}/config/env`);

(async () => {
  try {
    await sequelize.authenticate();
    const [admin, creado] = await Usuario.findOrCreate({
      where: { email: env.admin.email },
      defaults: {
        nombre: 'Administrador',
        email: env.admin.email,
        rol: 'ADMIN',
        password_hash: await hashPassword(env.admin.password),
        activo: true,
      },
    });
    console.log(`Administrador ${creado ? 'creado' : 'ya existia'}: ${admin.email}`);
    await sequelize.close();
  } catch (error) {
    console.error('No se pudo crear el administrador:', error.message);
    process.exit(1);
  }
})();
