const fs = require('fs');
let content = fs.readFileSync('app/projects/[id]/page.tsx', 'utf8');

// Replacements
content = content.replace(/role === 'hod' \|\| /g, '');
content = content.replace(/ \|\| role === 'hod'/g, '');
content = content.replace(/user\?\.role === 'hod' \|\| /g, '');
content = content.replace(/ \|\| user\?\.role === 'hod'/g, '');
content = content.replace(/\(role === 'manager' \|\| role === 'hod'\)/g, "(role === 'manager')");

// Fix lines like: {role === 'hod' ? 'ASSIGN TO USER' : role === 'manager' ? 'ASSIGN TO TEAM LEADER' : 'ASSIGN TO PROJECT MEMBER'}
content = content.replace(/role === 'hod' \? '[^']+' : /g, '');

// Fix: role === 'manager' || role === 'hod' ? '// ASSIGN MANAGER TASK //' : '// ASSIGN TL TASK //'
content = content.replace(/role === 'manager' \|\| role === 'hod' \? /g, "role === 'manager' ? ");

fs.writeFileSync('app/projects/[id]/page.tsx', content);
console.log('Removed HOD from projects/[id]/page.tsx');
