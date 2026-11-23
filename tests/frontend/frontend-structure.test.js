const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'frontend/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'frontend/css/main.css'), 'utf8');
const javascript = fs.readFileSync(path.join(root, 'frontend/js/main.js'), 'utf8');

function extractFunction(name) {
  const start = javascript.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Função ${name} deve existir`);
  const end = javascript.indexOf('\n}', start);
  assert.notEqual(end, -1, `Função ${name} deve estar fechada`);
  return javascript.slice(start, end + 2);
}

function loadFunction(name, globals = {}) {
  return vm.runInNewContext(`${extractFunction(name)}; ${name}`, globals);
}

test('declara as sete telas e possui um item de navegação para cada uma', () => {
  const pages = [...html.matchAll(/data-page="([^"]+)"/g)].map((match) => match[1]);
  const navigation = [...html.matchAll(/data-screen="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(pages, ['dashboard', 'properties', 'ponds', 'record', 'history', 'reports', 'settings']);
  for (const page of pages) assert.ok(navigation.includes(page), `Tela ${page} deve ter navegação`);
});

test('os formulários têm campos obrigatórios e validação associada', () => {
  const requiredFields = {
    propertyForm: ['name'],
    pondForm: ['name', 'propertyId'],
    measurementForm: ['propertyId', 'pondId', 'parameterId', 'value', 'measuredAt']
  };
  for (const [formId, fields] of Object.entries(requiredFields)) {
    const form = html.match(new RegExp(`<form[^>]*id="${formId}"[^>]*>([\\s\\S]*?)<\\/form>`));
    assert.ok(form, `Formulário ${formId} deve existir`);
    for (const field of fields) {
      assert.match(form[1], new RegExp(`name="${field}"[^>]*required|name="${field}"[^>]*>[\\s\\S]*?required`), `${formId}.${field} deve ser obrigatório`);
    }
  }
  assert.match(javascript, /reportValidity\(\)/);
  assert.match(javascript, /setCustomValidity\(/);
  assert.match(javascript, /não esteja no futuro/);
});

test('a navegação mostra uma tela, atualiza o item ativo e o título', () => {
  const pageNames = ['dashboard', 'properties', 'ponds', 'record', 'history', 'reports', 'settings'];
  const labels = ['Painel geral', 'Propriedades', 'Viveiros e tanques', 'Registrar medição', 'Histórico', 'Gráficos e relatórios', 'Configurações'];
  const makeClassList = () => {
    const values = new Set();
    return {
      add(value) { values.add(value); },
      remove(value) { values.delete(value); },
      toggle(value, force) { if (force ?? !values.has(value)) values.add(value); else values.delete(value); },
      contains(value) { return values.has(value); }
    };
  };
  const pages = pageNames.map((name) => ({ dataset: { page: name }, hidden: name !== 'dashboard', classList: makeClassList() }));
  const navItems = pageNames.map((name, index) => ({
    dataset: { screen: name }, classList: makeClassList(), attributes: {},
    querySelector() { return { textContent: labels[index] }; },
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; }
  }));
  const tabs = [{ dataset: { settingsTab: 'general' }, classList: makeClassList() }];
  const currentSection = { textContent: '' };
  const getElementById = (id) => id === 'currentSection' ? currentSection : { classList: makeClassList(), setAttribute() {} };
  const document = {
    querySelector(selector) {
      const page = selector.match(/^\[data-page="([^"]+)"\]$/);
      if (page) return pages.find((item) => item.dataset.page === page[1]);
      const nav = selector.match(/^\.nav-item\[data-screen="([^"]+)"\]$/);
      if (nav) return navItems.find((item) => item.dataset.screen === nav[1]);
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.page-section') return pages;
      if (selector === '.nav-item[data-screen]') return navItems;
      if (selector === '.settings-tab') return tabs;
      return [];
    },
    getElementById
  };
  const goToScreen = loadFunction('goToScreen', { document, window: { scrollTo() {} }, requestAnimationFrame() {}, closeSidebar() {}, drawCharts() {} });
  goToScreen('reports');
  assert.deepEqual(pages.map((page) => page.hidden), [true, true, true, true, true, false, true]);
  assert.equal(navItems[5].classList.contains('active'), true);
  assert.equal(navItems[5].attributes['aria-current'], 'page');
  assert.equal(currentSection.textContent, 'Gráficos e relatórios');
});

test('a função de escape protege conteúdo do usuário antes de inseri-lo na interface', () => {
  const escapeHTML = loadFunction('escapeHTML');
  assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(escapeHTML("O'Brien & água"), 'O&#39;Brien &amp; água');
  assert.match(javascript, /escapeHTML\(property\.name\)/);
  assert.match(javascript, /escapeHTML\(pond\.name\)/);
});

test('a série do gráfico mantém os extremos e gera a quantidade pedida de pontos', () => {
  const makeSeries = loadFunction('makeSeries');
  const values = makeSeries([2, 4, 6], 5);
  assert.equal(values.length, 5);
  assert.equal(values[0], 2);
  assert.equal(values[4], 6);
  assert.equal(values[2], 4);
});

test('o desenho de linha dimensiona o canvas pela densidade da tela e pinta a série', () => {
  let strokes = 0;
  let fills = 0;
  const context = {
    setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, arc() {},
    createLinearGradient() { return { addColorStop() {} }; },
    fill() { fills += 1; }, stroke() { strokes += 1; }
  };
  const canvas = { width: 0, height: 0, getBoundingClientRect: () => ({ width: 320, height: 140 }), getContext: () => context };
  const drawLineChart = loadFunction('drawLineChart', { window: { devicePixelRatio: 2 }, niceDomain: loadFunction('niceDomain') });
  drawLineChart(canvas, [1, 3, 2]);
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 280);
  assert.equal(strokes, 5);
  assert.equal(fills, 3);
});

test('gráficos têm descrições acessíveis e a distribuição também aparece em texto', () => {
  for (const id of ['dashboardChart', 'reportChart', 'distributionChart']) {
    const canvas = html.match(new RegExp(`<canvas[^>]*id="${id}"[^>]*aria-describedby="([^"]+)"`));
    assert.ok(canvas, `${id} precisa de descrição acessível`);
    assert.ok(html.includes(`id="${canvas[1]}"`), `Descrição de ${id} deve existir`);
  }
  assert.match(html, /id="distributionChartDescription"/);
  assert.match(javascript, /Distribuição real:/);
  assert.match(javascript, /dashboardChartDescription/);
  assert.match(javascript, /reportChartDescription/);
});

test('alvos de navegação e identificadores HTML são únicos e localizáveis', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(duplicates, []);
  assert.match(html, /class="skip-link" href="#mainContent"/);
  assert.match(html, /<main[^>]*id="mainContent"[^>]*tabindex="-1"/);
  assert.match(html, /aria-controls="sidebar" aria-expanded="false"/);
  assert.match(css, /\.sidebar\.is-open\s*\{\s*visibility:\s*visible/);
});

test('o layout declara breakpoints responsivos e suporte a movimento reduzido', () => {
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /@media \(max-width: 580px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(html, /name="viewport"/);
});

test('frontend usa API centralizada e não mantém cópias locais de dados operacionais', () => {
  const api = fs.readFileSync(path.join(root, 'frontend/js/api.js'), 'utf8');
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /id="authGate"/);
  assert.match(html, /id="registerForm"/);
  assert.match(api, /fetch\(/);
  assert.match(api, /credentials: 'same-origin'/);
  assert.match(javascript, /window\.aquaApi\.get\('\/properties'\)/);
  assert.match(javascript, /window\.aquaApi\.post\('\/measurements'/);
  assert.doesNotMatch(javascript, /createDemoReadings|const properties = \[|localStorage|sessionStorage/);
  assert.doesNotMatch(api, /localStorage|sessionStorage/);
});

test('tabelas têm cabeçalhos, legendas acessíveis e regiões navegáveis', () => {
  const tableCount = (html.match(/<table>/g) || []).length;
  const captionCount = (html.match(/<caption/g) || []).length;
  const regionCount = (html.match(/class="table-scroll" role="region" tabindex="0"/g) || []).length;
  assert.equal(tableCount, 3);
  assert.equal(captionCount, tableCount);
  assert.equal(regionCount, tableCount);
  assert.ok(!/<th>(?!<)/.test(html), 'Cabeçalhos de tabela devem declarar scope');
});
