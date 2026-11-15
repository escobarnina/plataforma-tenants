// Sincronizador de targets para Prometheus file_sd.
// Lee los tenants activos desde la BD de la plataforma y genera el archivo targets.json
// que Prometheus lee automaticamente mediante file_sd_configs.

const fs = require('fs');
const path = require('path');
const pool = require('./db');

const TARGETS_FILE = process.env.PROMETHEUS_TARGETS_FILE || path.join(__dirname, '../observabilidad/prometheus/targets/tenants.json');

// Mapeo de puertos segun el contrato acordado:
// - 3000: App Node/Express (/metrics via prom-client, /health)
// - 9100: node_exporter (CPU, Memoria, Disco, Red)
// - 9104: mysqld_exporter (Conexiones, Queries/seg, Estado BD)
const PUERTOS = {
  node: 9100,
  app: 3000,
  mysql: 9104,
};

async function sincronizarTargets() {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, public_ip, entorno, plan_id, motor
       FROM tenants
       WHERE estado IN ('activo', 'aprovisionando') AND public_ip IS NOT NULL AND public_ip != ''`
    );

    const targets = [];

    for (const t of rows) {
      // 1. Objetivo node_exporter (recursos del sistema)
      targets.push({
        targets: [`${t.public_ip}:${PUERTOS.node}`],
        labels: {
          job: 'node',
          tenant_id: t.id,
          entorno: t.entorno,
          plan: t.plan_id,
          instance_type: t.plan_id === 'basico' ? 't3.micro' : (t.plan_id === 'estandar' ? 't3.small' : 'c7i-flex.large'),
        },
      });

      // 2. Objetivo app (metricas de Node.js / Express con prom-client)
      targets.push({
        targets: [`${t.public_ip}:${PUERTOS.app}`],
        labels: {
          job: 'app',
          tenant_id: t.id,
          entorno: t.entorno,
          plan: t.plan_id,
        },
      });

      // 3. Objetivo mysqld_exporter (base de datos del tenant)
      targets.push({
        targets: [`${t.public_ip}:${PUERTOS.mysql}`],
        labels: {
          job: 'mysql',
          tenant_id: t.id,
          entorno: t.entorno,
          plan: t.plan_id,
        },
      });
    }

    const dir = path.dirname(TARGETS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Escritura atomica para evitar que Prometheus lea un JSON a medio escribir
    const tmpFile = `${TARGETS_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(targets, null, 2), 'utf8');
    fs.renameSync(tmpFile, TARGETS_FILE);

    return targets;
  } catch (err) {
    console.error('Error al sincronizar targets de Prometheus:', err.message);
    throw err;
  }
}

module.exports = {
  sincronizarTargets,
  TARGETS_FILE,
  PUERTOS,
};
