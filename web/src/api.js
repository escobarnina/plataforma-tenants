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

const real = {
  login: (usuario, clave) => pedir('POST', '/login', { usuario, clave }),
  planes: () => pedir('GET', '/planes'),
  tenants: (filtros) => pedir('GET', `/tenants${qs(filtros)}`),
  tenant: (id) => pedir('GET', `/tenants/${id}`),
  crearTenant: (datos) => pedir('POST', '/tenants', datos),
  suspender: (id) => pedir('POST', `/tenants/${id}/suspender`),
  reanudar: (id) => pedir('POST', `/tenants/${id}/reanudar`),
  previewEliminar: (id) => pedir('GET', `/tenants/${id}/eliminar/preview`),
  eliminar: (id, confirmar) => pedir('POST', `/tenants/${id}/eliminar`, { confirmar }),
  operaciones: (tenant) => pedir('GET', `/operaciones${qs({ tenant })}`),
  operacion: (id) => pedir('GET', `/operaciones/${id}`),
  reintentar: (id) => pedir('POST', `/operaciones/${id}/reintentar`),
  alertas: (filtros) => pedir('GET', `/alertas${qs(filtros)}`),
};

export const api = USAR_MOCK ? mock : real;
export const modoMock = USAR_MOCK;
