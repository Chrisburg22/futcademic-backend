const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function migrate() {
  console.log('Iniciando migración de la tabla venues...');
  
  const columns = [
    { name: 'has_lighting', type: 'boolean', default: 'false' },
    { name: 'is_covered', type: 'boolean', default: 'false' },
    { name: 'is_external', type: 'boolean', default: 'false' },
    { name: 'status', type: 'text', default: "'Activa'" },
    { name: 'surface_type', type: 'text' },
    { name: 'capacity', type: 'text' },
    { name: 'type_label', type: 'text' },
    { name: 'latitude', type: 'double precision' },
    { name: 'longitude', type: 'double precision' }
  ];

  // Nota: Intentamos vía RPC si existe una función de ejecución de SQL
  for (const col of columns) {
    try {
      const sql = `ALTER TABLE venues ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} ${col.default ? `DEFAULT ${col.default}` : ''};`;
      console.log(`Intentando añadir: ${col.name}...`);
      
      // Intentamos ejecutar el SQL. Si falla el RPC, informaremos al usuario.
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        console.error(`Error RPC para ${col.name}:`, error.message);
        console.log(`SQL sugerido: ${sql}`);
      } else {
        console.log(`✅ Columna ${col.name} procesada.`);
      }
    } catch (e) {
      console.error(`Fallo crítico en ${col.name}:`, e.message);
    }
  }
}

migrate();
