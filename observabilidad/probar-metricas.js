// Servidor simulador de 2 tenants con endpoints de metricas para probar Grafana y Prometheus
// sin necesidad de encender VMs en AWS.
//
// Tenant 1: "san-marcos" (plan estandar, produccion)
//   - App /metrics en puerto 3000
//   - node_exporter en puerto 9100
//   - mysqld_exporter en puerto 9104
//
// Tenant 2: "norte" (plan basico, desarrollo)
//   - App /metrics en puerto 3001
//   - node_exporter en puerto 9101
//   - mysqld_exporter en puerto 9105

const http = require('http');

let requestCountSM = 120;
let requestCountNorte = 45;
let cpuSecsSM = 500;
let cpuSecsNorte = 200;

function generarMetricasApp(tenantId, entorno, reqCount, errorRatio = 0.02) {
  const req5xx = Math.floor(reqCount * errorRatio);
  const req2xx = reqCount - req5xx;

  return `# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{tenant_id="${tenantId}",entorno="${entorno}",status="200"} ${req2xx}
http_requests_total{tenant_id="${tenantId}",entorno="${entorno}",status="500"} ${req5xx}

# HELP http_request_duration_seconds_bucket Latency histogram
# TYPE http_request_duration_seconds_bucket histogram
http_request_duration_seconds_bucket{le="0.05",tenant_id="${tenantId}",entorno="${entorno}"} ${Math.floor(reqCount * 0.6)}
http_request_duration_seconds_bucket{le="0.1",tenant_id="${tenantId}",entorno="${entorno}"} ${Math.floor(reqCount * 0.85)}
http_request_duration_seconds_bucket{le="0.2",tenant_id="${tenantId}",entorno="${entorno}"} ${Math.floor(reqCount * 0.95)}
http_request_duration_seconds_bucket{le="0.5",tenant_id="${tenantId}",entorno="${entorno}"} ${Math.floor(reqCount * 0.99)}
http_request_duration_seconds_bucket{le="+Inf",tenant_id="${tenantId}",entorno="${entorno}"} ${reqCount}
http_request_duration_seconds_sum{tenant_id="${tenantId}",entorno="${entorno}"} ${reqCount * 0.08}
http_request_duration_seconds_count{tenant_id="${tenantId}",entorno="${entorno}"} ${reqCount}
`;
}

function generarMetricasNode(tenantId, entorno, cpuIdle, ramUsedPercent, diskUsedPercent) {
  const totalRam = 2 * 1024 * 1024 * 1024;
  const availRam = totalRam * (1 - ramUsedPercent);
  const totalDisk = 50 * 1024 * 1024 * 1024;
  const freeDisk = totalDisk * (1 - diskUsedPercent);

  return `# HELP node_cpu_seconds_total Seconds the CPUs spent in each mode.
# TYPE node_cpu_seconds_total counter
node_cpu_seconds_total{cpu="0",mode="idle",tenant_id="${tenantId}",entorno="${entorno}"} ${cpuIdle}
node_cpu_seconds_total{cpu="0",mode="user",tenant_id="${tenantId}",entorno="${entorno}"} 150.5
node_cpu_seconds_total{cpu="0",mode="system",tenant_id="${tenantId}",entorno="${entorno}"} 45.2

# HELP node_memory_MemTotal_bytes Memory information field MemTotal_bytes.
# TYPE node_memory_MemTotal_bytes gauge
node_memory_MemTotal_bytes{tenant_id="${tenantId}",entorno="${entorno}"} ${totalRam}
# HELP node_memory_MemAvailable_bytes Memory information field MemAvailable_bytes.
# TYPE node_memory_MemAvailable_bytes gauge
node_memory_MemAvailable_bytes{tenant_id="${tenantId}",entorno="${entorno}"} ${availRam}

# HELP node_filesystem_size_bytes Filesystem size in bytes.
# TYPE node_filesystem_size_bytes gauge
node_filesystem_size_bytes{mountpoint="/",tenant_id="${tenantId}",entorno="${entorno}"} ${totalDisk}
# HELP node_filesystem_free_bytes Filesystem free space in bytes.
# TYPE node_filesystem_free_bytes gauge
node_filesystem_free_bytes{mountpoint="/",tenant_id="${tenantId}",entorno="${entorno}"} ${freeDisk}

# HELP node_network_receive_bytes_total Network device statistic receive_bytes.
# TYPE node_network_receive_bytes_total counter
node_network_receive_bytes_total{device="eth0",tenant_id="${tenantId}",entorno="${entorno}"} 123456789
# HELP node_network_transmit_bytes_total Network device statistic transmit_bytes.
# TYPE node_network_transmit_bytes_total counter
node_network_transmit_bytes_total{device="eth0",tenant_id="${tenantId}",entorno="${entorno}"} 987654321
`;
}

function generarMetricasMySQL(tenantId, entorno, connections, qps) {
  return `# HELP mysql_up Whether the MySQL server is up.
# TYPE mysql_up gauge
mysql_up{tenant_id="${tenantId}",entorno="${entorno}"} 1

# HELP mysql_global_status_threads_connected Currently open connections
# TYPE mysql_global_status_threads_connected gauge
mysql_global_status_threads_connected{tenant_id="${tenantId}",entorno="${entorno}"} ${connections}

# HELP mysql_global_status_queries The number of statements executed by the server.
# TYPE mysql_global_status_queries counter
mysql_global_status_queries{tenant_id="${tenantId}",entorno="${entorno}"} ${qps * 3600}

# HELP mysql_global_status_innodb_page_size InnoDB page size in bytes.
# TYPE mysql_global_status_innodb_page_size gauge
mysql_global_status_innodb_page_size{tenant_id="${tenantId}",entorno="${entorno}"} 16384

# HELP mysql_global_status_buffer_pool_pages_data The number of pages in the InnoDB buffer pool containing data.
# TYPE mysql_global_status_buffer_pool_pages_data gauge
mysql_global_status_buffer_pool_pages_data{tenant_id="${tenantId}",entorno="${entorno}"} 65536
`;
}

function crearServidor(puerto, getContenido) {
  const server = http.createServer((req, res) => {
    if (req.url === '/metrics' || req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      res.end(getContenido());
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  server.listen(puerto, () => console.log(`Simulador escuchando en puerto ${puerto}`));
  return server;
}

// Incrementa contadores periodicamente para graficos en tiempo real
setInterval(() => {
  requestCountSM += Math.floor(Math.random() * 15) + 5;
  requestCountNorte += Math.floor(Math.random() * 8) + 2;
  cpuSecsSM += 10;
  cpuSecsNorte += 10;
}, 5000);

console.log('=== Iniciando Exporters Simulados para Pruebas de Observabilidad ===');

// Tenant 1: san-marcos (App en 3002 para no chocar con el Grafana de Windows en 3000)
crearServidor(3002, () => generarMetricasApp('san-marcos', 'produccion', requestCountSM, 0.01));
crearServidor(9100, () => generarMetricasNode('san-marcos', 'produccion', cpuSecsSM, 0.45, 0.60));
crearServidor(9104, () => generarMetricasMySQL('san-marcos', 'produccion', 12, 85));

// Tenant 2: norte (provoca intencionalmente alerta de disco > 85%)
crearServidor(3001, () => generarMetricasApp('norte', 'desarrollo', requestCountNorte, 0.08));
crearServidor(9101, () => generarMetricasNode('norte', 'desarrollo', cpuSecsNorte, 0.88, 0.86)); // Disco > 85% para disparar alerta de ejemplo
crearServidor(9105, () => generarMetricasMySQL('norte', 'desarrollo', 4, 25));

console.log('Simuladores activos.');
console.log('Grafana (Docker):     http://localhost:3030');
console.log('Prometheus:           http://localhost:9090');
console.log('Alertmanager:         http://localhost:9093');
