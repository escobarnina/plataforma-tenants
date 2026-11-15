// Lista de tenants con filtros por nombre, estado, plan y entorno (RF-14).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ENTORNOS, ESTADOS, Estado, fecha, Error, useRepetir } from '../comun.jsx';

export default function Tenants() {
  const [filtros, setFiltros] = useState({ nombre: '', estado: '', plan: '', entorno: '' });
  const [tenants, setTenants] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [error, setError] = useState('');

  const cargar = () => api.tenants(filtros).then(setTenants).catch((e) => setError(e.message));

  useEffect(() => { api.planes().then(setPlanes).catch(() => {}); }, []);
  useEffect(() => { cargar(); }, [filtros]);
  // Si hay tenants en proceso, refresca cada 3 s para ver el cambio de estado.
  useRepetir(cargar, 3000, tenants.some((t) => ['pendiente', 'aprovisionando', 'eliminando'].includes(t.estado)));

  const cambiar = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.value });

  return (
    <>
      <div className="cabecera">
        <div>
          <h1>Tenants</h1>
          <p className="sub">Instituciones registradas en la plataforma</p>
        </div>
        <Link className="boton primario" to="/tenants/nuevo">+ Crear tenant</Link>
      </div>
      <div className="tarjeta filtros">
        <input placeholder="Buscar por nombre..." value={filtros.nombre} onChange={cambiar('nombre')} />
        <select value={filtros.estado} onChange={cambiar('estado')}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filtros.plan} onChange={cambiar('plan')}>
          <option value="">Todos los planes</option>
          {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select value={filtros.entorno} onChange={cambiar('entorno')}>
          <option value="">Todos los entornos</option>
          {ENTORNOS.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </div>
      <Error mensaje={error} />
      <div className="tarjeta">
        <table>
          <thead>
            <tr><th>Institucion</th><th>Plan</th><th>Entorno</th><th>Motor</th><th>Estado</th><th>Creado</th></tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td><Link to={`/tenants/${t.id}`}><strong>{t.nombre}</strong></Link><br /><small>{t.id}</small></td>
                <td>{t.plan_id}</td>
                <td>{t.entorno}</td>
                <td>{t.motor}</td>
                <td><Estado valor={t.estado} /></td>
                <td>{fecha(t.creado_en)}</td>
              </tr>
            ))}
            {tenants.length === 0 && <tr><td colSpan="6" className="sub">No hay tenants con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
