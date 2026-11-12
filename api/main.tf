terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "tenant_id" {
  type        = string
  description = "Identificador unico del tenant, por ejemplo: utepsa"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

provider "aws" {
  region = var.region
}

# Imagen base: Ubuntu 24.04 oficial (mas adelante se reemplaza por la AMI de Packer)
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

# Firewall del tenant: solo entra HTTP (puerto 80). No hay SSH a proposito.
resource "aws_security_group" "tenant" {
  name        = "tenant-${var.tenant_id}-sg"
  description = "Firewall del tenant ${var.tenant_id}"

  ingress {
    from_port   = 80
    to_port     = 80
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
    tenant_id = var.tenant_id
  }
}

# La VM del tenant. cloud-init ejecuta user_data en el primer arranque.
resource "aws_instance" "tenant" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  vpc_security_group_ids      = [aws_security_group.tenant.id]
  user_data_replace_on_change = true

  user_data = <<-EOF
    #!/bin/bash
    apt-get update -y
    apt-get install -y nginx
    echo "Tenant ${var.tenant_id} funcionando" > /var/www/html/index.html
  EOF

  tags = {
    Name      = "tenant-${var.tenant_id}"
    tenant_id = var.tenant_id
  }
}

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
