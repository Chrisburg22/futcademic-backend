import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function check() {
  const { data: school } = await supabase.from('schools').select('id').eq('name', 'M.R Master Fut').single();
  if (!school) return console.log('School not found');

  const { count: students } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', school.id);
  const { count: categories } = await supabase.from('categories').select('*', { count: 'exact', head: true }).eq('school_id', school.id);
  const { count: payments } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('school_id', school.id);

  const { data: paySample } = await supabase.from('payments').select('id, school_id, student_id, description').limit(5);
  console.log(`Sample payments:`, paySample);

  console.log(`Results for M.R Master Fut:`);
  console.log(`- Students: ${students}`);
  console.log(`- Categories: ${categories}`);
  console.log(`- Payments: ${payments}`);
}

check();
