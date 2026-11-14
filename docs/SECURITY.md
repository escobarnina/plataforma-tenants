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
`.github/workflows/security-ci.yml` corre Semgrep, Trivy, KICS y las pruebas de aislamiento en cada push y Pull Request hacia `develop` y `main`. Falla si encuentra problemas graves (HIGH o CRITICAL).
