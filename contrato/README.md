# Contrato entre la API y los motores

Todo motor (OpenTofu, Pulumi, CloudFormation) recibe la misma entrada y devuelve la misma salida.
Asi la API no cambia al cambiar de herramienta. Cambios al contrato: solo por Pull Request, con aviso al grupo.

## Entrada (`motor-entrada.json`)

| Campo | Descripcion |
| --- | --- |
| `tenant_id` | Id del tenant. Solo minusculas, numeros y guiones (3 a 30 caracteres). Va como etiqueta `tenant_id` en todo recurso. |
| `plan` | `basico`, `estandar` o `avanzado`. Define el tipo de VM (basico = t3.micro, estandar = t3.small, avanzado = c7i-flex.large). |
| `region` | Region de AWS, por defecto `us-east-1`. |
| `instance_id` | Solo al suspender o reanudar: id de la VM ya creada. |

## Salida de crear (`motor-salida.json`)

| Campo | Descripcion |
| --- | --- |
| `tenant_id` | El mismo de la entrada. |
| `instance_id` | Id de la VM creada. |
| `public_ip` | IP publica de la VM. |
| `url` | Direccion donde responde la app del tenant. |
| `versiones` | `app` (version de Mi-asistencia), `plantilla` (version del modulo de infraestructura) y `motor` (opentofu, pulumi o cloudformation). |

## Reglas
- Todo recurso lleva la etiqueta `tenant_id`.
- El motor escribe cada paso en el log (la API lo guarda en la operacion).
- Si algo falla, el motor lanza un error con un mensaje claro; no devuelve una salida parcial.
