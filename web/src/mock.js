// API FALSA: imita las rutas de la API real (mismos nombres de campos que db/schema.sql)
// para trabajar sin depender del Integrante 1. Los datos viven en memoria.
// Truco para la demo: si el id del tenant contiene "falla", la creacion falla la primera vez.

const espera = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const ahora = () => new Date().toISOString();
const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
const copia = (x) => JSON.parse(JSON.stringify(x));

const usuarios = [
  { usuario: 'admin', clave: 'admin', rol: 'admin_plataforma' },
  { usuario: 'san-marcos', clave: 'san-marcos', rol: 'admin_tenant', tenant_id: 'san-marcos' },
];

const planes = [
  { id: 'basico', nombre: 'Basico', instance_type: 't3.micro', db_volume_gb: 10, capacidad_estudiantes: 100, nube: 'aws' },
  { id: 'estandar', nombre: 'Estandar', instance_type: 't3.small', db_volume_gb: 50, capacidad_estudiantes: 1000, nube: 'aws' },
  { id: 'avanzado', nombre: 'Avanzado', instance_type: 't3.medium', db_volume_gb: 200, capacidad_estudiantes: 5000, nube: 'aws' },
];

const base = (t) => ({
  region: 'us-east-1', zona_horaria: 'America/La_Paz', datos_ejemplo: true,
  instance_id: null, public_ip: null, url: null, ...t,
});

const tenants = [
  base({ id: 'san-marcos', nombre: 'Instituto San Marcos', contacto: 'admin@sanmarcos.edu', entorno: 'produccion', plan_id: 'estandar', motor: 'opentofu', estado: 'activo', instance_id: 'i-0a1b2c3d', public_ip: '3.85.10.20', url: 'http://3.85.10.20', creado_en: hace(3000), actualizado_en: hace(2990) }),
  base({ id: 'andes', nombre: 'Colegio Andes', contacto: 'dir@andes.edu', entorno: 'pruebas', plan_id: 'basico', motor: 'opentofu', estado: 'suspendido', instance_id: 'i-0e5f6a7b', public_ip: '54.12.9.33', url: 'http://54.12.9.33', creado_en: hace(2000), actualizado_en: hace(60) }),
  base({ id: 'norte', nombre: 'Escuela Norte', contacto: 'ti@norte.edu', entorno: 'produccion', plan_id: 'avanzado', motor: 'pulumi', estado: 'fallido', creado_en: hace(90), actualizado_en: hace(85) }),
];

let sigOp = 4;
const operaciones = [
  { id: 1, tenant_id: 'san-marcos', tipo: 'crear', estado: 'completada', intentos: 1, log: 'tofu init\nPlan: 3 to add, 0 to change, 0 to destroy.\nApply complete! Resources: 3 added.\n', error: null, creada_en: hace(3000), iniciada_en: hace(3000), terminada_en: hace(2990) },
  { id: 2, tenant_id: 'andes', tipo: 'suspender', estado: 'completada', intentos: 1, log: 'Deteniendo instancia i-0e5f6a7b...\nInstancia detenida. Disco y BD conservados.\n', error: null, creada_en: hace(61), iniciada_en: hace(61), terminada_en: hace(60) },
  { id: 3, tenant_id: 'norte', tipo: 'crear', estado: 'fallida', intentos: 1, log: 'pulumi up\nCreating aws:ec2:Instance...\n', error: 'No hay capacidad para t3.medium en la zona elegida. Reintenta en unos minutos.', creada_en: hace(90), iniciada_en: hace(90), terminada_en: hace(85) },
];

const deploymentsVersion = { app: '1.0.0', plantilla: 'tenant-server 0.1.0' };

const alertas = [
  { id: 1, tenant_id: 'san-marcos', nombre: 'CPU alta', severidad: 'warning', estado: 'activa', detalle: 'CPU sobre 80 % por 5 minutos', detectada_en: hace(12) },
  { id: 2, tenant_id: 'norte', nombre: 'Servicio caido', severidad: 'critical', estado: 'activa', detalle: 'Sin respuesta por 2 minutos', detectada_en: hace(80) },
  { id: 3, tenant_id: 'andes', nombre: 'Disco alto', severidad: 'warning', estado: 'resuelta', detalle: 'Disco sobre 85 %', detectada_en: hace(500) },
];

let sesionActual = null;
const error = (msg) => { throw new Error(msg); };
const buscarTenant = (id) => tenants.find((t) => t.id === id) || error('Tenant no encontrado');
const visible = (t) => !sesionActual || sesionActual.rol === 'admin_plataforma' || t.id === sesionActual.tenant_id;

// Simula al worker: escribe el log poco a poco y cambia estados.
function ejecutar(op) {
  const t = buscarTenant(op.tenant_id);
  const plan = planes.find((p) => p.id === t.plan_id);
  const pasos = {
    crear: [`${t.motor} init`, `Plan: 3 to add, 0 to change, 0 to destroy.`, `Creando security group tenant-${t.id}-sg...`, `Creando instancia ${plan.instance_type}...`, 'Esperando que la app responda en /health...'],
    suspender: [`Deteniendo instancia ${t.instance_id}...`, 'Instancia detenida. Disco y BD conservados.'],
    reanudar: [`Iniciando instancia ${t.instance_id}...`, 'Instancia en ejecucion. /health OK.'],
    eliminar: [`${t.motor} destroy`, 'Destroy complete! Resources: 3 destroyed.'],
  }[op.tipo];
  const falla = op.tipo === 'crear' && t.id.includes('falla') && op.intentos === 1;

  op.estado = 'en_curso'; op.iniciada_en = ahora(); op.terminada_en = null; op.error = null;
  if (op.tipo === 'crear') t.estado = 'aprovisionando';

  let i = 0;
  const tic = setInterval(() => {
    if (falla && i === 3) {
      clearInterval(tic);
      op.log += 'Error: InsufficientInstanceCapacity\n';
      op.estado = 'fallida'; op.terminada_en = ahora();
      op.error = 'AWS no tiene capacidad para ese tipo de instancia ahora. Reintenta la operacion.';
      t.estado = 'fallido'; t.actualizado_en = ahora();
      return;
    }
    if (i < pasos.length) { op.log += pasos[i++] + '\n'; return; }
    clearInterval(tic);
    op.estado = 'completada'; op.terminada_en = ahora(); t.actualizado_en = ahora();
    if (op.tipo === 'crear') {
      const ip = `3.${10 + tenants.length}.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
      Object.assign(t, { estado: 'activo', instance_id: `i-${Math.random().toString(16).slice(2, 10)}`, public_ip: ip, url: `http://${ip}` });
      op.log += `Apply complete! Version app ${deploymentsVersion.app}, plantilla ${deploymentsVersion.plantilla}\n`;
    }
    if (op.tipo === 'suspender') t.estado = 'suspendido';
    if (op.tipo === 'reanudar') t.estado = 'activo';
    if (op.tipo === 'eliminar') Object.assign(t, { estado: 'eliminado', instance_id: null, public_ip: null, url: null });
  }, 1200);
}

function encolar(tenant_id, tipo) {
  const op = { id: sigOp++, tenant_id, tipo, estado: 'pendiente', intentos: 1, log: '', error: null, creada_en: ahora(), iniciada_en: null, terminada_en: null };
  operaciones.push(op);
  setTimeout(() => ejecutar(op), 800);
  return op;
}

const ocupado = (id) => operaciones.some((o) => o.tenant_id === id && ['pendiente', 'en_curso'].includes(o.estado));

// ---- Mismas funciones que src/api.js ----

export async function login(usuario, clave) {
  await espera();
  const u = usuarios.find((x) => x.usuario === usuario && x.clave === clave);
  if (!u) error('Usuario o clave incorrectos');
  sesionActual = { token: `falso-${u.usuario}`, rol: u.rol, tenant_id: u.tenant_id };
  return copia(sesionActual);
}

export function restaurarSesion(s) { sesionActual = s; }

export async function planes_() { await espera(); return copia(planes); }
export { planes_ as planes };

export async function tenants_(f = {}) {
  await espera();
  return copia(
    tenants
      .filter(visible)
      .filter((t) => !f.nombre || t.nombre.toLowerCase().includes(f.nombre.toLowerCase()))
      .filter((t) => !f.estado || t.estado === f.estado)
      .filter((t) => !f.plan || t.plan_id === f.plan)
      .filter((t) => !f.entorno || t.entorno === f.entorno)
      .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
  );
}
export { tenants_ as tenants };

export async function tenant(id) {
  await espera();
  const t = buscarTenant(id);
  if (!visible(t)) error('No tienes permiso para ver este tenant');
  return copia(t);
}

export async function crearTenant(b) {
  await espera();
  const faltan = ['id', 'nombre', 'contacto', 'plan', 'entorno', 'motor'].filter((c) => !b[c]);
  if (faltan.length) error(`Faltan campos: ${faltan.join(', ')}`);
  if (!/^[a-z0-9-]{3,30}$/.test(b.id)) error('Datos invalidos: revisa id, plan, motor y entorno');
  if (tenants.some((t) => t.id === b.id)) error('Ya existe un tenant con ese id');
  const t = base({
    id: b.id, nombre: b.nombre, contacto: b.contacto, region: b.region || 'us-east-1', entorno: b.entorno,
    plan_id: b.plan, motor: b.motor, zona_horaria: b.zona_horaria || 'America/La_Paz',
    datos_ejemplo: b.datos_ejemplo !== false, estado: 'pendiente', creado_en: ahora(), actualizado_en: ahora(),
  });
  tenants.push(t);
  const operacion = encolar(t.id, 'crear');
  return copia({ tenant: t, operacion });
}

function energia(accion, requerido) {
  return async (id) => {
    await espera();
    const t = buscarTenant(id);
    if (t.estado !== requerido) error(`Solo se puede ${accion} un tenant en estado ${requerido} (estado actual: ${t.estado})`);
    if (ocupado(id)) error('El tenant ya tiene una operacion en curso');
    return copia({ operacion: encolar(id, accion) });
  };
}
export const suspender = energia('suspender', 'activo');
export const reanudar = energia('reanudar', 'suspendido');

export async function previewEliminar(id) {
  await espera();
  const t = buscarTenant(id);
  const recursos = [`Firewall tenant-${t.id}-sg`];
  if (t.instance_id) recursos.unshift(`Servidor EC2 ${t.instance_id}`);
  if (t.public_ip) recursos.push(`IP publica ${t.public_ip}`);
  return { tenant_id: t.id, recursos, datos: ['Base de datos MySQL del tenant (usuarios, cursos y asistencia)'] };
}

export async function eliminar(id, confirmar) {
  await espera();
  const t = buscarTenant(id);
  if (confirmar !== id) error('Para confirmar, envia "confirmar" con el id del tenant');
  if (['eliminando', 'eliminado'].includes(t.estado)) error('El tenant ya se esta eliminando o fue eliminado');
  t.estado = 'eliminando';
  return copia({ operacion: encolar(id, 'eliminar') });
}

export async function operaciones_(tenantId) {
  await espera(150);
  const lista = tenantId ? operaciones.filter((o) => o.tenant_id === tenantId) : operaciones.slice(-50);
  return copia([...lista].reverse());
}
export { operaciones_ as operaciones };

export async function operacion(id) {
  await espera(150);
  return copia(operaciones.find((o) => o.id === Number(id)) || error('Operacion no encontrada'));
}

export async function reintentar(id) {
  await espera();
  const op = operaciones.find((o) => o.id === Number(id));
  if (!op || op.estado !== 'fallida') error('Solo se pueden reintentar operaciones fallidas');
  op.estado = 'pendiente'; op.intentos += 1; op.log += '\n--- reintento ---\n';
  setTimeout(() => ejecutar(op), 800);
  return copia(op);
}

export async function alertas_(f = {}) {
  await espera();
  return copia(
    alertas
      .filter((a) => !f.tenant || a.tenant_id === f.tenant)
      .filter((a) => !f.estado || a.estado === f.estado)
      .filter((a) => visible({ id: a.tenant_id }))
      .sort((a, b) => b.detectada_en.localeCompare(a.detectada_en))
  );
}
export { alertas_ as alertas };
