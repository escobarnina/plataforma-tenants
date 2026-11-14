# Arquitectura de la plataforma

La plataforma crea y administra una VM en AWS por cada institucion (tenant). Cada VM tiene su propia app de asistencia (Mi-asistencia) y su propia base MySQL, asi ningun tenant comparte datos con otro.

La plataforma en si (consola, API, worker y su base PostgreSQL) corre en local. Los tenants y la observabilidad corren en AWS.

> En los diagramas, las lineas punteadas marcan lo que **aun esta pendiente** (ver la tabla al final).

## 1. Piezas y donde corre cada una

```mermaid
flowchart LR
    admin(["Administrador"])

    subgraph local["Plataforma (local)"]
        consola["Consola web<br/>React + Vite :5173"]
        api["API<br/>Node + Express :4000"]
        pg[("PostgreSQL<br/>tenants, operaciones,<br/>usuarios, alertas")]
        worker["Worker<br/>ejecuta la cola"]
        motores["Motores<br/>OpenTofu / Pulumi / CloudFormation"]
    end

    subgraph aws["AWS"]
        subgraph vm1["VM tenant (una por institucion)"]
            nginx["nginx :80"]
            app["Mi-asistencia<br/>backend :8000"]
            mysql[("MySQL<br/>datos del tenant")]
        end
        subgraph obs["VM observabilidad"]
            prom["Prometheus"]
            graf["Grafana"]
            alert["Alertmanager"]
        end
        ami["AMI del tenant<br/>Packer + Ansible"]
        s3[("S3<br/>state de OpenTofu")]
        ssm[("SSM<br/>secretos")]
    end

    admin --> consola
    consola -->|"HTTP + token"| api
    api --> pg
    worker --> pg
    worker --> motores
    motores -->|"crea firewall y VM"| vm1
    ami -->|"imagen base"| vm1
    nginx --> app --> mysql
    prom -->|"lee metricas"| graf
    prom --> alert
    alert -->|"webhook"| api

    prom -.->|"pendiente: metricas de la VM"| vm1
    motores -.->|"pendiente"| s3
    motores -.->|"pendiente"| ssm
    consola -.->|"pendiente: URL de Grafana"| graf
```

## 2. Que hace cada pieza

| Pieza | Que hace | Carpeta | Integrante |
|---|---|---|---|
| Consola web | Pantallas para el administrador: login, tenants, crear, detalle, planes, monitoreo | `web/` | 2 |
| API | Recibe los pedidos, valida la sesion y los permisos, y anota cada trabajo en la cola | `api/api.js`, `api/auth.js` | 1 |
| PostgreSQL | Base de la plataforma: planes, tenants, operaciones, despliegues, usuarios y alertas | `db/schema.sql` | 1 |
| Worker | Toma los trabajos pendientes y los ejecuta en segundo plano con el motor del tenant | `api/worker.js` | 1 |
| Motores | Crean y destruyen la infraestructura de un tenant. Todos cumplen el mismo contrato | `api/motor-*.js`, `contrato/` | 1 |
| Plantillas de infraestructura | Firewall y VM del tenant en OpenTofu, Pulumi y CloudFormation | `infra/` | 4 |
| AMI del tenant | Imagen con nginx, Node, MySQL y la app ya instalados | `packer/`, `ansible/` | 3 |
| Observabilidad | Prometheus, Grafana (tablero por tenant) y Alertmanager | `observabilidad/` | 5 |
| Seguridad y CI | 3 escaneres y pruebas de aislamiento en cada Pull Request | `.github/`, `tests/`, `security/` | 6 |

**Roles:** `admin_plataforma` ve y administra todos los tenants. `admin_tenant` solo ve y opera su propia institucion.

**Docker:** las VM de los tenants no usan Docker (Packer + Ansible). La VM de observabilidad si usa Docker Compose para levantar Prometheus, Grafana y Alertmanager juntos: es una unica VM de herramientas y asi se reutiliza la configuracion ya probada.

**Metricas de cada tenant:** `node_exporter` (9100), `mysqld_exporter` (9104) y un contador de la app (3000, entre nginx y el backend). El firewall solo abre esos puertos a la IP de Prometheus (`MONITORING_CIDR`).

## 3. Flujo: crear un tenant

```mermaid
sequenceDiagram
    autonumber
    actor A as Administrador
    participant C as Consola
    participant API as API
    participant DB as PostgreSQL
    participant W as Worker
    participant M as Motor (OpenTofu)
    participant AWS as AWS
    participant VM as VM del tenant

    A->>C: Llena el formulario (plan, id, contacto, entorno, motor)
    C->>API: POST /tenants (con token)
    API->>DB: Guarda el tenant (pendiente) y la operacion "crear"
    API-->>C: 202 recibido
    loop cada 2 segundos
        C->>API: GET /operaciones?tenant=id
        API-->>C: Estado y log
    end
    W->>DB: Toma la operacion pendiente
    W->>DB: Tenant pasa a "aprovisionando"
    W->>M: apply(tenant_id, plan, region)
    M->>AWS: Crea el security group y la VM desde la AMI
    AWS-->>VM: Primer arranque (cloud-init)
    VM->>VM: tenant-configure crea la base MySQL, su usuario y arranca la app
    M-->>W: instance_id, public_ip, url, versiones
    W->>DB: Tenant "activo" + guarda las versiones (RF-13)
    W->>DB: Operacion "completada"
    C-->>A: Muestra el tenant activo y su URL
```

Si un paso falla, la operacion queda `fallida` con su error y se puede **reintentar** (RF-12). OpenTofu guarda un state por tenant, asi el reintento no duplica recursos.

## 4. Flujo: suspender, reanudar y eliminar

```mermaid
flowchart LR
    s["Suspender"] -->|"worker: apaga la EC2"| sus["suspendido<br/>disco y datos se conservan"]
    sus --> r["Reanudar"] -->|"worker: enciende la EC2"| act["activo<br/>nueva IP publica"]
    e["Eliminar"] --> prev["Vista previa<br/>GET /eliminar/preview"]
    prev -->|"escribir el id para confirmar"| des["worker: destroy del motor"]
    des --> eli["eliminado<br/>la ficha queda como historial"]
```

## 5. Pendientes

| Pendiente | Que falta | Integrantes |
|---|---|---|
| Metricas de las VM | El codigo ya esta (rol `monitoreo` y `MONITORING_CIDR`). Falta construir la AMI nueva con Packer y probarlo con Prometheus en AWS | 3, 4 y 5 |
| Grafana en AWS | Desplegar la VM de observabilidad y conectar su URL a la consola (`VITE_GRAFANA_URL`) | 5 |
| Webhook de alertas | Alertmanager envia a `host.docker.internal:4000`, que solo funciona en la misma PC. Con Grafana en AWS debe apuntar a una direccion alcanzable de la API | 1 y 5 |
| State en S3 | Hoy esta en `api/workdir/<tenant_id>`. Moverlo a un bucket S3 cifrado y con bloqueo | 1 y 4 |
| Secretos en SSM | La clave inicial del admin del tenant viaja en `user_data` | 1 y 4 |
| Prueba en AWS real | Todo el flujo se probo con `ENGINE=fake` | Equipo |
