# Imagen (AMI) del tenant: Ubuntu 24.04 + nginx + Node 20 + MySQL 8 + Mi-asistencia, sin Docker.
# Packer crea una VM temporal, Ansible la deja lista y Packer guarda el resultado como AMI.
# La configuracion propia de cada tenant (id, claves, base de datos) NO va aqui:
# la escribe el primer arranque (cloud-init + tenant-configure).

packer {
  required_version = ">= 1.9.0"
  required_plugins {
    amazon = {
      source  = "github.com/hashicorp/amazon"
      version = ">= 1.3.0"
    }
    ansible = {
      source  = "github.com/hashicorp/ansible"
      version = ">= 1.1.0"
    }
  }
}

variable "region" {
  type        = string
  default     = "us-east-1"
  description = "Region donde se crea la AMI."
}

variable "instance_type" {
  type        = string
  default     = "t3.small"
  description = "VM temporal del build. Con 2 GB de RAM alcanza para compilar el frontend (t3.micro no)."
}

variable "app_repo" {
  type        = string
  default     = "https://github.com/escobarnina/Mi-asistencia.git"
  description = "Repositorio de la aplicacion."
}

variable "app_ref" {
  type        = string
  default     = "main"
  description = "Rama, etiqueta o commit de la aplicacion que se hornea en la imagen."
}

variable "app_version" {
  type        = string
  default     = "1.0.0"
  description = "Version de la aplicacion; se guarda en el nombre y las etiquetas de la AMI (RF-13)."
}

variable "ami_prefix" {
  type        = string
  default     = "mi-asistencia"
  description = "Prefijo del nombre de la AMI."
}

locals {
  fecha = formatdate("YYYYMMDD-hhmm", timestamp())
  etiquetas = {
    proyecto       = "plataforma-tenants"
    gestionado_por = "packer"
    app_version    = var.app_version
    app_ref        = var.app_ref
  }
}

source "amazon-ebs" "tenant" {
  region        = var.region
  instance_type = var.instance_type
  ssh_username  = "ubuntu"
  ssh_timeout   = "10m"

  # Mismo Ubuntu 24.04 de Canonical que usan OpenTofu, CloudFormation y Pulumi.
  source_ami_filter {
    filters = {
      name                = "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"
      root-device-type    = "ebs"
      virtualization-type = "hvm"
    }
    owners      = ["099720109477"]
    most_recent = true
  }

  # 10 GB alcanzan para el sistema y la app. El tenant lanza la VM con 8 GB + su espacio
  # de base de datos (18 GB o mas), asi que la imagen siempre cabe.
  launch_block_device_mappings {
    device_name           = "/dev/sda1"
    volume_size           = 10
    volume_type           = "gp3"
    delete_on_termination = true
  }

  ami_name        = "${var.ami_prefix}-${var.app_version}-${local.fecha}"
  ami_description = "Mi-asistencia ${var.app_version} (${var.app_ref}): nginx, Node 20 y MySQL 8 sin Docker"
  tags            = merge(local.etiquetas, { Name = "${var.ami_prefix}-${var.app_version}" })
  snapshot_tags   = local.etiquetas
  run_tags        = merge(local.etiquetas, { Name = "packer-build-${var.ami_prefix}" })
}

build {
  name    = "tenant"
  sources = ["source.amazon-ebs.tenant"]

  # Ansible se ejecuta DENTRO de la VM temporal (ansible-local). Asi no hace falta instalar
  # Ansible en Windows, donde no funciona como maquina de control.
  provisioner "shell" {
    inline = [
      "cloud-init status --wait",
      "sudo DEBIAN_FRONTEND=noninteractive apt-get update -y",
      "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ansible-core",
    ]
  }

  provisioner "ansible-local" {
    playbook_file = "${path.root}/../ansible/playbook.yml"
    playbook_dir  = "${path.root}/../ansible"
    # Un argumento por variable (sin espacios) para que el shell no los parta.
    extra_arguments = [
      "-e", "app_repo=${var.app_repo}",
      "-e", "app_ref=${var.app_ref}",
      "-e", "app_version=${var.app_version}",
    ]
  }

  # Limpieza: la imagen no debe llevar claves ni estado de esta VM temporal.
  provisioner "shell" {
    inline = [
      "sudo cloud-init clean --logs",
      "sudo rm -f /home/ubuntu/.ssh/authorized_keys /root/.ssh/authorized_keys",
      "sudo truncate -s 0 /etc/machine-id",
      "sudo apt-get clean",
    ]
  }

  # Deja el id de la AMI en packer/manifest.json para copiarlo a AMI_ID.
  post-processor "manifest" {
    output     = "${path.root}/manifest.json"
    strip_path = true
  }
}
