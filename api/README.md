# API y worker de la plataforma (Integrante 1)

La API recibe pedidos y los anota en la tabla `operations`; el worker los ejecuta en segundo plano.

1. Necesitas Node 20+ y PostgreSQL 16. Crea la base `plataforma` y aplica `../db/schema.sql`.
2. Copia `env.example` como `.env` y completa la contrasena de la base.
3. `npm install`
4. Terminal 1: `node api.js` (puerto 4000). Terminal 2: `node worker.js`.
5. `ENGINE=fake` simula todo y no cuesta nada. `ENGINE=tofu` crea VMs reales en AWS (hay que tener `tofu` y `aws` configurados).
6. Prueba: `Invoke-RestMethod http://localhost:4000/planes`
7. Rutas y ejemplo de cuerpo para crear un tenant: ver el README de la raiz.
8. Motores: `motor-fake.js` (simulado), `motor-tofu.js` (OpenTofu) y `ec2-energia.js` (suspender y reanudar con el AWS CLI).
9. Contrato de entrada y salida de los motores: carpeta `../contrato/`.
10. Nunca subas `.env` ni archivos `.tfstate`.
