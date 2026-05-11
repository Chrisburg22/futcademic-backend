
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function checkEvents() {
  const { data, error } = await supabase.from('events').select('count', { count: 'exact' });
  if (error) {
    console.error('Error fetching events:', error);
  } else {
    console.log('Total events in DB:', data);
    const { data: events } = await supabase.from('events').select('*').limit(5);
    console.log('First 5 events:', JSON.stringify(events, null, 2));
  }
}

checkEvents();
