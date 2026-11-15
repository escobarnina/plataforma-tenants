// Piezas reutilizadas por varias pantallas.
import { useEffect, useRef } from 'react';

export const ESTADOS = ['pendiente', 'aprovisionando', 'activo', 'suspendido', 'fallido', 'eliminando', 'eliminado'];
export const ENTORNOS = [
  { id: 'produccion', nombre: 'Produccion' },
  { id: 'pruebas', nombre: 'Pruebas' },
];
export const MOTORES = [
  { id: 'opentofu', nombre: 'OpenTofu' },
  { id: 'pulumi', nombre: 'Pulumi' },
  { id: 'cloudformation', nombre: 'CloudFormation' },
];
export const REGIONES = [{ id: 'us-east-1', nombre: 'EE. UU. Este (N. Virginia)' }];

const TEXTO_ESTADO = {
  pendiente: 'Pendiente', aprovisionando: 'Configurando', activo: 'En linea', suspendido: 'Suspendido',
  fallido: 'Fallido', eliminando: 'Eliminando', eliminado: 'Eliminado',
  en_curso: 'En curso', completada: 'Completada', fallida: 'Fallida', activa: 'Activa', resuelta: 'Resuelta',
};

export function Estado({ valor }) {
  return <span className={`estado e-${valor}`}>{TEXTO_ESTADO[valor] || valor}</span>;
}

export const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es') : '—');

// Ejecuta fn cada `ms` milisegundos mientras `activo` sea true (para ver el progreso).
export function useRepetir(fn, ms, activo) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [ms, activo]);
}

export function Error({ mensaje }) {
  return mensaje ? <div className="error">{mensaje}</div> : null;
}
