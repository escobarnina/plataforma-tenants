#!/bin/bash
# Pruebas de aislamiento entre tenants (Integrante 6).
# Revisan la plantilla real de cada tenant (infra/) y que no se suban secretos.
# Si una regla falla, el script termina con error y el CI queda en rojo.

TOFU="infra/tofu/tenant-server/main.tf"
fallas=0

ok()    { echo "[OK]    $1"; }
falla() { echo "[FALLA] $1"; fallas=$((fallas + 1)); }

echo "Pruebas de aislamiento entre tenants"
echo "------------------------------------"

if [ ! -f "$TOFU" ]; then
  echo "[FALLA] No se encontro $TOFU"
  exit 1
fi

# 1. Cada tenant tiene su propio firewall (security group con su id).
if grep -q 'name_prefix *= *"tenant-${var.tenant_id}' "$TOFU"; then
  ok "Cada tenant tiene su propio security group"
else
  falla "El security group no es propio de cada tenant"
fi

# 2. MySQL (3306) no se abre en ninguna plantilla de infra/.
if grep -rqE '(from_port|FromPort|fromPort)[^0-9]*3306' infra/; then
  falla "Hay una regla que abre MySQL (3306)"
else
  ok "MySQL (3306) no esta abierto a la red"
fi

# 3. SSH no queda abierto a todo internet.
if grep -A6 'from_port *= *22' "$TOFU" | grep -q '0.0.0.0/0'; then
  falla "SSH (22) esta abierto a 0.0.0.0/0"
else
  ok "SSH solo se abre desde un rango permitido"
fi

# 4. Disco cifrado.
if grep -q 'encrypted *= *true' "$TOFU"; then
  ok "El disco del tenant esta cifrado"
else
  falla "El disco del tenant no esta cifrado"
fi

# 5. IMDSv2 obligatorio (protege las credenciales de AWS de la VM).
if grep -q 'http_tokens *= *"required"' "$TOFU"; then
  ok "IMDSv2 obligatorio"
else
  falla "IMDSv2 no es obligatorio"
fi

# 6. Todo recurso lleva la etiqueta tenant_id.
if grep -q 'tenant_id *= *var.tenant_id' "$TOFU"; then
  ok "Los recursos llevan la etiqueta tenant_id"
else
  falla "Falta la etiqueta tenant_id en los recursos"
fi

# 7. No hay archivos .env ni .tfstate en el repositorio.
secretos=$(git ls-files | grep -E '(^|/)\.env$|\.tfstate' || true)
if [ -n "$secretos" ]; then
  falla "Hay archivos con secretos en Git: $secretos"
else
  ok "No hay .env ni .tfstate en el repositorio"
fi

echo "------------------------------------"
if [ "$fallas" -gt 0 ]; then
  echo "Resultado: $fallas regla(s) fallaron."
  exit 1
fi
echo "Resultado: todas las reglas se cumplen."
