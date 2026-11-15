# Imagen del tenant con Packer (Integrante 3)

Crea una AMI de Ubuntu 24.04 con nginx, Node 20, MySQL 8 y Mi-asistencia, sin Docker.
Ansible deja todo instalado (carpeta `../ansible`). La configuracion de cada tenant la escribe el primer arranque.

## Crear la imagen
```
cd packer
packer init .
packer validate .
packer build .
```
Tarda 10 a 15 minutos y usa una VM `t3.small` temporal que Packer borra al terminar.
Al final queda `manifest.json` con el id de la AMI. Para leerlo: `./ami-id.ps1`.

## Usar la imagen en la plataforma
Pon el id en `api/.env`: `AMI_ID=ami-xxxxxxxx`. Los tres motores (OpenTofu, CloudFormation, Pulumi) la usan solos.

## Variables (`-var nombre=valor`)
| Variable | Por defecto | Para que |
| --- | --- | --- |
| `app_ref` | `main` | Rama, etiqueta o commit de Mi-asistencia |
| `app_version` | `1.0.0` | Version que se guarda en el nombre y las etiquetas de la AMI |
| `region` | `us-east-1` | Region |
| `instance_type` | `t3.small` | VM temporal del build |

## Probar la AMI a mano
Lanza una EC2 con la AMI y en *Datos de usuario* pega:
```
#!/bin/bash
mkdir -p /etc/tenant
printf 'TENANT_ID=prueba-i3\nDB_VOLUME_GB=10\nSEED_DATA=true\nADMIN_PASSWORD=Prueba12345\n' > /etc/tenant/tenant.env
```
A los 2 minutos abre `http://IP-PUBLICA` y entra con `admin@prueba-i3.local` / `Prueba12345`.
Borra la VM al terminar. Nunca subas `manifest.json` ni claves.
