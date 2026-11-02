const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

let modules;
async function getModules() {
  modules ||= Promise.all([
    import('../public/js/config.mjs'),
    import('../public/js/utils.mjs')
  ]).then(([config, utils]) => ({ ...config, ...utils }));
  return modules;
}

test('los cuatro perfiles documentales muestran casos de uso sin undefined', async () => {
  const { USE_CASES, identifyUseCase, formatUseCaseLabel } = await getModules();
  const expected = {
    nps: 'Track 1 · Continuidad asistencial · NPS / IPS',
    lab: 'Informe de laboratorio',
    notif: 'Track 2 · Evento epidemiológico · eCR',
    onco: 'Track 3 · Registro Nacional de Cáncer · RENAC'
  };
  assert.equal(USE_CASES.length, 4);
  for (const useCase of USE_CASES) {
    const bundle = { resourceType: 'Bundle', type: 'document', meta: { profile: [useCase.profile] } };
    const actual = formatUseCaseLabel(identifyUseCase(bundle));
    assert.equal(actual, expected[useCase.key]);
    assert.doesNotMatch(actual, /undefined|null|NaN/);
  }
});

test('el formato funciona con metadatos anteriores aún en caché y sin track', async () => {
  const { formatUseCaseLabel } = await getModules();
  assert.equal(formatUseCaseLabel({ key: 'nps', label: 'Continuidad asistencial · NPS / IPS' }), 'Track 1 · Continuidad asistencial · NPS / IPS');
  assert.equal(formatUseCaseLabel({ key: 'lab', label: 'Informe de laboratorio' }), 'Informe de laboratorio');
  assert.equal(formatUseCaseLabel(null), 'No identificado');
  assert.equal(formatUseCaseLabel({ key: 'custom', label: 'Otro documento' }), 'Otro documento');
  assert.equal(formatUseCaseLabel({ key: 'custom', label: 'Otro', track: 4 }), 'Track 4 · Otro');
});

test('la interfaz activa utiliza el helper en el resumen del Bundle, cabecera y publicación', () => {
  const main = fs.readFileSync(path.join(root, 'public/main.mjs'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.equal((main.match(/formatUseCaseLabel\(useCase\)/g) || []).length, 3);
  assert.doesNotMatch(main, /useCase\.track/);
  assert.match(html, /src="\/main\.mjs\?v=1\.9\.1"/);
  assert.doesNotMatch(html, /<script[^>]+src="\/app\.js"/);
  for (const page of ['home', 'resources', 'guided', 'editor', 'iti65', 'queries', 'servers', 'activity']) {
    assert.match(html, new RegExp(`data-page-target="${page}"`));
  }
});

test('el servidor invalida caché de HTML y módulos JS', async () => {
  const { serveStatic } = require('../http/staticFiles');
  const http = require('node:http');
  const publicDir = path.join(root, 'public');
  const server = http.createServer((req, res) => serveStatic(req, res, publicDir));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const pathname of ['/', '/main.mjs', '/js/utils.mjs', '/js/config.mjs']) {
      const res = await fetch(`http://127.0.0.1:${server.address().port}${pathname}`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('cache-control') || '', /no-cache/);
      await res.arrayBuffer();
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
