// Worker: toma operaciones 'pendiente' de la tabla operations y las ejecuta una por una.
// ENGINE=fake  -> todo simulado, no toca AWS.
// ENGINE=tofu  -> crea VMs reales; usa el motor que eligio cada tenant (campo motor):
//                 opentofu, pulumi o cloudformation. ("real" es un nombre equivalente a "tofu".)

require('dotenv').config();
const pool = require('./db');

const nombreMotor = process.env.ENGINE || 'fake';
if (!['fake', 'tofu', 'real'].includes(nombreMotor)) {
  console.error(`ENGINE invalido: ${nombreMotor}. Usa fake o tofu.`);
  process.exit(1);
}
const simulado = nombreMotor === 'fake';

const ARCHIVO_MOTOR = { opentofu: 'tofu', pulumi: 'pulumi', cloudformation: 'cloudformation' };

// Motor que crea y borra la infraestructura de este tenant.
function motorDe(tenant) {
  if (simulado) return require('./motor-fake');
  const archivo = ARCHIVO_MOTOR[tenant.motor];
  if (!archivo) throw new Error(`Motor desconocido: ${tenant.motor}`);
  try {
    return require(`./motor-${archivo}`);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') throw new Error(`El motor ${tenant.motor} aun no esta instalado en la API`);
    throw error;
  }
}

// Suspender/reanudar: el motor falso lo simula; con AWS real se usa el AWS CLI (ec2-energia.js).
const energia = simulado ? require('./motor-fake') : require('./ec2-energia');
const { sincronizarTargets } = require('./sync-targets');

// Toma UNA operacion pendiente. SKIP LOCKED evita que dos workers tomen la misma.
async function tomarOperacion() {
  const { rows } = await pool.query(
    `UPDATE operations
        SET estado = 'en_curso', iniciada_en = now(), terminada_en = NULL, error = NULL,
            intentos = intentos + 1
      WHERE id = (SELECT id FROM operations
                   WHERE estado = 'pendiente'
                   ORDER BY creada_en
                   FOR UPDATE SKIP LOCKED
                   LIMIT 1)
      RETURNING *`
  );
  return rows[0];
}

async function procesar(operacion) {
  const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [operacion.tenant_id]);
  const tenant = rows[0];

  // Cada linea del motor se guarda en operations.log, en orden.
  let cola = Promise.resolve();
  const onLog = (linea) => {
    cola = cola
      .then(() => pool.query('UPDATE operations SET log = log || $2 WHERE id = $1', [operacion.id, `${linea}\n`]))
      .catch(() => {});
  };

  const entrada = { tenant_id: tenant.id, plan: tenant.plan_id, region: tenant.region, instance_id: tenant.instance_id };

  try {
    if (operacion.tipo === 'crear') {
      await pool.query(`UPDATE tenants SET estado = 'aprovisionando', actualizado_en = now() WHERE id = $1`, [tenant.id]);
      const salida = await motorDe(tenant).apply(entrada, onLog);
      await cola;
      await pool.query(
        `UPDATE tenants SET estado = 'activo', instance_id = $2, public_ip = $3, url = $4, actualizado_en = now()
          WHERE id = $1`,
        [tenant.id, salida.instance_id, salida.public_ip, salida.url]
      );
      await pool.query(
        `INSERT INTO deployments (tenant_id, operation_id, version_app, version_plantilla, motor, version_motor)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenant.id, operacion.id, salida.versiones.app, salida.versiones.plantilla, tenant.motor, salida.versiones.motor]
      );
    } else if (operacion.tipo === 'eliminar') {
      await motorDe(tenant).destroy(entrada, onLog);
      await cola;
      await pool.query(
        `UPDATE tenants SET estado = 'eliminado', instance_id = NULL, public_ip = NULL, url = NULL,
                actualizado_en = now() WHERE id = $1`,
        [tenant.id]
      );
    } else if (operacion.tipo === 'suspender') {
      await energia.suspender(entrada, onLog);
      await cola;
      await pool.query(`UPDATE tenants SET estado = 'suspendido', actualizado_en = now() WHERE id = $1`, [tenant.id]);
    } else if (operacion.tipo === 'reanudar') {
      const salida = await energia.reanudar(entrada, onLog);
      await cola;
      await pool.query(
        `UPDATE tenants SET estado = 'activo', public_ip = $2, url = $3, actualizado_en = now() WHERE id = $1`,
        [tenant.id, salida.public_ip, salida.url]
      );
    } else {
      throw new Error(`Operacion aun no implementada: ${operacion.tipo}`);
    }

    await pool.query(`UPDATE operations SET estado = 'completada', terminada_en = now() WHERE id = $1`, [operacion.id]);
    // Sincroniza Prometheus file_sd despues de cualquier cambio de estado (crear, suspender, reanudar, eliminar)
    await sincronizarTargets().catch((e) => console.error('Error al actualizar targets de monitoreo:', e.message));
  } catch (error) {
    await cola;
    await pool.query(`UPDATE tenants SET estado = 'fallido', actualizado_en = now() WHERE id = $1`, [tenant.id]);
    await pool.query(
      `UPDATE operations SET estado = 'fallida', error = $2, terminada_en = now() WHERE id = $1`,
      [operacion.id, error.message]
    );
  }
}

async function ciclo() {
  try {
    const operacion = await tomarOperacion();
    if (operacion) {
      console.log(`Operacion ${operacion.id}: ${operacion.tipo} ${operacion.tenant_id}`);
      await procesar(operacion);
      console.log(`Operacion ${operacion.id} terminada`);
      return setImmediate(ciclo);
    }
    setTimeout(ciclo, 2000);
  } catch (error) {
    console.error('Error del worker:', error.message);
    setTimeout(ciclo, 5000);
  }
}

console.log(`Worker listo (motor: ${nombreMotor})`);
ciclo();
