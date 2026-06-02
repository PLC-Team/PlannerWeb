const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) acc[key.trim()] = rest.join('=').trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('hierarchy').select('*');
  console.log("Hierarchy Table:", JSON.stringify(data, null, 2));
  
  const { data: q2, error: e2 } = await supabase.from('hierarchy').select('team_member_id, users!hierarchy_team_member_id_fkey(name)');
  console.log("\nTL query error:", e2);
  console.log("TL query:", JSON.stringify(q2, null, 2));

  const { data: q3, error: e3 } = await supabase.from('daily_work_reports').select('user_id, report_date, project_code').limit(10);
  console.log("\nReports:", JSON.stringify(q3, null, 2));
}

check();
