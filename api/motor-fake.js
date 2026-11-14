// Motor falso: simula crear y borrar un tenant sin tocar AWS.
// Devuelve exactamente la misma forma que el motor real (contrato de salida).
// Para simular una falla, crea un archivo vacio llamado falla.txt junto a este archivo.

const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function apply(tenant, onLog = () => {}) {
  onLog(`[fake] creando tenant ${tenant.tenant_id}...`);
  await sleep(1000);

  if (fs.existsSync(path.join(__dirname, 'falla.txt'))) {
    onLog('[fake] ERROR: no se pudo crear la VM (falla simulada)');
    throw new Error('Fallo simulado: borra falla.txt y reintenta la operacion');
  }

  await sleep(1000);
  onLog('[fake] firewall creado');
  await sleep(2000);
  onLog('[fake] VM lanzada');

  const sufijo = Math.random().toString(16).slice(2, 10);
  return {
    tenant_id: tenant.tenant_id,
    instance_id: `i-fake${sufijo}`,
    public_ip: '10.0.0.1',
    url: 'http://10.0.0.1',
    versiones: { app: '1.0.0', plantilla: '0.1.0', motor: 'fake' },
  };
}

async function destroy(tenant, onLog = () => {}) {
  onLog(`[fake] eliminando tenant ${tenant.tenant_id}...`);
  await sleep(2000);
  onLog('[fake] recursos eliminados');
}

async function suspender(tenant, onLog = () => {}) {
  onLog(`[fake] apagando VM de ${tenant.tenant_id}...`);
  await sleep(1500);
  onLog('[fake] VM detenida');
}

async function reanudar(tenant, onLog = () => {}) {
  onLog(`[fake] encendiendo VM de ${tenant.tenant_id}...`);
  await sleep(2000);
  onLog('[fake] VM en marcha');
  return { public_ip: '10.0.0.1', url: 'http://10.0.0.1' };
}

module.exports = { apply, destroy, suspender, reanudar };
