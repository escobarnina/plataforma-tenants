// Monitoreo: Grafana incrustado (RF-25 a RF-27) y alertas recientes (RF-29).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ENTORNOS, Estado, fecha, Error, useRepetir } from '../comun.jsx';

const GRAFANA = import.meta.env.VITE_GRAFANA_URL || '';

export default function Monitoreo({ tenantFijo }) {
  const [tenants, setTenants] = useState([]);
  const [tenant, setTenant] = useState(tenantFijo || '');
  const [entorno, setEntorno] = useState('');
  const [alertas, setAlertas] = useState([]);
  const [error, setError] = useState('');

  const cargarAlertas = () => api.alertas({ tenant }).then(setAlertas).catch((e) => setError(e.message));
  useEffect(() => { if (!tenantFijo) api.tenants().then(setTenants).catch(() => {}); }, [tenantFijo]);
  useEffect(() => { cargarAlertas(); }, [tenant]);
  useRepetir(cargarAlertas, 15000, true);

  // Grafana filtra con variables en la URL: var-tenant y var-entorno (acordar con el Integrante 5).
  const url = GRAFANA
    ? `${GRAFANA}${GRAFANA.includes('?') ? '&' : '?'}kiosk&var-tenant=${tenant || 'All'}&var-entorno=${entorno || 'All'}`
    : '';

  return (
    <>
      <h1>Monitoreo</h1>
      <p className="sub">Salud y rendimiento de los servicios de cada tenant.</p>
      {!tenantFijo && (
        <div className="tarjeta filtros">
          <select value={tenant} onChange={(e) => setTenant(e.target.value)}>
            <option value="">Todos los tenants</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <select value={entorno} onChange={(e) => setEntorno(e.target.value)}>
            <option value="">Todos los entornos</option>
            {ENTORNOS.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
      )}
      <Error mensaje={error} />

      <div className="tarjeta">
        <h2>Panel de Grafana</h2>
        {url ? (
          <iframe className="grafana" src={url} title="Grafana" />
        ) : (
          <div className="grafana vacio">
            <p><strong>Grafana aun no esta conectado.</strong></p>
            <p className="sub">Cuando el Integrante 5 entregue la URL del dashboard, ponla en <code>VITE_GRAFANA_URL</code> (archivo <code>web/.env</code>).</p>
            <p className="sub">Mostrara: disponibilidad, CPU, memoria, latencia, errores 5xx y estado de la base de datos.</p>
          </div>
        )}
      </div>

      <div className="tarjeta">
        <h2>Alertas y eventos recientes</h2>
        <table>
          <thead><tr><th>Alerta</th><th>Tenant</th><th>Detalle</th><th>Estado</th><th>Detectada</th></tr></thead>
          <tbody>
            {alertas.map((a) => (
              <tr key={a.id}>
                <td><span className={`sev s-${a.severidad}`}>{a.severidad}</span> {a.nombre}</td>
                <td>{tenantFijo ? a.tenant_id : <Link to={`/tenants/${a.tenant_id}`}>{a.tenant_id}</Link>}</td>
                <td>{a.detalle}</td>
                <td><Estado valor={a.estado} /></td>
                <td>{fecha(a.detectada_en)}</td>
              </tr>
            ))}
            {alertas.length === 0 && <tr><td colSpan="5" className="sub">Sin alertas.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
