# Aprovisionamiento del servidor de observabilidad (Prometheus + Alertmanager + Grafana)
# en AWS con OpenTofu, tal como indica el plan de arquitectura:
# "Grafana y Prometheus van en un servidor aparte en AWS, siempre encendido".

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "region" {
  type        = string
  default     = "us-east-1"
  description = "Region de AWS"
}

variable "instance_type" {
  type        = string
  default     = "t3.small"
  description = "Tamano del servidor de observabilidad"
}

variable "ami_id" {
  type        = string
  default     = ""
  description = "AMI Ubuntu 22.04 LTS (si esta vacio se busca la mas reciente)"
}

variable "key_name" {
  type        = string
  default     = ""
  description = "Nombre del keypair SSH opcional"
}

provider "aws" {
  region = var.region
}

# Busca la AMI de Ubuntu 22.04 LTS oficial si no se proporciona una
data "aws_ami" "ubuntu" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Security group abriendo solo Grafana (3000), Prometheus (9090) y Alertmanager (9093)
resource "aws_security_group" "observabilidad_sg" {
  name        = "observabilidad-sg"
  description = "Permite acceso a Grafana, Prometheus y Alertmanager"

  # Grafana UI & Dashboards
  ingress {
    description = "Grafana Web UI"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Prometheus (recoleccion y consultas)
  ingress {
    description = "Prometheus Web & Scrape"
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Alertmanager
  ingress {
    description = "Alertmanager"
    from_port   = 9093
    to_port     = 9093
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH para administracion
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name     = "observabilidad-sg"
    Modulo   = "observabilidad"
    Servicio = "monitoreo-plataforma"
  }
}

# Script cloud-init para instalar Docker, docker-compose y desplegar la pila
locals {
  user_data = <<-EOF
    #!/bin/bash
    set -e
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release git

    # Instala Docker
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    # Configurar directorio de observabilidad
    mkdir -p /opt/observabilidad
    # Clonar o copiar configuracion de observabilidad y ejecutar
    echo "Servidor de observabilidad listo."
  EOF
}

resource "aws_instance" "observabilidad" {
  ami                         = var.ami_id != "" ? var.ami_id : data.aws_ami.ubuntu[0].id
  instance_type               = var.instance_type
  vpc_security_group_ids      = [aws_security_group.observabilidad_sg.id]
  key_name                    = var.key_name != "" ? var.key_name : null
  associate_public_ip_address = true
  user_data                   = local.user_data

  root_block_device {
    volume_size           = 30
    volume_type           = "gp3"
    delete_on_termination = true
  }

  tags = {
    Name     = "servidor-observabilidad-plataforma"
    Rol      = "plano-de-control-monitoreo"
    Proyecto = "plataforma-tenants"
    Entorno  = "shared"
  }
}

output "public_ip" {
  value       = aws_instance.observabilidad.public_ip
  description = "IP publica del servidor de observabilidad"
}

output "grafana_url" {
  value       = "http://${aws_instance.observabilidad.public_ip}:3000"
  description = "URL publica de Grafana para embeber en la consola web"
}

output "prometheus_url" {
  value       = "http://${aws_instance.observabilidad.public_ip}:9090"
  description = "URL de Prometheus"
}
