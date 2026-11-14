// Asistente de 3 pasos para crear un tenant (RF-03, RF-07, RF-08), segun el mockup.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { ENTORNOS, MOTORES, REGIONES, Error } from '../comun.jsx';
import { RESPALDO, TarjetaPlan } from './Planes.jsx';

const PASOS = ['Datos y plan', 'Configuracion', 'Revision'];
const ZONAS = ['America/La_Paz', 'America/Lima', 'America/Bogota', 'America/Mexico_City', 'America/Santiago', 'America/Argentina/Buenos_Aires'];

export default function CrearTenant() {
  const navegar = useNavigate();
  const [paso, setPaso] = useState(0);
  const [planes, setPlanes] = useState([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [d, setD] = useState({
    nombre: '', id: '', contacto: '', region: 'us-east-1', entorno: 'produccion',
    plan: 'estandar', motor: 'opentofu', zona_horaria: 'America/La_Paz', datos_ejemplo: true,
  });

  useEffect(() => { api.planes().then(setPlanes).catch((e) => setError(e.message)); }, []);

  const poner = (campo) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setD((x) => ({ ...x, [campo]: campo === 'id' ? v.toLowerCase().replace(/[^a-z0-9-]/g, '') : v }));
  };

  // Al escribir el nombre, propone un id (san-marcos) si el usuario aun no lo toco.
  const ponerNombre = (e) => {
    const nombre = e.target.value;
    const sugerido = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
    setD((x) => ({ ...x, nombre, id: x.idTocado ? x.id : sugerido }));
  };

  const validarPaso1 = () => {
    if (!d.nombre.trim()) return 'Escribe el nombre de la institucion';
    if (!/^[a-z0-9-]{3,30}$/.test(d.id)) return 'El identificador debe tener de 3 a 30 caracteres: minusculas, numeros o guiones';
    if (!/^\S+@\S+\.\S+$/.test(d.contacto)) return 'Escribe un correo valido para el administrador';
    return '';
  };

  const siguiente = () => {
    const e = paso === 0 ? validarPaso1() : '';
    setError(e);
    if (!e) setPaso(paso + 1);
  };

  const crear = async () => {
    setEnviando(true);
    setError('');
    try {
      const { idTocado, ...cuerpo } = d;
      await api.crearTenant(cuerpo);
      navegar(`/tenants/${d.id}`);
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  const plan = planes.find((p) => p.id === d.plan);
  const nombreDe = (lista, id) => lista.find((x) => x.id === id)?.nombre || id;

  return (
    <>
      <p className="miga">Tenants / <strong>Crear tenant</strong></p>
      <h1>Crear tenant</h1>
      <p className="sub">Configura una nueva institucion y prepara su entorno de registro de asistencia.</p>

      <div className="pasos">
        <small>PASO {paso + 1} DE 3</small>
        <div className="linea-pasos">
          {PASOS.map((p, i) => (
            <div key={p} className={`paso ${i === paso ? 'actual' : ''} ${i < paso ? 'hecho' : ''}`}>
              <span>{i < paso ? '✓' : i + 1}</span> {p}
            </div>
          ))}
        </div>
      </div>

      <div className="asistente">
        <div className="tarjeta">
          {paso === 0 && (
            <>
              <h2>Datos de la institucion</h2>
              <p className="sub">Identifica al tenant y configura su primer entorno.</p>
              <div className="rejilla">
                <label>Nombre de la institucion *<input value={d.nombre} onChange={ponerNombre} placeholder="Instituto San Marcos" /></label>
                <label>Identificador del tenant *
                  <input value={d.id} onChange={(e) => { poner('id')(e); setD((x) => ({ ...x, idTocado: true })); }} placeholder="san-marcos" />
                </label>
                <label>Correo del administrador *<input value={d.contacto} onChange={poner('contacto')} placeholder="admin@sanmarcos.edu" /></label>
                <div className="rejilla">
                  <label>Region de despliegue
                    <select value={d.region} onChange={poner('region')}>{REGIONES.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select>
                  </label>
                  <label>Entorno
                    <select value={d.entorno} onChange={poner('entorno')}>{ENTORNOS.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
                  </label>
                </div>
              </div>

              <h2>Selecciona un plan</h2>
              <p className="sub">El plan define la capacidad y los limites iniciales del tenant.</p>
              <div className="planes">
                {planes.map((p) => (
                  <TarjetaPlan key={p.id} plan={p} seleccionado={d.plan === p.id} onClick={() => setD({ ...d, plan: p.id })} />
                ))}
              </div>

              <div className="fila-motor">
                <div>
                  <h2>Motor de infraestructura</h2>
                  <p className="sub">Elige la herramienta que aprovisionara los recursos de este tenant.</p>
                </div>
                <select value={d.motor} onChange={poner('motor')}>{MOTORES.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
              </div>
            </>
          )}

          {paso === 1 && (
            <>
              <h2>Configuracion de la aplicacion</h2>
              <p className="sub">Estos valores se inyectan en la VM al primer arranque (cloud-init).</p>
              <label>Zona horaria
                <select value={d.zona_horaria} onChange={poner('zona_horaria')}>{ZONAS.map((z) => <option key={z}>{z}</option>)}</select>
              </label>
              <label className="check">
                <input type="checkbox" checked={d.datos_ejemplo} onChange={poner('datos_ejemplo')} />
                Cargar datos de ejemplo (cursos, docentes y estudiantes de prueba)
              </label>
            </>
          )}

          {paso === 2 && (
            <>
              <h2>Revision</h2>
              <p className="sub">Revisa los datos antes de crear. Se aprovisionara al confirmar.</p>
              <table className="revision">
                <tbody>
                  <tr><th>Institucion</th><td>{d.nombre}</td></tr>
                  <tr><th>Identificador</th><td>{d.id}</td></tr>
                  <tr><th>Contacto</th><td>{d.contacto}</td></tr>
                  <tr><th>Region</th><td>{nombreDe(REGIONES, d.region)}</td></tr>
                  <tr><th>Entorno</th><td>{nombreDe(ENTORNOS, d.entorno)}</td></tr>
                  <tr><th>Plan</th><td>{plan?.nombre} — servidor {plan?.instance_type}, BD {plan?.db_volume_gb} GB</td></tr>
                  <tr><th>Motor</th><td>{nombreDe(MOTORES, d.motor)}</td></tr>
                  <tr><th>Zona horaria</th><td>{d.zona_horaria}</td></tr>
                  <tr><th>Datos de ejemplo</th><td>{d.datos_ejemplo ? 'Si' : 'No'}</td></tr>
                </tbody>
              </table>
            </>
          )}

          <Error mensaje={error} />
        </div>

        <aside className="tarjeta resumen">
          <h2>Resumen del tenant</h2>
          <p className="sub">Se aprovisionara al confirmar.</p>
          <div className="caja">
            <small>INSTITUCION</small>
            <strong>{d.nombre || '—'}</strong>
            <small>{d.id || 'identificador'}</small>
          </div>
          <div className="fila"><span>Plan seleccionado</span><strong>{plan?.nombre}</strong></div>
          <p><strong>Recursos incluidos</strong></p>
          <ul className="puntos">
            <li>Frontend y API</li>
            <li>Base de datos aislada ({plan?.db_volume_gb} GB)</li>
            <li>{RESPALDO[d.plan]}</li>
            <li>Monitoreo en Grafana</li>
          </ul>
          <div className="caja ok">✓ Los datos de este tenant quedan separados de otras instituciones.</div>
          <div className="fila"><span>{nombreDe(ENTORNOS, d.entorno)}</span><span>{d.region}</span></div>
          <div className="caja advertencia">La creacion puede tardar varios minutos. Podras seguir el progreso desde Tenants.</div>
        </aside>
      </div>

      <div className="pie">
        <span className="sub">Los recursos se crean segun el plan seleccionado.</span>
        <div>
          <button onClick={() => (paso === 0 ? navegar('/tenants') : setPaso(paso - 1))}>{paso === 0 ? 'Cancelar' : 'Atras'}</button>
          {paso < 2
            ? <button className="primario" onClick={siguiente}>Continuar →</button>
            : <button className="primario" onClick={crear} disabled={enviando}>{enviando ? 'Creando...' : 'Crear tenant'}</button>}
        </div>
      </div>
    </>
  );
}
