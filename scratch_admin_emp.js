const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length) {
    env[key.trim()] = values.join('=').trim();
  }
});

const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['SUPABASE_SERVICE_ROLE_KEY']
);

async function run() {
  const { data: users, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'admin');

  if (fetchError) {
    console.error('Error fetching admin:', fetchError);
    return;
  }

  for (const user of users) {
    console.log(`Admin User found: ${user.email}, Employee ID: ${user.employee_id}`);
    if (!user.employee_id || user.employee_id === 'null') {
      const { error: updateError } = await supabase
        .from('users')
        .update({ employee_id: 'EMP-ADMIN' })
        .eq('id', user.id);
        
      if (updateError) {
        console.error('Failed to update:', updateError);
      } else {
        console.log(`Updated ${user.email} to have employee_id: EMP-ADMIN`);
      }
    }
  }
}

run();
