# plataforma-tenants

Plataforma para crear y administrar tenants (una institucion educativa = una VM en AWS con su propia base de datos) de la aplicacion de registro de asistencia.

## Quien es dueno de que carpeta

Cada integrante trabaja solo dentro de su carpeta. Asi no se pisan los cambios.

| Integrante | Responsable de | Carpeta | Rama |
| --- | --- | --- | --- |
| 1 | API y worker de la plataforma | `api/`, `db/` | `i1-api` |
| 2 | Consola web | `web/` | `i2-web` |
| 3 | Imagen (Packer), Ansible, cloud-init y app en la VM | `packer/`, `ansible/` | `i3-imagen` |
| 4 | Infraestructura como codigo (OpenTofu, Pulumi, CloudFormation) | `infra/tofu/`, `infra/pulumi/`, `infra/cloudformation/` | `i4-infra` |
| 5 | Grafana, Prometheus y alertas | `observabilidad/` | `i5-observabilidad` |
| 6 | Escaneres de seguridad, CI, pruebas de aislamiento y documentacion | `docs/`, `security/`, `tests/`, `.github/` | `i6-seguridad` |
| Todos | Contrato (JSON de entrada y salida del tenant, rutas de la API) | `contrato/` | por Pull Request, con aviso al grupo |

Cada carpeta lleva un `README.md` corto (diez lineas) que explica como correr esa parte sola.

## Flujo de ramas

```
i1-api, i2-web, i3-imagen, ...   ->   develop   ->   main
```

1. Crea tu rama una sola vez, desde `develop`: `git checkout develop`, `git pull`, `git checkout -b i3-imagen`.
2. Trabaja solo en tu carpeta. Haz commit y sube a tu rama cuantas veces quieras, sin pedir permiso: `git push -u origin i3-imagen` la primera vez, y `git push` despues.
3. Al empezar cada sesion, trae lo nuevo de los demas: `git pull origin develop`.
4. En cada punto de integracion, abre un Pull Request de tu rama hacia `develop`. Lo une el Integrante 6 o tu pareja de respaldo (1 con 4, 3 con 5, 2 con 6).
5. `develop` pasa a `main` solo cuando todo funciona. **`main` es la version que se muestra en la defensa.**

Nadie escribe directo en `develop` ni en `main`; solo en su propia rama.

## Reglas que no se rompen

- **Nunca subir secretos:** nada de `.env`, claves de AWS, contrasenas ni archivos `.tfstate`. El `.gitignore` los bloquea, pero revisa con `git status` antes de cada commit.
- **Commits con tu propia identidad:** configura `git config user.name` y `user.email` con el correo de tu cuenta de GitHub, para que el historial muestre quien hizo cada parte.
- **Cada tenant tiene su propia base de datos.** La base de la plataforma (PostgreSQL) guarda solo la ficha del tenant, nunca sus datos de asistencia.
- **Destruir lo que se crea.** Los tenants de prueba en AWS se eliminan al terminar la sesion (`POST /tenants/:id/eliminar`).

## Correr la API en tu PC

Necesitas Node 20 o mas y PostgreSQL 16.

1. Crea la base: `CREATE DATABASE plataforma;` y aplica `db/schema.sql`.
2. En `api/`, copia `env.example` como `.env` y completa la contrasena.
3. `npm install`
4. Terminal 1: `node api.js`. Terminal 2: `node worker.js`.
5. Con `ENGINE=fake` todo es simulado y no cuesta nada. `ENGINE=tofu` crea VMs reales en AWS.

## Rutas de la API

| Metodo y ruta | Para que sirve |
| --- | --- |
| `GET /planes` | Catalogo de planes |
| `GET /tenants` | Lista con filtros opcionales: `nombre`, `estado`, `plan`, `entorno` |
| `GET /tenants/:id` | Un tenant |
| `POST /tenants` | Crear un tenant (responde 202 y encola la operacion `crear`) |
| `POST /tenants/:id/eliminar` | Eliminar; exige `{ "confirmar": "<id del tenant>" }` |
| `GET /operaciones` | Ultimas operaciones, o `?tenant=<id>` |
| `GET /operaciones/:id` | Estado, log y error de una operacion |
| `POST /operaciones/:id/reintentar` | Reintentar una operacion fallida |

Ejemplo de cuerpo para crear un tenant:

```json
{
  "id": "utepsa",
  "nombre": "UTEPSA",
  "contacto": "admin@utepsa.edu",
  "plan": "estandar",
  "entorno": "produccion",
  "motor": "opentofu"
}
```
