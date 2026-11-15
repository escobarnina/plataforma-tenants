# Seguridad, aislamiento y CI (Integrante 6, rama `i6-seguridad`)

Revisa el codigo, las dependencias y la infraestructura de la plataforma, y comprueba que cada tenant quede aislado de los demas.

**Archivos:**
- `.github/workflows/security-ci.yml`: CI con 3 escaneres y las pruebas de aislamiento. Corre en cada push y Pull Request hacia `develop` y `main`.
- `tests/isolation/run_isolation_tests.sh`: pruebas de aislamiento.
- `security/scanners-config.md`: que revisa cada escaner.
- `docs/SECURITY.md`: resumen de las medidas de seguridad.

**Escaneres:**
- **Semgrep:** busca errores de seguridad en el codigo (inyeccion SQL, XSS, malas practicas) sin ejecutarlo.
- **Trivy:** busca librerias con vulnerabilidades conocidas (CVE) y claves escritas en el codigo.
- **KICS:** revisa las plantillas de `infra/` (OpenTofu, CloudFormation, Pulumi) en busca de malas configuraciones.

**Correr en local (opcional):**
1. Instalar: `pip install semgrep` y `winget install AquaSecurity.Trivy`.
2. `semgrep scan --config p/default`
3. `trivy fs --scanners vuln,secret .`
4. `bash tests/isolation/run_isolation_tests.sh` (en Windows, con Git Bash)
