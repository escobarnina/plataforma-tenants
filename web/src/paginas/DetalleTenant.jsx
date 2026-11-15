// Detalle de un tenant: datos, acciones (suspender, reanudar, eliminar, reintentar)
// y log de operaciones con progreso en vivo (RF-11, RF-12, RF-16, RF-17, RF-18).
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Estado, fecha, Error, useRepetir } from '../comun.jsx';

const EN_PROCESO = ['pendiente', 'en_curso'];

export default function DetalleTenant({ esAdmin = false }) {
  const { id } = useParams();
  const navegar = useNavigate();
  const [t, setT] = useState(null);
  const [ops, setOps] = useState([]);
  const [abierta, setAbierta] = useState(null);
  const [error, setError] = useState('');
  const [eliminar, setEliminar] = useState(null); // vista previa de lo que se borrara
  const [confirmacion, setConfirmacion] = useState('');

  const cargar = async () => {
    try {
      const [tenant, lista] = await Promise.all([api.tenant(id), api.operaciones(id)]);
      setT(tenant);
      setOps(lista);
      setAbierta((a) => a ?? lista[0]?.id ?? null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { setT(null); setAbierta(null); cargar(); }, [id]);
  const ocupado = ops.some((o) => EN_PROCESO.includes(o.estado));
  useRepetir(cargar, 2000, ocupado || ['pendiente', 'aprovisionando', 'eliminando'].includes(t?.estado));

  const accion = async (fn) => {
    setError('');
    try {
      const r = await fn();
      if (r?.operacion) setAbierta(r.operacion.id);
      else if (r?.id) setAbierta(r.id);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const abrirEliminar = async () => {
    setError('');
    setConfirmacion('');
    try { setEliminar(await api.previewEliminar(id)); } catch (e) { setError(e.message); }
  };

  const confirmarEliminar = async () => {
    await accion(() => api.eliminar(id, confirmacion));
    setEliminar(null);
  };

  if (!t) return error ? <Error mensaje={error} /> : <p className="sub">Cargando...</p>;

  const fallida = ops.find((o) => o.estado === 'fallida');
  const opAbierta = ops.find((o) => o.id === abierta);

  return (
    <>
      {esAdmin && <p className="miga"><Link to="/tenants">Tenants</Link> / <strong>{t.nombre}</strong></p>}
      <div className="cabecera">
        <div>
          <h1>{t.nombre} <Estado valor={t.estado} /></h1>
          <p className="sub">{t.id} · {t.contacto}</p>
        </div>
        <div className="acciones">
          {t.estado === 'activo' && <button disabled={ocupado} onClick={() => accion(() => api.suspender(id))}>Suspender</button>}
          {t.estado === 'suspendido' && <button disabled={ocupado} onClick={() => accion(() => api.reanudar(id))}>Reanudar</button>}
          {fallida && !ocupado && <button className="primario" onClick={() => accion(() => api.reintentar(fallida.id))}>Reintentar</button>}
          {esAdmin && !['eliminando', 'eliminado'].includes(t.estado) &&
            <button className="peligro" disabled={ocupado} onClick={abrirEliminar}>Eliminar</button>}
        </div>
      </div>
      <Error mensaje={error} />

      <div className="cifras">
        <div className="tarjeta"><small>Plan</small><strong>{t.plan_id}</strong></div>
        <div className="tarjeta"><small>Entorno</small><strong>{t.entorno}</strong></div>
        <div className="tarjeta"><small>Motor</small><strong>{t.motor}</strong></div>
        <div className="tarjeta"><small>Region</small><strong>{t.region}</strong></div>
      </div>

      <div className="tarjeta">
        <h2>Servicio</h2>
        <table className="revision">
          <tbody>
            <tr><th>URL de la aplicacion</th><td>{t.url ? <a href={t.url} target="_blank" rel="noreferrer">{t.url}</a> : '—'}</td></tr>
            <tr><th>IP publica</th><td>{t.public_ip || '—'}</td></tr>
            <tr><th>Instancia</th><td>{t.instance_id || '—'}</td></tr>
            <tr><th>Zona horaria</th><td>{t.zona_horaria}</td></tr>
            <tr><th>Creado</th><td>{fecha(t.creado_en)}</td></tr>
            <tr><th>Ultimo cambio</th><td>{fecha(t.actualizado_en)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="tarjeta">
        <h2>Operaciones</h2>
        <div className="ops">
          <ul className="lista-ops">
            {ops.map((o) => (
              <li key={o.id} className={o.id === abierta ? 'activa' : ''} onClick={() => setAbierta(o.id)}>
                <strong>#{o.id} {o.tipo}</strong> <Estado valor={o.estado} />
                <small>{fecha(o.creada_en)} · intento {o.intentos}</small>
              </li>
            ))}
            {ops.length === 0 && <li className="sub">Sin operaciones.</li>}
          </ul>
          {opAbierta && (
            <div className="log">
              <div className="fila">
                <strong>Operacion #{opAbierta.id}: {opAbierta.tipo}</strong>
                <Estado valor={opAbierta.estado} />
              </div>
              {opAbierta.error && <div className="error">{opAbierta.error}</div>}
              <pre>{opAbierta.log || 'Esperando al worker...'}{EN_PROCESO.includes(opAbierta.estado) ? '▌' : ''}</pre>
            </div>
          )}
        </div>
      </div>

      {eliminar && (
        <div className="fondo-modal">
          <div className="tarjeta modal">
            <h2>Eliminar {t.nombre}</h2>
            <p>Se eliminaran estos <strong>recursos</strong>:</p>
            <ul>{eliminar.recursos.map((r) => <li key={r}>{r}</li>)}</ul>
            <p>Y estos <strong>datos</strong>:</p>
            <ul>{eliminar.datos.map((r) => <li key={r}>{r}</li>)}</ul>
            <div className="caja advertencia">Esta accion no se puede deshacer.</div>
            <label>Escribe <code>{t.id}</code> para confirmar
              <input value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoFocus />
            </label>
            <div className="acciones">
              <button onClick={() => setEliminar(null)}>Cancelar</button>
              <button className="peligro" disabled={confirmacion !== t.id} onClick={confirmarEliminar}>Eliminar definitivamente</button>
            </div>
          </div>
        </div>
      )}
      {t.estado === 'eliminado' && esAdmin && (
        <p><button onClick={() => navegar('/tenants')}>← Volver a Tenants</button></p>
      )}
    </>
  );
}
