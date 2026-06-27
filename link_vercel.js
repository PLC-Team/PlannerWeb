const { spawn } = require('child_process');

const child = spawn('npx.cmd', ['vercel', 'link'], { stdio: ['pipe', 'pipe', 'pipe'], shell: true });

let output = '';

child.stdout.on('data', (data) => {
  const str = data.toString();
  process.stdout.write(str);
  output += str;

  if (str.includes('Set up and develop')) {
    child.stdin.write('y\n');
  }
  else if (str.includes('Which scope')) {
    child.stdin.write('\n'); // default scope
  }
  else if (str.includes('Link to existing project?')) {
    child.stdin.write('y\n');
  }
  else if (str.includes('What’s the name of your existing project?')) {
    child.stdin.write('planner\n');
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

child.on('close', (code) => {
  console.log(`Child process exited with code ${code}`);
});
