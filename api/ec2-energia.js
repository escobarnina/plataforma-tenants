// Suspender y reanudar una VM real de AWS con el AWS CLI (sin borrar nada).
// Una VM detenida no cobra computo, solo el disco. Al reanudar, AWS le asigna una IP publica nueva.

const { spawn } = require('child_process');

function aws(args, onLog) {
  return new Promise((resolve, reject) => {
    const proceso = spawn('aws', args, { shell: false });
    let salida = '';
    let error = '';
    proceso.stdout.on('data', (d) => { salida += d; });
    proceso.stderr.on('data', (d) => { error += d; });
    proceso.on('error', (e) => reject(new Error(`No se pudo ejecutar aws: ${e.message}`)));
    proceso.on('close', (codigo) => {
      if (codigo === 0) return resolve(salida.trim());
      onLog(`[aws] ERROR: ${error.trim().slice(0, 500)}`);
      reject(new Error(`aws ${args.slice(0, 2).join(' ')} fallo (codigo ${codigo})`));
    });
  });
}

function validar(tenant) {
  if (!/^i-[0-9a-f]{8,17}$/.test(tenant.instance_id || '')) {
    throw new Error('El tenant no tiene una instancia valida (instance_id)');
  }
  return ['--instance-ids', tenant.instance_id, '--region', tenant.region || 'us-east-1'];
}

async function suspender(tenant, onLog = () => {}) {
  const base = validar(tenant);
  onLog(`[aws] deteniendo ${tenant.instance_id}...`);
  await aws(['ec2', 'stop-instances', ...base, '--output', 'text'], onLog);
  await aws(['ec2', 'wait', 'instance-stopped', ...base], onLog);
  onLog('[aws] VM detenida');
}

async function reanudar(tenant, onLog = () => {}) {
  const base = validar(tenant);
  onLog(`[aws] encendiendo ${tenant.instance_id}...`);
  await aws(['ec2', 'start-instances', ...base, '--output', 'text'], onLog);
  await aws(['ec2', 'wait', 'instance-running', ...base], onLog);
  const ip = await aws(
    ['ec2', 'describe-instances', ...base, '--query', 'Reservations[0].Instances[0].PublicIpAddress', '--output', 'text'],
    onLog
  );
  onLog(`[aws] VM en marcha, IP ${ip}`);
  return { public_ip: ip, url: `http://${ip}` };
}

module.exports = { suspender, reanudar };
