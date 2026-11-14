# Configuracion de los 3 escaneres

| Escaner | Que revisa | Configuracion en el CI | Falla si... |
|---|---|---|---|
| **Semgrep** (SAST) | Codigo fuente de `api/` y `web/` | Reglas `p/default` | Encuentra un error de seguridad |
| **Trivy** (SCA y secretos) | Librerias (`package-lock.json`) y claves escritas en archivos | `scanners: vuln,secret` | Hay una vulnerabilidad HIGH o CRITICAL, o una clave |
| **KICS** (IaC) | Plantillas de `infra/` (OpenTofu, CloudFormation, Pulumi) | `path: infra` | Hay un problema de severidad alta |
