// UNICO archivo que habla con la API de la plataforma.
// Si una ruta cambia en el contrato, se corrige solo aqui.
import * as mock from './mock.js';

const USAR_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function sesion() {
  try {
    return JSON.parse(localStorage.getItem('sesion')) || null;
  } catch {
    return null;
  }
}

async function pedir(metodo, ruta, cuerpo) {
  const s = sesion();
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(s?.token ? { Authorization: `Bearer ${s.token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || `Error ${res.status}`);
  return datos;
}

const qs = (filtros = {}) => {
  const p = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v));
  return p.toString() ? `?${p}` : '';
};

// TEMPORAL: login, previewEliminar y alertas usan el mock porque la API real
// aun no tiene esas rutas. Cuando el Integrante 1 las agregue, usar las lineas comentadas.
const real = {
  login: mock.login, // (usuario, clave) => pedir('POST', '/login', { usuario, clave }),
  planes: () => pedir('GET', '/planes'),
  tenants: (filtros) => pedir('GET', `/tenants${qs(filtros)}`),
  tenant: (id) => pedir('GET', `/tenants/${id}`),
  crearTenant: (datos) => pedir('POST', '/tenants', datos),
  suspender: (id) => pedir('POST', `/tenants/${id}/suspender`),
  reanudar: (id) => pedir('POST', `/tenants/${id}/reanudar`),
  // (id) => pedir('GET', `/tenants/${id}/eliminar/preview`),
  previewEliminar: async (id) => {
    const t = await pedir('GET', `/tenants/${id}`);
    const recursos = [`Firewall tenant-${t.id}-sg`];
    if (t.instance_id) recursos.unshift(`Servidor EC2 ${t.instance_id}`);
    if (t.public_ip) recursos.push(`IP publica ${t.public_ip}`);
    return { tenant_id: t.id, recursos, datos: ['Base de datos MySQL del tenant (usuarios, cursos y asistencia)'] };
  },
  eliminar: (id, confirmar) => pedir('POST', `/tenants/${id}/eliminar`, { confirmar }),
  operaciones: (tenant) => pedir('GET', `/operaciones${qs({ tenant })}`),
  operacion: (id) => pedir('GET', `/operaciones/${id}`),
  reintentar: (id) => pedir('POST', `/operaciones/${id}/reintentar`),
  alertas: mock.alertas, // (filtros) => pedir('GET', `/alertas${qs(filtros)}`),
};

export const api = USAR_MOCK ? mock : real;
export const modoMock = USAR_MOCK;
