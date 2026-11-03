import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/js/site.js', import.meta.url), 'utf8');
const slugs = ['contact', 'custom-web-app-development', 'online-marketing',
  'wordpress-support', 'wordpress-support__plan-comparison', 'website-builds-for-designers'];

test('all six forms are connected with feedback, multipart encoding and valid metadata', () => {
  for (const slug of slugs) {
    const html = readFileSync(new URL(`../src/content/${slug}.html`, import.meta.url), 'utf8');
    assert.match(html, /<form action="\/send-contact\.php" data-contact-form="" enctype="multipart\/form-data"/);
    assert.match(html, /name="form_id" type="hidden" value="gform_[124]"/);
    assert.match(html, /aria-live="polite" class="form-status" hidden="" role="status"/);
    assert.doesNotMatch(html, /data-placeholder-form|gformValidateFileSize/);
    if (slug.includes('wordpress-support') || slug === 'online-marketing') {
      assert.equal((html.match(/required="" type="radio"/g) || []).length, 3);
    }
  }
});

function harness(fetch) {
  const note = { hidden: true, dataset: {}, textContent: '' };
  const button = { disabled: false };
  const upload = {
    files: [],
    validity: '',
    setCustomValidity(value) { this.validity = value; },
    addEventListener(event, callback) { this[event] = callback; }
  };
  const planText = { textContent: 'Plan Selected: Premium' };
  const form = {
    action: 'https://netguava.com/send-contact.php',
    attributes: {},
    resets: 0,
    querySelector(selector) {
      return selector === '.form-status' ? note : selector === 'input[type=file]' ? upload : null;
    },
    querySelectorAll(selector) {
      return selector === '[type=submit]' ? [button] : selector === '.plan-text' ? [planText] : [];
    },
    addEventListener(event, callback) { this[event] = callback; },
    reportValidity() { return upload.validity === ''; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    reset() { this.resets++; }
  };
  const document = {
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === 'form[data-contact-form]' ? [form] : []; }
  };
  class FormData extends Map {
    constructor() { super([['input_1', 'Test Visitor']]); }
  }
  vm.runInNewContext(source, {
    document, window: { location: { pathname: '/contact/' } }, fetch, FormData, Error
  });
  return { form, note, button, upload, planText, submit: () => form.submit({ preventDefault() {} }) };
}

test('submission sends form data once, disables controls, and resets only after acceptance', async () => {
  let finish;
  const calls = [];
  const app = harness((url, options) => {
    calls.push({ url, options });
    return new Promise(resolve => { finish = resolve; });
  });
  const pending = app.submit();
  await app.submit();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, app.form.action);
  assert.equal(calls[0].options.body.get('source_page'), '/contact/');
  assert.equal(calls[0].options.body.get('input_1'), 'Test Visitor');
  assert.equal(app.button.disabled, true);
  assert.equal(app.form.attributes['aria-busy'], 'true');
  assert.equal(app.note.dataset.state, 'pending');
  finish({ ok: true, json: async () => ({ ok: true }) });
  await pending;
  assert.equal(app.note.dataset.state, 'success');
  assert.equal(app.form.resets, 1);
  assert.equal(app.planText.textContent, '');
  assert.equal(app.button.disabled, false);
  assert.equal(app.form.attributes['aria-busy'], undefined);
});

test('server, network and invalid JSON errors preserve input and allow retry', async () => {
  for (const fetch of [
    async () => ({ ok: false, json: async () => ({ ok: false, error: 'Please select a support plan.' }) }),
    async () => ({ ok: true, json: async () => ({ ok: false }) }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError('Not JSON'); } }),
    async () => { throw new Error('Network unavailable'); }
  ]) {
    const app = harness(fetch);
    await app.submit();
    assert.equal(app.note.dataset.state, 'error');
    assert.equal(app.note.hidden, false);
    assert.equal(app.form.resets, 0);
    assert.equal(app.button.disabled, false);
    await app.submit();
    assert.equal(app.form.resets, 0);
  }
});

test('attachment validation permits exactly 8 MB and rejects anything larger', async () => {
  let calls = 0;
  const app = harness(async () => {
    calls++;
    return { ok: true, json: async () => ({ ok: true }) };
  });
  app.upload.files = [{ size: 8388609 }];
  app.upload.change();
  await app.submit();
  assert.equal(calls, 0);
  assert.match(app.upload.validity, /8 MB/);
  app.upload.files = [{ size: 8388608 }];
  app.upload.change();
  await app.submit();
  assert.equal(calls, 1);
  assert.equal(app.upload.validity, '');
});
