import { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, modoMock, sesion as leerSesion } from './api.js';
import Login from './paginas/Login.jsx';
import Inicio from './paginas/Inicio.jsx';
import Tenants from './paginas/Tenants.jsx';
import CrearTenant from './paginas/CrearTenant.jsx';
import DetalleTenant from './paginas/DetalleTenant.jsx';
import Planes from './paginas/Planes.jsx';
import Monitoreo from './paginas/Monitoreo.jsx';
import Configuracion from './paginas/Configuracion.jsx';

export default function App() {
  const [sesion, setSesion] = useState(() => {
    const s = leerSesion();
    if (s && modoMock) api.restaurarSesion(s);
    return s;
  });
  const navegar = useNavigate();

  const entrar = (s) => {
    localStorage.setItem('sesion', JSON.stringify(s));
    setSesion(s);
    navegar(s.rol === 'admin_tenant' ? `/tenants/${s.tenant_id}` : '/');
  };
  const salir = () => {
    localStorage.removeItem('sesion');
    if (modoMock) api.restaurarSesion(null);
    setSesion(null);
  };

  if (!sesion) return <Login onEntrar={entrar} />;

  const esAdmin = sesion.rol === 'admin_plataforma';
  const enlace = (a, texto) => (
    <NavLink to={a} end={a === '/'} className={({ isActive }) => (isActive ? 'nav activo' : 'nav')}>
      {texto}
    </NavLink>
  );

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <span className="logo">▲</span>
          <div>
            <strong>Tenant</strong>
            <small>CONTROL CENTER</small>
          </div>
        </div>
        <p className="seccion">PLATAFORMA</p>
        {esAdmin ? (
          <>
            {enlace('/', 'Inicio')}
            {enlace('/tenants', 'Tenants')}
            {enlace('/planes', 'Planes')}
            {enlace('/monitoreo', 'Monitoreo')}
            <p className="seccion">ADMINISTRACION</p>
            {enlace('/configuracion', 'Configuracion')}
          </>
        ) : (
          <>
            {enlace(`/tenants/${sesion.tenant_id}`, 'Mi institucion')}
            {enlace('/monitoreo', 'Monitoreo')}
          </>
        )}
        <div className="usuario">
          <span className="avatar">{esAdmin ? 'AP' : 'AT'}</span>
          <div>
            <strong>{esAdmin ? 'Admin plataforma' : sesion.tenant_id}</strong>
            <button className="enlace" onClick={salir}>Cerrar sesion</button>
          </div>
        </div>
      </aside>

      <main className="contenido">
        {modoMock && <div className="aviso-mock">Modo prueba: datos simulados (API falsa)</div>}
        <Routes>
          {esAdmin ? (
            <>
              <Route path="/" element={<Inicio />} />
              <Route path="/tenants" element={<Tenants />} />
              <Route path="/tenants/nuevo" element={<CrearTenant />} />
              <Route path="/tenants/:id" element={<DetalleTenant esAdmin />} />
              <Route path="/planes" element={<Planes />} />
              <Route path="/monitoreo" element={<Monitoreo />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          ) : (
            <>
              <Route path="/tenants/:id" element={<DetalleTenant />} />
              <Route path="/monitoreo" element={<Monitoreo tenantFijo={sesion.tenant_id} />} />
              <Route path="*" element={<Navigate to={`/tenants/${sesion.tenant_id}`} />} />
            </>
          )}
        </Routes>
      </main>
    </div>
  );
}
