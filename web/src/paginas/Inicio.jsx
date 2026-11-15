import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Estado, fecha, Error } from '../comun.jsx';

export default function Inicio() {
  const [tenants, setTenants] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.tenants(), api.alertas({ estado: 'activa' })])
      .then(([t, a]) => { setTenants(t); setAlertas(a); })
      .catch((e) => setError(e.message));
  }, []);

  const contar = (estado) => tenants.filter((t) => t.estado === estado).length;

  return (
    <>
      <div className="cabecera">
        <div>
          <h1>Inicio</h1>
          <p className="sub">Resumen de la plataforma</p>
        </div>
        <Link className="boton primario" to="/tenants/nuevo">+ Crear tenant</Link>
      </div>
      <Error mensaje={error} />
      <div className="cifras">
        <div className="tarjeta"><small>Tenants</small><strong>{tenants.filter((t) => t.estado !== 'eliminado').length}</strong></div>
        <div className="tarjeta"><small>En linea</small><strong className="ok">{contar('activo')}</strong></div>
        <div className="tarjeta"><small>Suspendidos</small><strong>{contar('suspendido')}</strong></div>
        <div className="tarjeta"><small>Fallidos</small><strong className="mal">{contar('fallido')}</strong></div>
        <div className="tarjeta"><small>Alertas activas</small><strong className="mal">{alertas.length}</strong></div>
      </div>
      <div className="tarjeta">
        <h2>Alertas recientes</h2>
        {alertas.length === 0 ? <p className="sub">Sin alertas activas.</p> : (
          <table>
            <thead><tr><th>Alerta</th><th>Tenant</th><th>Detectada</th></tr></thead>
            <tbody>
              {alertas.slice(0, 5).map((a) => (
                <tr key={a.id}>
                  <td><span className={`sev s-${a.severidad}`}>{a.severidad}</span> {a.nombre}</td>
                  <td><Link to={`/tenants/${a.tenant_id}`}>{a.tenant_id}</Link></td>
                  <td>{fecha(a.detectada_en)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="tarjeta">
        <h2>Ultimos tenants</h2>
        <table>
          <tbody>
            {tenants.slice(0, 5).map((t) => (
              <tr key={t.id}>
                <td><Link to={`/tenants/${t.id}`}>{t.nombre}</Link></td>
                <td>{t.plan_id}</td>
                <td><Estado valor={t.estado} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
