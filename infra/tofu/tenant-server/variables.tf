variable "tenant_id" {
  description = "Id del tenant (minusculas, numeros y guiones). Va como etiqueta en todo recurso."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.tenant_id))
    error_message = "tenant_id debe tener de 3 a 30 caracteres: minusculas, numeros y guiones."
  }
}

variable "region" {
  description = "Region de AWS."
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "Tipo de VM segun el plan: basico t3.micro, estandar t3.small, avanzado c7i-flex.large."
  type        = string
  default     = "t3.micro"
}

variable "db_volume_gb" {
  description = "Espacio reservado para la base de datos segun el plan (basico 10, estandar 50, avanzado 200)."
  type        = number
  default     = 10
}

variable "ami_id" {
  description = "AMI con la app (la genera Packer, Integrante 3). Vacio = Ubuntu 24.04 estandar."
  type        = string
  default     = ""
}

variable "ssh_cidr" {
  description = "Rango de IP con permiso de SSH. Vacio = sin SSH (recomendado)."
  type        = string
  default     = ""
}

variable "admin_password" {
  description = "Clave inicial del administrador de la app. Vacio = la VM genera una y la guarda en /etc/tenant/credenciales."
  type        = string
  default     = ""
  sensitive   = true
}

variable "seed_data" {
  description = "true = la app arranca con datos de ejemplo (para pruebas)."
  type        = bool
  default     = false
}

variable "version_plantilla" {
  description = "Version de este modulo, la registra la plataforma en cada despliegue."
  type        = string
  default     = "0.3.0"
}
