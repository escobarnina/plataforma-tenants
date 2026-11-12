// Uso:
//   node probar.js fake            -> crea un tenant falso
//   node probar.js fake destroy    -> lo elimina
//   node probar.js tofu            -> crea un tenant REAL en AWS
//   node probar.js tofu destroy    -> lo elimina

const motores = ['fake', 'tofu'];
const motor = process.argv[2] || 'fake';
const accion = process.argv[3] || 'apply';

if (!motores.includes(motor)) {
  console.error(`Motor desconocido: ${motor}. Usa: ${motores.join(' o ')}`);
  process.exit(1);
}

const engine = require(`./motor-${motor}`);

// Este objeto es el contrato de ENTRADA del tenant.
const tenant = {
  tenant_id: 'prueba-i1',
  nombre: 'Prueba Integrante 1',
  contacto: 'admin@prueba.edu',
  region: 'us-east-1',
  entorno: 'produccion',
  plan: 'basico',
  motor: 'opentofu',
  zona_horaria: 'America/La_Paz',
  datos_ejemplo: true,
};

const log = (linea) => console.log(`  > ${linea}`);

(async () => {
  try {
    if (accion === 'destroy') {
      await engine.destroy(tenant, log);
      console.log('Tenant eliminado');
    } else {
      const salida = await engine.apply(tenant, log);
      console.log('Salida del tenant (contrato de SALIDA):');
      console.log(JSON.stringify(salida, null, 2));
    }
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
})();
