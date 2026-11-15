// Autenticacion de la consola: claves cifradas con scrypt y tokens firmados con HMAC.
// Solo usa el modulo crypto de Node (sin librerias externas).

require('dotenv').config();
const crypto = require('crypto');

const HORAS = Number(process.env.TOKEN_HORAS || 8);
let SECRETO = process.env.AUTH_SECRET;
if (!SECRETO) {
  // Sin AUTH_SECRET se genera uno al azar: funciona, pero las sesiones se pierden al reiniciar la API.
  SECRETO = crypto.randomBytes(32).toString('hex');
  console.warn('Aviso: falta AUTH_SECRET en .env; las sesiones se cerraran al reiniciar la API.');
}

// --- Claves ---
function cifrarClave(clave) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(clave, sal, 64).toString('hex');
  return `scrypt$${sal}$${hash}`;
}

function claveCorrecta(clave, guardada) {
  const [tipo, sal, hash] = String(guardada).split('$');
  if (tipo !== 'scrypt' || !sal || !hash) return false;
  const calculado = crypto.scryptSync(clave, sal, 64);
  const esperado = Buffer.from(hash, 'hex');
  return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
}

// --- Tokens: base64url(datos).base64url(firma) ---
const b64 = (texto) => Buffer.from(texto).toString('base64url');
const firmar = (datos) => crypto.createHmac('sha256', SECRETO).update(datos).digest('base64url');

function crearToken(usuario) {
  const datos = b64(JSON.stringify({
    usuario: usuario.usuario,
    rol: usuario.rol,
    tenant_id: usuario.tenant_id || null,
    vence: Date.now() + HORAS * 3600 * 1000,
  }));
  return `${datos}.${firmar(datos)}`;
}

function leerToken(token) {
  const [datos, firma] = String(token || '').split('.');
  if (!datos || !firma) return null;
  const esperada = firmar(datos);
  if (firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) {
    return null;
  }
  try {
    const sesion = JSON.parse(Buffer.from(datos, 'base64url').toString());
    return sesion.vence > Date.now() ? sesion : null;
  } catch {
    return null;
  }
}

// --- Middlewares de Express ---
// Exige un token valido en "Authorization: Bearer <token>" y deja la sesion en req.sesion.
function requiereSesion(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  const sesion = tipo === 'Bearer' ? leerToken(token) : null;
  if (!sesion) return res.status(401).json({ error: 'Sesion invalida o vencida. Vuelve a iniciar sesion.' });
  req.sesion = sesion;
  next();
}

// Solo el administrador de la plataforma.
function soloPlataforma(req, res, next) {
  if (req.sesion.rol !== 'admin_plataforma') {
    return res.status(403).json({ error: 'Solo el administrador de la plataforma puede hacer esto' });
  }
  next();
}

// true si la sesion puede ver o tocar ese tenant.
const puedeVer = (sesion, tenantId) => sesion.rol === 'admin_plataforma' || sesion.tenant_id === tenantId;

module.exports = { cifrarClave, claveCorrecta, crearToken, leerToken, requiereSesion, soloPlataforma, puedeVer };
