-- Esquema de la base de la PLATAFORMA (PostgreSQL 16).
-- Guarda solo la ficha de cada tenant y sus operaciones.
-- Los datos de cada institucion (usuarios, cursos, asistencia) viven en la base de SU propio tenant.

CREATE TABLE IF NOT EXISTS plans (
  id                    TEXT PRIMARY KEY,
  nombre                TEXT NOT NULL,
  instance_type         TEXT NOT NULL,
  db_volume_gb          INTEGER NOT NULL,
  capacidad_estudiantes INTEGER NOT NULL,
  nube                  TEXT NOT NULL DEFAULT 'aws'
);

INSERT INTO plans (id, nombre, instance_type, db_volume_gb, capacidad_estudiantes, nube) VALUES
  ('basico',   'Basico',   't3.micro',       10,  100,  'aws'),
  ('estandar', 'Estandar', 't3.small',       50,  1000, 'aws'),
  ('avanzado', 'Avanzado', 'c7i-flex.large', 200, 5000, 'aws')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS tenants (
  id             TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{3,30}$'),
  nombre         TEXT NOT NULL,
  contacto       TEXT NOT NULL,
  region         TEXT NOT NULL DEFAULT 'us-east-1',
  entorno        TEXT NOT NULL,
  plan_id        TEXT NOT NULL REFERENCES plans (id),
  motor          TEXT NOT NULL CHECK (motor IN ('opentofu', 'pulumi', 'cloudformation')),
  zona_horaria   TEXT NOT NULL DEFAULT 'America/La_Paz',
  datos_ejemplo  BOOLEAN NOT NULL DEFAULT TRUE,
  estado         TEXT NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente', 'aprovisionando', 'activo', 'suspendido',
                                   'fallido', 'eliminando', 'eliminado')),
  instance_id    TEXT,
  public_ip      TEXT,
  url            TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cola de trabajos: el worker toma filas 'pendiente' y las ejecuta en segundo plano.
CREATE TABLE IF NOT EXISTS operations (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants (id),
  tipo        TEXT NOT NULL CHECK (tipo IN ('crear', 'suspender', 'reanudar', 'eliminar')),
  estado      TEXT NOT NULL DEFAULT 'pendiente'
              CHECK (estado IN ('pendiente', 'en_curso', 'completada', 'fallida')),
  intentos    INTEGER NOT NULL DEFAULT 0,
  log         TEXT NOT NULL DEFAULT '',
  error       TEXT,
  creada_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  iniciada_en TIMESTAMPTZ,
  terminada_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS operations_pendientes ON operations (creada_en) WHERE estado = 'pendiente';

-- Versiones usadas en cada despliegue (RF-13).
CREATE TABLE IF NOT EXISTS deployments (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         TEXT NOT NULL REFERENCES tenants (id),
  operation_id      BIGINT REFERENCES operations (id),
  version_app       TEXT NOT NULL,
  version_plantilla TEXT NOT NULL,
  motor             TEXT NOT NULL,
  version_motor     TEXT,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alertas que envia Grafana por webhook (RF-28 y RF-29).
CREATE TABLE IF NOT EXISTS alerts (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    TEXT REFERENCES tenants (id),
  nombre       TEXT NOT NULL,
  severidad    TEXT NOT NULL DEFAULT 'warning',
  estado       TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'resuelta')),
  detalle      TEXT,
  detectada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
