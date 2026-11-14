# Ansible: deja lista la imagen del tenant (Integrante 3)

Lo ejecuta Packer dentro de la VM temporal (`ansible-local`); no hace falta instalar Ansible en tu PC.

| Rol | Que hace |
| --- | --- |
| `base` | Zona horaria La Paz, paquetes base y swap de 1 GB |
| `nodejs` | Node.js 20 |
| `mysql` | MySQL 8 (solo local, utf8mb4); sin base ni usuario: los crea cada tenant |
| `app` | Descarga Mi-asistencia, instala dependencias, compila el frontend, configura nginx y el servicio systemd |
| `monitoreo` | Sensores para Prometheus: `node_exporter` (9100), `mysqld_exporter` (9104) y el contador de la app (3000). El firewall solo abre esos puertos a la IP de Prometheus (`MONITORING_CIDR`) |
| `firstboot` | Instala `tenant-configure`, el script que corre en el primer arranque de cada VM |

## Metricas de la app (`roles/monitoreo/files/metricas-app.js`)
nginx envia `/api` a un contador (`127.0.0.1:8001`) que reenvia al backend (`8000`) y publica en `:3000/metrics` las peticiones (`http_requests_total`) y la latencia (`http_request_duration_seconds`). No modifica Mi-asistencia.
El sensor de MySQL usa un usuario `exporter` que crea `tenant-configure`, con permiso solo para leer estadisticas (no ve la base `asistencia`).

## Primer arranque (`roles/firstboot/files/tenant-configure`)
Lee `/etc/tenant/tenant.env` (lo escribe cloud-init): `TENANT_ID`, `DB_VOLUME_GB` y, si se quiere, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SEED_DATA`.
Crea la base y el usuario de MySQL con una clave propia, escribe el `.env` de la app, migra, crea el administrador y arranca el backend.
Log: `/var/log/tenant-configure.log`. Credenciales del admin: `/etc/tenant/credenciales` (solo root).
