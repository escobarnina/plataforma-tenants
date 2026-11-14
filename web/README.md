# Consola web (Integrante 2, rama `i2-web`)

Pantallas para el administrador: Inicio, Tenants (filtros RF-14), Crear tenant en 3 pasos (RF-03, 07, 08), Detalle con log y acciones (suspender, reanudar, eliminar, reintentar), Planes (RF-01, 02) y Monitoreo (Grafana + alertas).

**Correr sola (sin API ni AWS):**
1. `cd web` y `npm install`
2. `npm run dev` y abrir http://localhost:5173
3. Entrar con `admin / admin` (plataforma) o `san-marcos / san-marcos` (admin del tenant).
4. Para probar una falla y su reintento: crear un tenant cuyo id contenga `falla`.

**Con la API real:** copiar `.env.example` como `.env`, poner `VITE_USE_MOCK=false` y levantar la API del Integrante 1 en `http://localhost:4000`.

Todas las llamadas a la API estan en `src/api.js`; la API falsa en `src/mock.js` usa los mismos campos que `db/schema.sql`.
