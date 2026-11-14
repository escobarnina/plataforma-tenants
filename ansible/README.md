# Ansible: deja lista la imagen del tenant (Integrante 3)

Lo ejecuta Packer dentro de la VM temporal (`ansible-local`); no hace falta instalar Ansible en tu PC.

| Rol | Que hace |
| --- | --- |
| `base` | Zona horaria La Paz, paquetes base y swap de 1 GB |
| `nodejs` | Node.js 20 |
| `mysql` | MySQL 8 (solo local, utf8mb4); sin base ni usuario: los crea cada tenant |
| `app` | Descarga Mi-asistencia, instala dependencias, compila el frontend, configura nginx y el servicio systemd |
| `firstboot` | Instala `tenant-configure`, el script que corre en el primer arranque de cada VM |

## Primer arranque (`roles/firstboot/files/tenant-configure`)
Lee `/etc/tenant/tenant.env` (lo escribe cloud-init): `TENANT_ID`, `DB_VOLUME_GB` y, si se quiere, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SEED_DATA`.
Crea la base y el usuario de MySQL con una clave propia, escribe el `.env` de la app, migra, crea el administrador y arranca el backend.
Log: `/var/log/tenant-configure.log`. Credenciales del admin: `/etc/tenant/credenciales` (solo root).
