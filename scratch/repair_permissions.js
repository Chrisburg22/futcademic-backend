const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function repairPermissions() {
  console.log('Iniciando reparación de permisos para profesores existentes...');
  
  // 1. Obtener todos los profesores
  const { data: teachers, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('id, school_id')
    .eq('role', 'profesor');

  if (fetchError) {
    console.error('Error al obtener profesores:', fetchError.message);
    return;
  }

  console.log(`Se encontraron ${teachers.length} profesores. Verificando sus permisos...`);

  for (const teacher of teachers) {
    // 2. Verificar si ya tiene permisos
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('teacher_permissions')
      .select('id')
      .eq('teacher_id', teacher.id)
      .maybeSingle();

    if (!existing) {
      console.log(`Creando permisos por defecto para el profesor: ${teacher.id}`);
      
      const { error: insertError } = await supabaseAdmin
        .from('teacher_permissions')
        .insert([{
          teacher_id: teacher.id,
          school_id: teacher.school_id,
          can_take_attendance: true,
          can_manage_events: true,
          can_view_finances: false,
          can_manage_students: false,
          can_manage_payments: false,
          can_manage_categories: false
        }]);

      if (insertError) {
        console.error(`Error al crear permisos para ${teacher.id}:`, insertError.message);
      } else {
        console.log(`✅ Permisos creados para ${teacher.id}`);
      }
    } else {
      console.log(`El profesor ${teacher.id} ya tiene permisos registrados.`);
    }
  }
  
  console.log('Reparación completada.');
}

repairPermissions();
