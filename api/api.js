// API de la plataforma. Recibe pedidos y los anota en la tabla operations;
// quien los ejecuta es el worker (worker.js), en segundo plano.

require('dotenv').config();
const express = require('express');
const pool = require('./db');

const app = express();
app.use(express.json());

// Permite que la consola web (otro puerto) llame a esta API.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Envuelve cada ruta para responder errores sin exponer detalles internos.
const ruta = (fn) => (req, res) =>
  fn(req, res).catch((error) => {
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un tenant con ese id' });
    if (error.code === '23503' || error.code === '23514') {
      return res.status(400).json({ error: 'Datos invalidos: revisa id, plan, motor y entorno' });
    }
    console.error(error.message);
    res.status(500).json({ error: 'Error interno' });
  });

async function enTransaccion(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

app.get('/health', (req, res) => res.json({ ok: true }));

// Catalogo de planes (RF-01, RF-02, RF-03)
app.get(
  '/planes',
  ruta(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM plans ORDER BY db_volume_gb');
    res.json(rows);
  })
);

// Consultar tenants por nombre, estado, plan y entorno (RF-14)
app.get(
  '/tenants',
  ruta(async (req, res) => {
    const filtros = [];
    const valores = [];
    const agregar = (columna, valor, parcial = false) => {
      if (!valor) return;
      valores.push(parcial ? `%${valor}%` : valor);
      filtros.push(`${columna} ${parcial ? 'ILIKE' : '='} $${valores.length}`);
    };
    agregar('nombre', req.query.nombre, true);
    agregar('estado', req.query.estado);
    agregar('plan_id', req.query.plan);
    agregar('entorno', req.query.entorno);
    const donde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const { rows } = await pool.query(`SELECT * FROM tenants ${donde} ORDER BY creado_en DESC`, valores);
    res.json(rows);
  })
);

app.get(
  '/tenants/:id',
  ruta(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Tenant no encontrado' });
    res.json(rows[0]);
  })
);

// Crear tenant (RF-07): guarda la ficha y encola la operacion 'crear'.
app.post(
  '/tenants',
  ruta(async (req, res) => {
    const b = req.body || {};
    const faltan = ['id', 'nombre', 'contacto', 'plan', 'entorno', 'motor'].filter((campo) => !b[campo]);
    if (faltan.length) return res.status(400).json({ error: `Faltan campos: ${faltan.join(', ')}` });

    const resultado = await enTransaccion(async (cliente) => {
      const tenant = await cliente.query(
        `INSERT INTO tenants (id, nombre, contacto, region, entorno, plan_id, motor, zona_horaria, datos_ejemplo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          b.id, b.nombre, b.contacto, b.region || 'us-east-1', b.entorno, b.plan, b.motor,
          b.zona_horaria || 'America/La_Paz', b.datos_ejemplo !== false,
        ]
      );
      const operacion = await cliente.query(
        `INSERT INTO operations (tenant_id, tipo) VALUES ($1, 'crear') RETURNING *`,
        [b.id]
      );
      return { tenant: tenant.rows[0], operacion: operacion.rows[0] };
    });

    res.status(202).json(resultado);
  })
);

// Eliminar tenant (RF-18): exige escribir el id del tenant para confirmar.
app.post(
  '/tenants/:id/eliminar',
  ruta(async (req, res) => {
    const id = req.params.id;
    const { rows } = await pool.query('SELECT estado FROM tenants WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Tenant no encontrado' });
    if ((req.body || {}).confirmar !== id) {
      return res.status(400).json({ error: 'Para confirmar, envia "confirmar" con el id del tenant' });
    }
    if (['eliminando', 'eliminado'].includes(rows[0].estado)) {
      return res.status(409).json({ error: 'El tenant ya se esta eliminando o fue eliminado' });
    }

    const operacion = await enTransaccion(async (cliente) => {
      await cliente.query(`UPDATE tenants SET estado = 'eliminando', actualizado_en = now() WHERE id = $1`, [id]);
      const o = await cliente.query(`INSERT INTO operations (tenant_id, tipo) VALUES ($1, 'eliminar') RETURNING *`, [id]);
      return o.rows[0];
    });

    res.status(202).json({ operacion });
  })
);

// Suspender (RF-16) y reanudar (RF-17): apagan o encienden la VM sin borrar el tenant.
function rutaEnergia(accion, estadoRequerido) {
  app.post(
    `/tenants/:id/${accion}`,
    ruta(async (req, res) => {
      const id = req.params.id;
      const { rows } = await pool.query('SELECT estado FROM tenants WHERE id = $1', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Tenant no encontrado' });
      if (rows[0].estado !== estadoRequerido) {
        return res.status(409).json({ error: `Solo se puede ${accion} un tenant en estado ${estadoRequerido} (estado actual: ${rows[0].estado})` });
      }
      const ocupado = await pool.query(
        `SELECT 1 FROM operations WHERE tenant_id = $1 AND estado IN ('pendiente','en_curso') LIMIT 1`, [id]);
      if (ocupado.rows.length) return res.status(409).json({ error: 'El tenant ya tiene una operacion en curso' });
      const o = await pool.query(`INSERT INTO operations (tenant_id, tipo) VALUES ($1, $2) RETURNING *`, [id, accion]);
      res.status(202).json({ operacion: o.rows[0] });
    })
  );
}
rutaEnergia('suspender', 'activo');
rutaEnergia('reanudar', 'suspendido');

// Estado y log de una operacion (RF-11)
app.get(
  '/operaciones/:id',
  ruta(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM operations WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Operacion no encontrada' });
    res.json(rows[0]);
  })
);

app.get(
  '/operaciones',
  ruta(async (req, res) => {
    const { rows } = req.query.tenant
      ? await pool.query('SELECT * FROM operations WHERE tenant_id = $1 ORDER BY id DESC', [req.query.tenant])
      : await pool.query('SELECT * FROM operations ORDER BY id DESC LIMIT 50');
    res.json(rows);
  })
);

// Reintentar una operacion fallida (RF-12): vuelve a 'pendiente' y el worker la retoma.
app.post(
  '/operaciones/:id/reintentar',
  ruta(async (req, res) => {
    const { rows } = await pool.query(
      `UPDATE operations SET estado = 'pendiente', log = log || E'\\n--- reintento ---\\n'
       WHERE id = $1 AND estado = 'fallida' RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(409).json({ error: 'Solo se pueden reintentar operaciones fallidas' });
    res.status(202).json(rows[0]);
  })
);

// --- OBSERVABILIDAD (RF-28 y RF-29) ---

// Listar alertas (RF-29): la consola web las consulta por tenant o estado.
app.get(
  '/alertas',
  ruta(async (req, res) => {
    const filtros = [];
    const valores = [];
    if (req.query.tenant) {
      valores.push(req.query.tenant);
      filtros.push(`tenant_id = $${valores.length}`);
    }
    if (req.query.estado) {
      valores.push(req.query.estado);
      filtros.push(`estado = $${valores.length}`);
    }
    const donde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM alerts ${donde} ORDER BY detectada_en DESC LIMIT 100`,
      valores
    );
    res.json(rows);
  })
);

// Webhook para recibir alertas desde Grafana o Alertmanager (RF-28 y RF-29)
app.post(
  '/alertas/webhook',
  ruta(async (req, res) => {
    const body = req.body || {};
    // Soporta formato Alertmanager o formato Grafana Alerting
    let alertasEntrantes = [];

    if (Array.isArray(body.alerts)) {
      // Formato Alertmanager
      alertasEntrantes = body.alerts.map((a) => ({
        tenant_id: a.labels?.tenant_id || a.labels?.tenant || null,
        nombre: a.labels?.alertname || 'Alerta',
        severidad: a.labels?.severity || 'warning',
        estado: a.status === 'resolved' ? 'resuelta' : 'activa',
        detalle: a.annotations?.description || a.annotations?.summary || 'Alerta generada por el sistema de monitoreo',
        detectada_en: a.startsAt || new Date().toISOString(),
      }));
    } else if (body.ruleName || body.title) {
      // Formato Grafana legacy / webhook directo
      alertasEntrantes.push({
        tenant_id: body.tags?.tenant_id || body.tags?.tenant || null,
        nombre: body.ruleName || body.title || 'Alerta Grafana',
        severidad: body.state === 'alerting' ? 'critical' : 'warning',
        estado: body.state === 'ok' ? 'resuelta' : 'activa',
        detalle: body.message || 'Alerta detectada en Grafana',
        detectada_en: new Date().toISOString(),
      });
    } else if (body.nombre) {
      // Formato manual o directo
      alertasEntrantes.push({
        tenant_id: body.tenant_id || null,
        nombre: body.nombre,
        severidad: body.severidad || 'warning',
        estado: body.estado || 'activa',
        detalle: body.detalle || '',
        detectada_en: body.detectada_en || new Date().toISOString(),
      });
    }

    const insertadas = [];
    for (const a of alertasEntrantes) {
      const { rows } = await pool.query(
        `INSERT INTO alerts (tenant_id, nombre, severidad, estado, detalle, detectada_en)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [a.tenant_id, a.nombre, a.severidad, a.estado, a.detalle, a.detectada_en]
      );
      insertadas.push(rows[0]);
    }

    res.status(201).json({ recibidas: insertadas.length, alertas: insertadas });
  })
);

// Endpoint para forzar sincronizacion de targets de Prometheus
const { sincronizarTargets } = require('./sync-targets');
app.post(
  '/monitoreo/sync-targets',
  ruta(async (req, res) => {
    const targets = await sincronizarTargets();
    res.json({ ok: true, total_grupos: targets.length });
  })
);

const puerto = Number(process.env.PORT || 4000);
app.listen(puerto, () => console.log(`API escuchando en http://localhost:${puerto}`));
