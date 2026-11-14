Seguridad, Aislamiento y CI (Integrante 6, rama i6-seguridad)

Este módulo garantiza la seguridad del código fuente, las dependencias y la infraestructura como código (IaC), además del aislamiento estricto entre instituciones (multi-tenant). Incluye 3 escáneres automatizados en CI (`.github/workflows/security-ci.yml`), scripts de validación de red y datos (`tests/isolation/`), documentación técnica (`docs/SECURITY.md`) y una pantalla de infraestructura interactiva para auditar los tenants **San Marcos** y **Del Norte**.

Qué hace cada herramienta:
- **Semgrep (Escáner 1 - SAST):** Analiza el código fuente buscando vulnerabilidades de programación (inyecciones SQL, XSS, malas prácticas) sin ejecutar la aplicación.
- **Trivy (Escáner 2 - SCA y Contenedores):** Revisa dependencias del proyecto, librerías externas e imágenes Docker en busca de vulnerabilidades conocidas (CVE).
- **KICS (Escáner 3 - IaC):** Audita archivos de infraestructura como código (Terraform, Kubernetes, Dockerfiles, CloudFormation) para detectar malas configuraciones de seguridad antes del despliegue.
- **Pruebas de Aislamiento:** Verifican que la red y base de datos de **Institución San Marcos** (`10.10.1.0/24`) no puedan comunicarse ni leer datos de **Institución Del Norte** (`10.20.1.0/24`).

Instalación de las herramientas (para correr en local):
- **Windows (con Winget, Pip o Docker):**
  `pip install semgrep`
  `winget install AquaSecurity.Trivy`
  `docker pull checkmarx/kics:latest` (o descargar binario oficial de Checkmarx KICS para Windows)
- **Linux / macOS (con Brew o Pip):**
  `pip install semgrep`
  `brew install trivy kics`

Correr sola (sin API ni AWS):
1. **Pantalla de Infraestructura:** Abrir `docs/infra-dashboard.html` directamente en cualquier navegador y usar los botones de cada tenant (**San Marcos** o **Del Norte**) para ejecutar **Semgrep**, **Trivy** y **KICS** y revisar sus logs.
2. **Escáneres en terminal local:** Ejecutar `semgrep --config=auto .`, `trivy fs .` y `kics scan -p . -o ./results` en la raíz del proyecto.
3. **Pruebas de aislamiento:** Correr `bash tests/isolation/run_isolation_tests.sh` para validar las políticas Zero-Trust entre tenants.


Con el proyecto completo (CI en GitHub):
Hacer `git push` a la rama `i6-seguridad`. GitHub Actions levantará un entorno limpio y ejecutará automáticamente **Semgrep**, **Trivy**, **KICS** y las pruebas de aislamiento.


