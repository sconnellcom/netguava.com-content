import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('PHP endpoint validates, sends every form, handles uploads and enforces quotas', async (t) => {
  const temp = await mkdtemp(path.join(tmpdir(), 'netguava-contact-test-'));
  const rateFile = path.join(temp, 'rate.json');
  const captureFile = path.join(temp, 'mail.json');
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const php = process.env.PHP_BIN || 'php';
  const args = process.env.PHP_EXTENSION_DIR
    ? ['-d', `extension_dir=${process.env.PHP_EXTENSION_DIR}`, '-d', 'extension=curl'] : [];
  const server = spawn(php, [...args, '-d', 'upload_max_filesize=9M', '-d', 'post_max_size=10M',
    '-S', `127.0.0.1:${port}`, fileURLToPath(new URL('mailgun-router.php', import.meta.url))], {
    env: { ...process.env, MAILGUN_API_KEY: 'test-only-not-a-real-key', MAILGUN_DOMAIN: 'mg.example.test',
      MAILGUN_FROM_EMAIL: 'Website <postmaster@mg.example.test>', MAILGUN_TO_EMAIL: 'support@netguava.com',
      CONTACT_RATE_LIMIT_FILE: rateFile, CONTACT_TEST_CAPTURE: captureFile },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  server.stdout.on('data', data => { output += data; });
  server.stderr.on('data', data => { output += data; });
  let startError;
  server.on('error', error => { startError = error; });
  t.after(async () => {
    if (server.pid && server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill();
      await exited;
    }
    await rm(temp, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${port}/send-contact.php`;
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (startError) throw startError;
    try {
      const response = await fetch(url);
      assert.equal(response.status, 405);
      assert.equal(response.headers.get('allow'), 'POST');
      ready = true;
      break;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert.ok(ready, `PHP server did not become ready: ${output}`);
  const fields = { form_id: 'gform_4', input_1: 'Test Visitor', input_2: 'visitor@example.test',
    input_3: 'A project inquiry', input_6: '555-0100', source_page: '/contact/' };
  async function submit(overrides = {}, { status = 200, file, mailgun } = {}) {
    const data = new FormData();
    for (const [key, value] of Object.entries({ ...fields, ...overrides })) data.set(key, value);
    if (file) data.set('input_4', new Blob([new Uint8Array(file.size)]), file.name);
    const response = await fetch(url, { method: 'POST', body: data,
      headers: mailgun ? { 'X-Test-Mailgun': mailgun } : {} });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    assert.equal(result.ok, status === 200);
    return result;
  }
  await t.test('rejects invalid input and honeypots without sending', async () => {
    await submit({ input_1: '' }, { status: 422 });
    await submit({ input_2: 'invalid' }, { status: 422 });
    await submit({ 'input_1[]': 'array', input_1: undefined }, { status: 422 });
    await submit({ input_2: 'visitor@example.test\r\nBcc: other@example.test' }, { status: 422 });
    await submit({ input_3: 'x'.repeat(5001) }, { status: 422 });
    await submit({ form_id: 'unknown' }, { status: 422 });
    await submit({ ak_hp_textarea: 'spam' }, { status: 422 });
    await submit({ form_id: 'gform_2', input_4: '' }, { status: 422 });
    await submit({ form_id: 'gform_2', input_4: 'Unknown' }, { status: 422 });
    await assert.rejects(readFile(captureFile), { code: 'ENOENT' });
  });
  await t.test('contact payload contains recipient, reply address, phone, message and page', async () => {
    await submit();
    const mail = JSON.parse(await readFile(captureFile, 'utf8'));
    assert.equal(mail.url, 'https://api.mailgun.net/v3/mg.example.test/messages');
    assert.equal(mail.payload.to, 'support@netguava.com');
    assert.equal(mail.payload['h:Reply-To'], fields.input_2);
    for (const value of ['555-0100', fields.input_3, '/contact/', 'Test Visitor']) {
      assert.ok(mail.payload.text.includes(value));
    }
  });
  await t.test('all plans and services are included', async () => {
    for (const plan of ['Essentials', 'Professional', 'Premium']) {
      await submit({ form_id: 'gform_2', input_4: plan, input_5: 'WordPress Support' });
      const mail = JSON.parse(await readFile(captureFile, 'utf8'));
      assert.ok(mail.payload.text.includes(`Plan: ${plan}`));
      assert.ok(mail.payload.text.includes('Service: WordPress Support'));
    }
  });
  await t.test('estimate works without an attachment and accepts exactly 8 MB', async () => {
    await submit({ form_id: 'gform_1', input_8: '555-0101' });
    await submit({ form_id: 'gform_1', input_8: '555-0101' },
      { file: { size: 8388608, name: 'project.txt' } });
    const mail = JSON.parse(await readFile(captureFile, 'utf8'));
    assert.deepEqual(mail.payload.attachment, { filename: 'project.txt', size: 8388608 });
    assert.ok(mail.payload.text.includes('555-0101'));
    await submit({ form_id: 'gform_1' },
      { status: 413, file: { size: 8388609, name: 'too-big.txt' } });
    await submit({}, { status: 422, file: { size: 1, name: 'unexpected.txt' } });
  });
  await t.test('delivery failures never return success', async () => {
    for (const mailgun of ['401', '500', 'network-error', 'bad-receipt']) {
      await submit({}, { status: 502, mailgun });
    }
    await submit({}, { status: 500, mailgun: 'missing-key' });
  });
  await t.test('hourly and daily limits enforce the exact thresholds', async () => {
    const now = Math.floor(Date.now() / 1000);
    await writeFile(rateFile, JSON.stringify(Array(14).fill(now)));
    await submit();
    await submit({}, { status: 429 });
    await writeFile(rateFile, JSON.stringify(Array(24).fill(now - 7200)));
    await submit();
    await submit({}, { status: 429 });
    await writeFile(rateFile, JSON.stringify(Array(25).fill(now - 86401)));
    await submit();
    assert.equal(JSON.parse(await readFile(rateFile, 'utf8')).length, 1);
    await writeFile(rateFile, 'corrupted');
    await submit({}, { status: 500 });
  });
});
