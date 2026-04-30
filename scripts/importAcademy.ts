import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load env from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  const dataPath = path.resolve(__dirname, '../../academy_data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  console.log(`Importing data for school: ${data.school_name}`);

  // 1. Get School
  let { data: school } = await supabase
    .from('schools')
    .select('id')
    .eq('name', data.school_name)
    .single();

  if (!school) {
    console.error('School not found.');
    return;
  }
  const schoolId = (school as any).id;

  // 3. Process Categories
  for (const catData of data.categories) {
    console.log(`Processing category: ${catData.name} (${catData.birth_year})`);
    
    let { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('school_id', schoolId)
      .eq('birth_year', catData.birth_year)
      .single();

    if (!category) continue;
    const categoryId = (category as any).id;

    // 4. Process Students
    for (const studentData of catData.students) {
      let { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .eq('full_name', studentData.name)
        .eq('category_id', categoryId)
        .single();

      let studentId: string | null = student ? (student as any).id : null;

      if (studentId) {
        // Only insert if no payments exist
        const { count } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('student_id', studentId);
        
        if (count && count > 0) continue;

        if (studentData.payments && studentData.payments.length > 0) {
          const pInserts = studentData.payments.map((p: any) => {
            const base = {
              school_id: schoolId,
              student_id: studentId,
              amount: p.amount,
              payment_date: '2025-01-01',
              payment_type: 'mensualidad'
            };
            if (p.type === 'mensualidad') {
              const months = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
              return {
                ...base,
                payment_date: `2025-${String(p.month).padStart(2, '0')}-01`,
                description: `Mensualidad ${months[p.month] || p.month}`
              };
            } else {
              return {
                ...base,
                description: `Torneo ${p.name}${p.note ? ': ' + p.note : ''}`
              };
            }
          });
          const { error: pErr } = await supabase.from('payments').insert(pInserts);
          if (pErr) console.error(`Error inserting payments for ${studentData.name}:`, pErr.message);
        }
      }
    }
    console.log(`Finished category: ${catData.name}`);
  }

  console.log('Import finished successfully!');
}

run().catch(console.error);
