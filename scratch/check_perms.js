const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkData() {
  const { data: perms } = await supabaseAdmin
    .from('teacher_permissions')
    .select('*');
  
  console.log('Permisos en DB:', JSON.stringify(perms, null, 2));
}

checkData();
