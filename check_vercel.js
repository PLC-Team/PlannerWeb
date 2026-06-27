async function check() {
  const html = await fetch('https://planner-faithplc.vercel.app/dashboard/home').then(r => r.text());
  const match = html.match(/src="(\/_next\/static\/chunks\/app\/dashboard\/layout-[^"]+)"/);
  if (match) {
    const js = await fetch('https://planner-faithplc.vercel.app' + match[1]).then(r => r.text());
    console.log('Contains Training Requests:', js.includes('Training Requests'));
  } else {
    console.log('Layout JS not found');
  }
}
check();
