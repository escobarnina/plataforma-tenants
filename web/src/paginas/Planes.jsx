// Catalogo de planes, solo consulta (RF-01, RF-02). Editarlos esta fuera de alcance (RF-04 tachado).
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Error } from '../comun.jsx';

export const RESPALDO = { basico: 'Respaldo semanal', estandar: 'Respaldo diario', avanzado: 'Respaldo diario + retencion' };
export const DESCRIPCION = { basico: 'Para instituciones pequenas', estandar: 'Para instituciones en crecimiento', avanzado: 'Para alta demanda' };

export function TarjetaPlan({ plan, seleccionado, onClick }) {
  return (
    <div className={`plan ${seleccionado ? 'sel' : ''} ${onClick ? 'clic' : ''}`} onClick={onClick}>
      <div className="plan-titulo">
        <strong>{plan.nombre}</strong>
        {seleccionado && <span className="chip">SELECCIONADO</span>}
      </div>
      <p className="sub">{DESCRIPCION[plan.id]}</p>
      <ul>
        <li>Hasta {plan.capacidad_estudiantes.toLocaleString('es')} estudiantes</li>
        <li>Base de datos: {plan.db_volume_gb} GB</li>
        <li>{RESPALDO[plan.id] || 'Respaldo'}</li>
        <li>Servidor {plan.instance_type} ({plan.nube.toUpperCase()})</li>
      </ul>
    </div>
  );
}

export default function Planes() {
  const [planes, setPlanes] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api.planes().then(setPlanes).catch((e) => setError(e.message)); }, []);

  return (
    <>
      <h1>Planes</h1>
      <p className="sub">Cada plan define el tamano del servidor y la base de datos de cada tenant.</p>
      <Error mensaje={error} />
      <div className="planes">{planes.map((p) => <TarjetaPlan key={p.id} plan={p} />)}</div>
    </>
  );
}
