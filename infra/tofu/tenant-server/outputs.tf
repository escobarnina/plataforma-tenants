# Mismo contrato de salida que usa la plataforma (ver contrato/motor-salida.json).
output "tenant_id" {
  value = var.tenant_id
}

output "instance_id" {
  value = aws_instance.tenant.id
}

output "public_ip" {
  value = aws_instance.tenant.public_ip
}

output "url" {
  value = "http://${aws_instance.tenant.public_ip}"
}

output "version_plantilla" {
  value = var.version_plantilla
}
