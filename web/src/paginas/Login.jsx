import { useState } from 'react';
import { api, modoMock } from '../api.js';

// Iconos en SVG (sin imagenes externas).
const Nube = ({ tam = 40 }) => (
  <svg width={tam} height={tam * 0.75} viewBox="0 0 64 48" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round">
    <path d="M17 42h31a12 12 0 0 0 1-24A17 17 0 0 0 16 15 13.5 13.5 0 0 0 17 42z" />
  </svg>
);
const Icono = ({ d, tam = 20 }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const RAYO = <path d="M13 2 4 14h7l-1 8 9-12h-7z" />;
const ESCUDO = <><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>;
const BARRAS = <><path d="M5 20v-6M10 20V9M15 20v-8M20 20V5" /><path d="M3 20h18" /></>;
const PERSONA = <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>;
const CANDADO = <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><circle cx="12" cy="16" r="1" /></>;
const INFO = <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>;
// Ilustracion del colegio con arboles.
function Colegio() {
  const ventanas = (x0, y0, cols, filas) =>
    Array.from({ length: cols * filas }, (_, i) => (
      <rect key={`${x0}-${i}`} x={x0 + (i % cols) * 30} y={y0 + Math.floor(i / cols) * 34} width="18" height="22" rx="2" fill="#3b82e0" />
    ));
  const arbol = (x, y, r, color) => (
    <g key={x}>
      <circle cx={x} cy={y} r={r} fill={color} />
      <path d={`M${x} ${y - r * 0.2}v${r * 1.6}M${x} ${y + r * 0.3}l-${r * 0.35}-${r * 0.35}M${x} ${y + r * 0.5}l${r * 0.35}-${r * 0.35}`} stroke="#2a5fb0" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
  return (
    <svg className="colegio" viewBox="0 0 640 330" aria-hidden="true">
      <defs>
        <linearGradient id="g-nube" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dbe8fb" />
          <stop offset="1" stopColor="#eef4fd" />
        </linearGradient>
        <linearGradient id="g-muro" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe9f8" />
        </linearGradient>
      </defs>
      <path d="M150 230c-20-70 40-120 100-100 20-70 130-90 170-20 60-20 120 30 100 100z" fill="url(#g-nube)" />
      <ellipse cx="330" cy="300" rx="300" ry="30" fill="#e3edfb" />
      {/* alas laterales */}
      <rect x="150" y="150" width="120" height="140" fill="url(#g-muro)" stroke="#d3e1f5" />
      <rect x="390" y="150" width="120" height="140" fill="url(#g-muro)" stroke="#d3e1f5" />
      {ventanas(170, 175, 3, 2)}
      {ventanas(410, 175, 3, 2)}
      {/* cuerpo central */}
      <path d="M255 130l75-35 75 35v160H255z" fill="url(#g-muro)" stroke="#d3e1f5" />
      <path d="M248 132l82-40 82 40" fill="none" stroke="#c8d9f2" strokeWidth="6" strokeLinejoin="round" />
      <rect x="295" y="150" width="70" height="60" rx="3" fill="#3b82e0" />
      <path d="M330 150v60M295 180h70" stroke="#dfe9f8" strokeWidth="4" />
      <rect x="305" y="232" width="50" height="58" rx="2" fill="#3b82e0" />
      <path d="M330 232v58" stroke="#dfe9f8" strokeWidth="3" />
      {/* bandera */}
      <path d="M330 95V40" stroke="#2a5fb0" strokeWidth="4" />
      <path d="M332 42h34l-8 10 8 10h-34z" fill="#3b82e0" />
      {arbol(95, 240, 42, '#5b9bea')}
      {arbol(165, 270, 22, '#7fb2f0')}
      {arbol(560, 215, 38, '#5b9bea')}
      {arbol(605, 268, 26, '#7fb2f0')}
    </svg>
  );
}

export default function Login({ onEntrar }) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      onEntrar(await api.login(usuario, clave));
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  };

  return (
    <div className="login">
      <div className="mancha m1" />
      <div className="mancha m2" />

      <section className="login-izq">
        <div className="login-marca">
          <span className="azul"><Nube tam={64} /></span>
          <span>Tenant <b>Control Center</b></span>
        </div>
        <h1>Asistencia en la nube<br />para <b>tu institución</b></h1>
        <p>Gestiona, brinda soporte y da seguimiento a tus solicitudes de manera eficiente.</p>
        <div className="ventajas">
          <div><span className="azul"><Icono d={RAYO} tam={28} /></span>Soporte<br />rápido</div>
          <div><span className="azul"><Icono d={ESCUDO} tam={28} /></span>Seguridad<br />garantizada</div>
          <div><span className="azul"><Icono d={BARRAS} tam={28} /></span>Control<br />total</div>
        </div>
        <Colegio />
      </section>

      <form className="login-tarjeta" onSubmit={enviar}>
        <div className="circulo azul"><Nube tam={44} /></div>
        <h2>Tenant Control Center</h2>
        <p className="sub">Inicia sesión como administrador de la plataforma o de tu institución.</p>

        <label>Usuario
          <div className="campo">
            <Icono d={PERSONA} />
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="admin@ejemplo.com" autoFocus autoComplete="username" />
          </div>
        </label>
        <label>Clave
          <div className="campo">
            <Icono d={CANDADO} />
            <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </div>
        </label>

        {error && <div className="error">{error}</div>}
        <button className="primario entrar" disabled={cargando}>
          {cargando ? 'Entrando...' : <>Entrar <span>→</span></>}
        </button>

        <div className="login-enlaces">
          <button type="button" className="enlace-azul" onClick={() => setAviso('Pide al administrador de la plataforma que restablezca tu clave.')}>
            <Icono d={INFO} tam={16} /> ¿Olvidaste tu contraseña?
          </button>
        </div>
        {aviso && <p className="sub centro">{aviso}</p>}
        <p className="pie-login">Servicio de asistencia en la nube para instituciones.</p>
        {modoMock && (
          <p className="pie-login prueba">
            Prueba: <code>admin / admin</code> o <code>san-marcos / san-marcos</code>
          </p>
        )}
      </form>
    </div>
  );
}
