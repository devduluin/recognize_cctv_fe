const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = async ({ window, runtime, userData }) => {
  const unauthorized = await fetch(`${runtime.frontendOrigin}/desktop-health`);
  assert.equal(unauthorized.status, 403);
  const backendUnauthorized = await fetch(`${runtime.backendOrigin}/desktop-health`);
  assert.equal(backendUnauthorized.status, 403);
  const email = 'desktop-smoke@example.test';
  await window.webContents.executeJavaScript(`(async () => {
    const email = ${JSON.stringify(email)};
    const password = 'desktop-smoke-password-123456';
    const register = await fetch('/api/v1/auth/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email,password,full_name:'Desktop Smoke'}) });
    if (!register.ok && register.status !== 400) throw new Error('Registration failed');
    const login = await fetch('/api/v1/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email,password}) });
    const payload = await login.json();
    if (!login.ok || !payload.result.token) throw new Error('Local login failed');
    const setup = await fetch('/api/v1/auth/setup-account', {method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+payload.result.token},body:JSON.stringify({account_type:'personal'})});
    if (!setup.ok && setup.status !== 400) throw new Error('Local account setup failed');
    const user = {...payload.result.user,account_type:'personal',company_id:null};
    localStorage.setItem('auth_token',payload.result.token);
    localStorage.setItem('user_info',JSON.stringify(user));
    return true;
  })()`);
  await window.loadURL(`${runtime.frontendOrigin}/desktop-validation`);
  async function wait(script) {
    for (let index = 0; index < 120; index++) {
      if (await window.webContents.executeJavaScript(script)) return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`Desktop browser assertion timed out: ${script}`);
  }
  await wait(`!!document.querySelector('#ssr-marker')`);
  const first = await window.webContents.executeJavaScript(`document.querySelector('#ssr-marker').textContent`);
  await new Promise(resolve => { window.webContents.once('did-finish-load', resolve); window.reload(); });
  await wait(`!!document.querySelector('#ssr-marker')`);
  const second = await window.webContents.executeJavaScript(`document.querySelector('#ssr-marker').textContent`);
  assert.notEqual(first, second, 'SSR must execute at runtime');
  await window.webContents.executeJavaScript(`document.querySelector('#run-server-action').click()`);
  await wait(`document.querySelector('#action-result')?.textContent === 'server-action-ok'`);
  assert.equal(fs.readFileSync(path.join(runtime.paths.data, 'server-action-smoke.txt'), 'utf8'), 'server-action-ok');
  await window.loadURL(`${runtime.frontendOrigin}/video-detection`);
  await wait(`!!document.querySelector('input[type="file"]')`);
  fs.writeFileSync(path.join(userData, 'desktop-smoke.json'), JSON.stringify({ ok: true, ssr: true, apiRoutes: true, serverActions: true, localAuth: true, uploadUI: true }));
  await runtime.stop();
  let stillRunning = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    stillRunning = runtime.children.filter(({child}) => {
      if (!child.pid || child.exitCode !== null) return false;
      try { process.kill(child.pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
    }).map(({name, child}) => `${name} (${child.pid})`);
    if (stillRunning.length === 0) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.deepEqual(stillRunning, [], 'Every managed service must exit');
};
