// Configuracion: muestra a que API y a que Grafana esta conectada la consola.
import { modoMock } from '../api.js';

export default function Configuracion() {
  return (
    <>
      <h1>Configuracion</h1>
      <p className="sub">Estos valores se cambian en el archivo <code>web/.env</code> (ver <code>.env.example</code>).</p>
      <div className="tarjeta">
        <table className="revision">
          <tbody>
            <tr><th>Origen de datos</th><td>{modoMock ? 'API falsa (src/mock.js)' : 'API real'}</td></tr>
            <tr><th>URL de la API</th><td>{import.meta.env.VITE_API_URL || 'http://localhost:4000'}</td></tr>
            <tr><th>URL de Grafana</th><td>{import.meta.env.VITE_GRAFANA_URL || 'Sin configurar'}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
