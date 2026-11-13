# Observabilidad (Integrante 5 - rama `i5-observabilidad`)

Implementación completa de monitoreo, métricas, dashboards y alertas para la plataforma multi-tenant (RF-25 a RF-29).

## Características Implementadas
- **Grafana + Prometheus + Alertmanager**: Configuración declarativa e infraestructura como código (`infra/main.tf` con OpenTofu).
- **Métricas completas (RF-26)**:
  - Disponibilidad y salud del backend (HTTP 200, latencia p95/p99, tasa errores 5xx).
  - Recursos del servidor EC2 con `node_exporter` (CPU, memoria RAM, disco y red RX/TX).
  - Estado de base de datos MySQL con `mysqld_exporter` (conexiones activas, QPS, datos InnoDB).
- **Filtros por tenant y entorno (RF-27)**: Variables dinámicas en Grafana `$tenant` y `$entorno` que permiten aislar métricas de cualquier tenant o ver todos (`All`).
- **Alertas operativas (RF-28)**: Reglas en Prometheus para tenant sin respuesta (2m), base de datos caída, CPU > 80 %, disco > 85 % y tasa 5xx > 5 %.
- **Integración con Plataforma (RF-29)**: Alertmanager despacha alertas vía webhook a la API (`POST /alertas/webhook`), guardándolas en la tabla `alerts` de la plataforma para ser visualizadas en la consola web en tiempo real.
- **Registro dinámico de objetivos (`file_sd`)**: La plataforma sincroniza automáticamente los tenants aprovisionados en `prometheus/targets/tenants.json`.

---

## Cómo correr y probar sola (sin AWS)

Sigue estos pasos rápidos para ensayar la observabilidad de forma autónoma:

1. **Levantar los servicios de observabilidad con Docker Compose**:
   ```bash
   cd observabilidad
   docker compose up -d
   ```
2. **Levantar los exporters simulados con 2 tenants de prueba** (san-marcos y norte):
   ```bash
   node probar-metricas.js
   ```
3. **Abrir Grafana**:
   - URL: [http://localhost:3030](http://localhost:3030) (Usuario: `admin`, Clave: `admin` o acceso anónimo).
   - Abre el dashboard preconfigurado: **"Salud y Rendimiento de Tenants"** en la carpeta `Tenants`.
   - Utiliza los selectores desplegables superiores de `Tenant` y `Entorno` para filtrar las métricas.
4. **Abrir Prometheus y Alertmanager**:
   - Prometheus: [http://localhost:9090](http://localhost:9090) (pestaña Status -> Targets para ver los objetivos).
   - Alertmanager: [http://localhost:9093](http://localhost:9093).
5. **Conectar con la consola Web**:
   - En el archivo `web/.env`, establece:
     ```env
     VITE_GRAFANA_URL=http://localhost:3030/d/tenants-overview/salud-y-rendimiento-de-tenants
     ```
   - Al navegar a la sección **Monitoreo** en la consola web, el dashboard cargará incrustado y sincronizado.
