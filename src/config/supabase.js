const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Inicializamos el cliente de Supabase (Service Role para administración desde Backend)
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
