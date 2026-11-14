provider "aws" {
  region = var.region

  # Todo recurso lleva la etiqueta tenant_id (costos, aislamiento y limpieza).
  default_tags {
    tags = {
      tenant_id      = var.tenant_id
      proyecto       = "plataforma-tenants"
      gestionado_por = "opentofu"
    }
  }
}

# Ubuntu 24.04 de Canonical, solo se usa si no se indica una AMI propia.
data "aws_ami" "ubuntu" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

locals {
  ami = var.ami_id != "" ? var.ami_id : data.aws_ami.ubuntu[0].id
}

resource "aws_security_group" "tenant" {
  name_prefix = "tenant-${var.tenant_id}-"
  description = "Firewall del tenant ${var.tenant_id}"

  ingress {
    description = "Web (nginx de la app)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = var.ssh_cidr == "" ? [] : [var.ssh_cidr]
    content {
      description = "SSH solo desde un rango permitido"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    description = "Salida a internet (paquetes y actualizaciones)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_instance" "tenant" {
  ami                    = local.ami
  instance_type          = var.instance_type
  vpc_security_group_ids = [aws_security_group.tenant.id]

  # Disco cifrado: sistema + espacio para la base de datos del plan.
  root_block_device {
    volume_type = "gp3"
    volume_size = 8 + var.db_volume_gb
    encrypted   = true
  }

  # IMDSv2 obligatorio (los escaneres de seguridad lo piden).
  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  # Primer arranque: cloud-init escribe la configuracion de este tenant.
  user_data = templatefile("${path.module}/cloud-init.tftpl", {
    tenant_id    = var.tenant_id
    db_volume_gb = var.db_volume_gb
  })
  user_data_replace_on_change = true

  tags = {
    Name = "tenant-${var.tenant_id}"
  }
}
