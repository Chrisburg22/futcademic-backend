const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { error } = await supabase
    .from('profile_information')
    .upsert({
      id: 'some-valid-user-id-maybe', 
      school_id: 'some-school-id',
      phone: undefined, // undefined values?
      updated_at: new Date()
    });
  console.log('Error:', error);
}
test();
