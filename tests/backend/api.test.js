const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initializeDatabase, openDatabase, createSchema } = require('../../backend/src/database');
const { createApp } = require('../../backend/src/app');
const { seedTechnicalReferences } = require('../../backend/src/database/technical-reference-seed');

async function createServer(database, authenticatedId) {
  const app = createApp({ database, authenticationMiddleware(request, response, next) {
    request.user = { id: authenticatedId };
    next();
  } });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  return { server, userId: authenticatedId, baseUrl: `http://127.0.0.1:${server.address().port}/api` };
}

async function createApi(name) {
  const database = openDatabase(':memory:');
  createSchema(database);
  seedTechnicalReferences(database);
  const user = database.prepare('INSERT INTO users (name) VALUES (?)').run(name);
  const api = await createServer(database, Number(user.lastInsertRowid));
  return { ...api, database };
}

async function request(baseUrl, route, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = response.status === 204 ? null : await response.json();
  return { response, data };
}

test('API protege dados por produtor e executa operações REST com integridade', async (context) => {
  const owner = await createApi('Produtor 1');
  const otherUser = owner.database.prepare('INSERT INTO users (name) VALUES (?)').run('Produtor 2');
  const other = await createServer(owner.database, Number(otherUser.lastInsertRowid));
  context.after(() => {
    owner.server.close(); owner.database.close();
    other.server.close();
  });

  const unauthenticated = createApp({ database: owner.database });
  const unauthServer = await new Promise((resolve) => {
    const listener = unauthenticated.listen(0, '127.0.0.1', () => resolve(listener));
  });
  context.after(() => unauthServer.close());
  const unauth = await request(`http://127.0.0.1:${unauthServer.address().port}/api`, '/properties');
  assert.equal(unauth.response.status, 401);
  assert.equal(unauth.response.headers.get('x-powered-by'), null);

  const propertyResult = await request(owner.baseUrl, '/properties', {
    method: 'POST', body: { name: 'Sítio das Águas', municipality: 'Itu', state: 'SP' }
  });
  assert.equal(propertyResult.response.status, 201);
  const propertyId = propertyResult.data.data.id;
  assert.equal((await request(other.baseUrl, `/properties/${propertyId}`)).response.status, 404);
  assert.equal((await request(owner.baseUrl, '/properties', { method: 'POST', body: { name: '' } })).response.status, 400);

  const species = await request(owner.baseUrl, '/species', { method: 'POST', body: { commonName: 'Tilápia' } });
  const parameter = await request(owner.baseUrl, '/parameters', { method: 'POST', body: { name: 'Oxigênio dissolvido', unit: 'mg/L' } });
  assert.equal(species.response.status, 201);
  assert.equal(parameter.response.status, 201);
  const pond = await request(owner.baseUrl, '/ponds', { method: 'POST', body: {
    propertyId, speciesId: species.data.data.id, name: 'Viveiro 1', volumeM3: 1200
  } });
  assert.equal(pond.response.status, 201);
  const pondId = pond.data.data.id;
  assert.equal((await request(other.baseUrl, `/properties/${propertyId}/ponds`)).response.status, 404);
  assert.equal((await request(other.baseUrl, `/ponds/${pondId}`, { method: 'PATCH', body: { name: 'Invadido' } })).response.status, 404);

  const measurement = await request(owner.baseUrl, '/measurements', { method: 'POST', body: {
    pondId, parameterId: parameter.data.data.id, value: 5.2, unit: 'mg/L', measuredAt: '2026-11-22T15:00:00.000Z'
  } });
  assert.equal(measurement.response.status, 201);
  const measurementId = measurement.data.data.id;
  const history = await request(owner.baseUrl,
    `/ponds/${pondId}/measurements?parameterId=${parameter.data.data.id}&from=2026-11-22T00%3A00%3A00.000Z`);
  assert.equal(history.response.status, 200);
  assert.equal(history.data.data.length, 1);
  assert.equal((await request(owner.baseUrl, '/measurements?parameterId=abc')).response.status, 400);
  assert.equal((await request(other.baseUrl, `/measurements/${measurementId}`)).response.status, 404);
  assert.equal((await request(owner.baseUrl, '/measurements/99999')).response.status, 404);
  assert.equal((await request(owner.baseUrl, `/properties/${propertyId}`, { method: 'DELETE' })).response.status, 409);

  const references = await request(owner.baseUrl, '/references', { method: 'POST', body: {
    speciesId: species.data.data.id, parameterId: parameter.data.data.id,
    title: 'Referência sem limite preenchido', sourceName: 'Fonte informada pelo usuário', unit: 'mg/L'
  } });
  assert.equal(references.response.status, 201);
  assert.equal(references.data.data.minimumValue, null);
  assert.equal(references.data.data.referenceVersion, null);
  const unclassifiedRange = await request(owner.baseUrl, '/references', { method: 'POST', body: {
    speciesId: species.data.data.id, parameterId: parameter.data.data.id,
    title: 'Faixa sem classificação', sourceName: 'Fonte informada pelo usuário',
    minimumValue: 0, maximumValue: 1, unit: 'mg/L'
  } });
  assert.equal(unclassifiedRange.response.status, 400);
  assert.equal((await request(owner.baseUrl, `/species/${species.data.data.id}/references`)).data.data.length, 1);
  const dashboard = await request(owner.baseUrl, '/dashboard/summary');
  assert.deepEqual(dashboard.data.data, { properties: 1, ponds: 1, measurements: 1 });

  assert.equal((await request(owner.baseUrl, `/measurements/${measurementId}`, { method: 'DELETE' })).response.status, 204);
});

test('cadastro, login, sessão e logout usam senha com hash e cookie HttpOnly', async (context) => {
  const database = openDatabase(':memory:'); createSchema(database); seedTechnicalReferences(database);
  const app = createApp({ database });
  const server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  context.after(() => { server.close(); database.close(); });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const created = await request(baseUrl, '/auth/register', { method: 'POST', body: { name: 'Produtor Novo', email: 'novo@example.com', password: 'SenhaSegura123!' } });
  assert.equal(created.response.status, 201);
  const cookie = created.response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
  assert.equal(database.prepare('SELECT password_hash FROM users WHERE id = ?').get(created.data.data.user.id).password_hash.startsWith('scrypt$'), true);
  assert.equal((await request(baseUrl, '/auth/session', { cookie })).response.status, 200);
  assert.equal((await request(baseUrl, '/auth/login', { method: 'POST', body: { email: 'novo@example.com', password: 'senha-errada' } })).response.status, 401);
  const login = await request(baseUrl, '/auth/login', { method: 'POST', body: { email: 'novo@example.com', password: 'SenhaSegura123!' } });
  assert.equal(login.response.status, 200);
  const loginCookie = login.response.headers.get('set-cookie');
  assert.equal((await request(baseUrl, '/auth/logout', { method: 'POST', body: {}, cookie: loginCookie })).response.status, 204);
  assert.equal((await request(baseUrl, '/auth/session', { cookie: loginCookie })).response.status, 401);
});

test('análise aplica apenas referência contextual compatível e registra sua versão', async (context) => {
  const api = await createApi('Produtor análise');
  context.after(() => { api.server.close(); api.database.close(); });
  const species = api.database.prepare("SELECT id FROM species WHERE common_name = 'Tilápia-do-Nilo'").get().id;
  const property = await request(api.baseUrl, '/properties', { method: 'POST', body: { name: 'Propriedade técnica' } });
  const pond = await request(api.baseUrl, '/ponds', { method: 'POST', body: {
    propertyId: property.data.data.id, speciesId: species, name: 'Viveiro técnico',
    cultivationPhase: 'Engorda', cultureSystem: 'semi-intensivo', waterType: 'freshwater'
  } });
  const temperature = api.database.prepare("SELECT id FROM water_parameters WHERE analyte_code = 'temperature_c'").get().id;
  const measurement = await request(api.baseUrl, '/measurements', { method: 'POST', body: {
    pondId: pond.data.data.id, parameterId: temperature, value: 40, unit: '°C', measuredAt: '2026-11-22T15:00:00.000Z'
  } });
  const analysis = await request(api.baseUrl, `/measurements/${measurement.data.data.id}/analysis`, { method: 'POST', body: {} });
  assert.equal(analysis.response.status, 201);
  assert.equal(analysis.data.data.classification, 'critical');
  assert.equal(analysis.data.data.items[0].sourceVersion, '1.0.1');
  assert.equal(analysis.data.data.items[0].sourceReferenceId != null, true);

  const unsupportedPond = await request(api.baseUrl, '/ponds', { method: 'POST', body: {
    propertyId: property.data.data.id, speciesId: species, name: 'Viveiro sem contexto', cultivationPhase: 'Recria'
  } });
  const unsupportedMeasurement = await request(api.baseUrl, '/measurements', { method: 'POST', body: {
    pondId: unsupportedPond.data.data.id, parameterId: temperature, value: 28, unit: '°C', measuredAt: '2026-11-22T16:00:00.000Z'
  } });
  const unsupported = await request(api.baseUrl, `/measurements/${unsupportedMeasurement.data.data.id}/analysis`, { method: 'POST', body: {} });
  assert.equal(unsupported.data.data.classification, 'insufficient');
  assert.equal(unsupported.data.data.items[0].sourceReferenceId, null);
});

test('sessão e dados do produtor continuam válidos após reiniciar o servidor', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamanejo-api-restart-'));
  const databasePath = path.join(directory, 'aquamanejo.sqlite');
  let database = initializeDatabase(databasePath);
  let server = await new Promise((resolve) => {
    const listener = createApp({ database }).listen(0, '127.0.0.1', () => resolve(listener));
  });
  let baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const registration = await request(baseUrl, '/auth/register', { method: 'POST', body: {
    name: 'Produtor persistente', email: 'persistente@example.com', password: 'SenhaSegura123!'
  } });
  assert.equal(registration.response.status, 201);
  let cookie = registration.response.headers.get('set-cookie');
  const property = await request(baseUrl, '/properties', { method: 'POST', cookie, body: { name: 'Sítio persistido' } });
  assert.equal(property.response.status, 201);
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  database.close();

  database = initializeDatabase(databasePath);
  server = await new Promise((resolve) => {
    const listener = createApp({ database }).listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (database.open) database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  assert.equal((await request(baseUrl, '/auth/session', { cookie })).response.status, 200);
  assert.equal((await request(baseUrl, '/properties', { cookie })).data.data[0].name, 'Sítio persistido');
});

test('bloqueia origens web externas e não aceita URLs javascript em referências', async (context) => {
  const api = await createApi('Produtor CORS');
  context.after(() => { api.server.close(); api.database.close(); });
  const blocked = await fetch(`${api.baseUrl}/auth/register`, {
    method: 'POST', headers: { origin: 'https://fora.example', 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Bloqueado', email: 'bloqueado@example.com', password: 'SenhaSegura123!' })
  });
  assert.equal(blocked.status, 403);
  const speciesId = api.database.prepare('SELECT id FROM species LIMIT 1').get().id;
  const parameter = await request(api.baseUrl, '/parameters', { method: 'POST', body: { name: 'Teste URL', unit: 'mg/L' } });
  const unsafeUrl = await request(api.baseUrl, '/references', { method: 'POST', body: {
    speciesId, parameterId: parameter.data.data.id, title: 'Fonte teste', sourceName: 'Teste',
    sourceUrl: 'javascript:alert(1)', unit: 'mg/L'
  } });
  assert.equal(unsafeUrl.response.status, 400);
});

test('serve a interface na mesma origem e publica cabeçalhos de proteção', async (context) => {
  const api = await createApi('Produtor web');
  context.after(() => { api.server.close(); api.database.close(); });
  const base = api.baseUrl.slice(0, -4);
  const response = await fetch(`${base}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<html lang="pt-BR">/);
  assert.equal(response.headers.get('content-security-policy')?.includes("connect-src 'self'"), true);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('analisa TAN somente com pH e temperatura simultâneos em água doce', async (context) => {
  const api = await createApi('Produtor TAN');
  context.after(() => { api.server.close(); api.database.close(); });
  const speciesId = api.database.prepare("SELECT id FROM species WHERE common_name = 'Tilápia-do-Nilo'").get().id;
  const property = await request(api.baseUrl, '/properties', { method: 'POST', body: { name: 'Propriedade TAN' } });
  const pond = await request(api.baseUrl, '/ponds', { method: 'POST', body: {
    propertyId: property.data.data.id, speciesId, name: 'Água doce', cultivationPhase: 'Engorda',
    cultureSystem: 'semi-intensivo', waterType: 'freshwater'
  } });
  const params = Object.fromEntries(api.database.prepare('SELECT analyte_code AS code, id FROM water_parameters WHERE analyte_code IS NOT NULL').all().map((row) => [row.code, row.id]));
  const instant = '2026-11-22T15:00:00.000Z';
  for (const [code, value, unit] of [['ph', 8, 'pH'], ['temperature_c', 30, '°C']]) {
    const result = await request(api.baseUrl, '/measurements', { method: 'POST', body: {
      pondId: pond.data.data.id, parameterId: params[code], value, unit, measuredAt: instant
    } });
    assert.equal(result.response.status, 201);
  }
  const tan = await request(api.baseUrl, '/measurements', { method: 'POST', body: {
    pondId: pond.data.data.id, parameterId: params.total_ammonia_nitrogen_tan_n, value: 1, unit: 'mg N/L', measuredAt: instant
  } });
  const analysis = await request(api.baseUrl, `/measurements/${tan.data.data.id}/analysis`, { method: 'POST', body: {} });
  assert.equal(analysis.data.data.classification, 'attention');
  assert.equal(analysis.data.data.items[0].evaluatedUnit, 'mg/L');
  assert.equal(analysis.data.data.items[0].contextSnapshot.temperatureMeasurementId != null, true);

  const brackish = await request(api.baseUrl, '/ponds', { method: 'POST', body: {
    propertyId: property.data.data.id, speciesId, name: 'Água salobra', cultivationPhase: 'Engorda',
    cultureSystem: 'semi-intensivo', waterType: 'brackish', salinityPpt: 5
  } });
  const brackishTan = await request(api.baseUrl, '/measurements', { method: 'POST', body: {
    pondId: brackish.data.data.id, parameterId: params.total_ammonia_nitrogen_tan_n,
    value: 1, unit: 'mg N/L', measuredAt: instant
  } });
  const unsupported = await request(api.baseUrl, `/measurements/${brackishTan.data.data.id}/analysis`, { method: 'POST', body: {} });
  assert.equal(unsupported.data.data.classification, 'insufficient');
});
