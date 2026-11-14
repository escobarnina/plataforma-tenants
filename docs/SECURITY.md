# Seguridad de la plataforma

## Aislamiento entre tenants
Cada institucion (tenant) tiene su propia VM en AWS. La plantilla `infra/tofu/tenant-server/main.tf` aplica:

| Medida | Para que sirve |
|---|---|
| Security group propio (`tenant-<id>-...`) | Un tenant no comparte firewall con otro |
| Solo el puerto 80 abierto a internet | La base MySQL (3306) no es accesible desde afuera |
| SSH solo desde un rango permitido (y desactivado si no se configura) | Nadie entra a la VM desde cualquier lugar |
| Disco cifrado | Los datos no se leen si se copia el disco |
| IMDSv2 obligatorio | Evita robar las credenciales de AWS desde la VM |
| Etiqueta `tenant_id` en todo recurso | Se sabe a que tenant pertenece cada recurso |

Estas reglas las comprueba `tests/isolation/run_isolation_tests.sh`. Si alguien cambia la plantilla y rompe una, el CI falla.

## Secretos
- Las claves van en archivos `.env` (excluidos por `.gitignore`) o en SSM. Nunca en el codigo.
- El estado de OpenTofu (`.tfstate`) se guarda en S3, no en Git.
- Trivy y la prueba de aislamiento revisan que no se suban secretos.

## CI de seguridad
`.github/workflows/security-ci.yml` corre Semgrep, Trivy, KICS y las pruebas de aislamiento en cada push y Pull Request hacia `develop` y `main`.
- Trivy y KICS fallan si encuentran problemas graves (HIGH o CRITICAL).
- Semgrep muestra sus avisos en el log, pero no bloquea: los pendientes estan abajo.
- Las acciones van fijadas por SHA, no por etiqueta, para que nadie pueda cambiarlas sin que lo notemos.

## Reglas de KICS excluidas
KICS marca como grave (HIGH) que el puerto 80 este abierto a internet. Es intencional: la aplicacion de cada institucion debe ser accesible para sus estudiantes y docentes. Se excluyen 4 reglas que solo marcan eso (ver comentario en el CI). SSH (22) y MySQL (3306) siguen vigilados por `tests/isolation/run_isolation_tests.sh`.

KICS tambien da avisos MEDIUM que no bloquean: monitoreo detallado de EC2, IP publica de la VM y falta de rol IAM en la instancia.

## Avisos pendientes de Semgrep
Avisos en codigo de otros integrantes. Ninguno es urgente.

| Archivo | Aviso | Evaluacion | Responsable |
|---|---|---|---|
| `api/api.js` | Sin proteccion CSRF | Falsa alarma: CSRF afecta a sesiones con cookies; la API usa token en el encabezado | Integrante 1 |
| `api/motor-tofu.js` (`path.join` con `tenantId`) | Posible acceso a otras carpetas | Bajo: la base de datos solo acepta ids `a-z0-9-` | Integrante 1 |
| `api/motor-tofu.js` (`spawn(comando)`) | Posible ejecucion de comandos | Bajo: el comando es fijo (`tofu`), no viene del usuario | Integrante 1 |
| `observabilidad/infra/main.tf` | La VM de Grafana tiene IP publica | Necesaria para entrar a Grafana; conviene limitar quien entra en su security group | Integrante 5 |
| `observabilidad/probar-metricas.js` | Servidor `http` sin cifrar | Script de prueba local, no se despliega | Integrante 5 |
