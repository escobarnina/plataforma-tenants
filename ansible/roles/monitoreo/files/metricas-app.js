// Contador de metricas de la app (sin tocar Mi-asistencia).
// nginx -> este proxy (127.0.0.1:8001) -> backend (127.0.0.1:8000).
// Cuenta cada peticion a /api y publica las metricas para Prometheus en :3000/metrics:
//   http_requests_total{method,status}       peticiones por metodo y codigo de respuesta
//   http_request_duration_seconds{...}        histograma de latencia (p95/p99 en Grafana)
// Solo usa modulos de Node (sin npm).

const http = require('http');

const ESCUCHA = { host: '127.0.0.1', port: Number(process.env.PROXY_PORT || 8001) };
const BACKEND = { host: '127.0.0.1', port: Number(process.env.BACKEND_PORT || 8000) };
const METRICAS = { host: '0.0.0.0', port: Number(process.env.METRICS_PORT || 3000) };
const LIMITES = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]; // segundos

const peticiones = new Map(); // "GET|200" -> cantidad
const duraciones = new Map(); // "GET|200" -> { cubetas: [], suma, cuenta }

function registrar(metodo, codigo, segundos) {
  const clave = `${metodo}|${codigo}`;
  peticiones.set(clave, (peticiones.get(clave) || 0) + 1);
  let d = duraciones.get(clave);
  if (!d) {
    d = { cubetas: LIMITES.map(() => 0), suma: 0, cuenta: 0 };
    duraciones.set(clave, d);
  }
  LIMITES.forEach((limite, i) => { if (segundos <= limite) d.cubetas[i] += 1; });
  d.suma += segundos;
  d.cuenta += 1;
}

// Proxy: reenvia la peticion al backend y mide cuanto tarda.
http.createServer((req, res) => {
  const inicio = process.hrtime.bigint();
  const metodo = /^[A-Z]{3,7}$/.test(req.method) ? req.method : 'OTRO';
  let codigo = 502;
  res.on('finish', () => {
    const segundos = Number(process.hrtime.bigint() - inicio) / 1e9;
    registrar(metodo, codigo, segundos);
  });

  const haciaBackend = http.request(
    { ...BACKEND, method: req.method, path: req.url, headers: req.headers },
    (respuesta) => {
      codigo = respuesta.statusCode;
      res.writeHead(respuesta.statusCode, respuesta.headers);
      respuesta.pipe(res);
    }
  );
  haciaBackend.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end('{"error":"El backend no responde"}');
  });
  req.pipe(haciaBackend);
}).listen(ESCUCHA.port, ESCUCHA.host);

// Formato de texto de Prometheus.
function texto() {
  const lineas = [
    '# HELP http_requests_total Peticiones a la API de la app',
    '# TYPE http_requests_total counter',
  ];
  for (const [clave, n] of peticiones) {
    const [metodo, codigo] = clave.split('|');
    lineas.push(`http_requests_total{method="${metodo}",status="${codigo}"} ${n}`);
  }
  lineas.push(
    '# HELP http_request_duration_seconds Tiempo de respuesta de la API de la app',
    '# TYPE http_request_duration_seconds histogram'
  );
  for (const [clave, d] of duraciones) {
    const [metodo, codigo] = clave.split('|');
    const et = `method="${metodo}",status="${codigo}"`;
    LIMITES.forEach((limite, i) => lineas.push(`http_request_duration_seconds_bucket{${et},le="${limite}"} ${d.cubetas[i]}`));
    lineas.push(`http_request_duration_seconds_bucket{${et},le="+Inf"} ${d.cuenta}`);
    lineas.push(`http_request_duration_seconds_sum{${et}} ${d.suma}`);
    lineas.push(`http_request_duration_seconds_count{${et}} ${d.cuenta}`);
  }
  return `${lineas.join('\n')}\n`;
}

// Endpoint de metricas. El firewall solo deja entrar a Prometheus a este puerto.
http.createServer((req, res) => {
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    return res.end(texto());
  }
  res.writeHead(404);
  res.end();
}).listen(METRICAS.port, METRICAS.host);

console.log(`Contador listo: proxy ${ESCUCHA.port} -> backend ${BACKEND.port}, metricas en :${METRICAS.port}/metrics`);
