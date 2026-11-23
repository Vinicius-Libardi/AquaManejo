/* Interface AquaManejo: todos os registros operacionais vêm da API. */
const state = {
  user: null,
  properties: [],
  ponds: [],
  species: [],
  parameters: [],
  readings: [],
  historyReadings: [],
  summary: { properties: 0, ponds: 0, measurements: 0 },
  editingPropertyId: null,
  editingPondId: null,
  toastTimer: null
};

const labels = {
  dashboard: 'Painel geral', properties: 'Propriedades', ponds: 'Viveiros e tanques',
  record: 'Registrar medição', history: 'Histórico', reports: 'Gráficos e relatórios', settings: 'Configurações'
};
const classificationLabels = {
  adequate: 'Adequado', attention: 'Atenção', critical: 'Crítico', insufficient: 'Sem referência suficiente'
};

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function getProperty(id) { return state.properties.find((property) => String(property.id) === String(id)); }
function getPond(id) { return state.ponds.find((pond) => String(pond.id) === String(id)); }
function propertyForPond(pond) { return pond ? getProperty(pond.propertyId) : undefined; }
function getParameter(id) { return state.parameters.find((parameter) => String(parameter.id) === String(id)); }
function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(Number(value));
}
function formatDateTime(value, options = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data inválida';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', ...options }).format(date);
}
function formatValue(reading) {
  const parameter = getParameter(reading.parameterId);
  return `${formatNumber(reading.value)}${reading.unit ? ` ${reading.unit}` : ''}${parameter ? '' : ''}`;
}
function statusBadge(classification) {
  if (!classification) return '<span class="demo-status analysis-insufficient">Não analisada</span>';
  const status = classification || 'insufficient';
  const className = `analysis-${status}`;
  return `<span class="demo-status ${className}">${classificationLabels[status] || classificationLabels.insufficient}</span>`;
}
function makeSeries(values, count) {
  if (!values.length || count <= 0) return [];
  if (values.length === 1) return Array.from({ length: count }, () => values[0]);
  return Array.from({ length: count }, (_, index) => {
    const position = index * (values.length - 1) / (count - 1);
    const left = Math.floor(position);
    const fraction = position - left;
    return values[left] + (values[Math.min(left + 1, values.length - 1)] - values[left]) * fraction;
  });
}
function niceDomain(values) {
  if (!values.length) return { minimum: 0, maximum: 1 };
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = maximum === minimum ? Math.max(Math.abs(maximum) * 0.1, 1) : (maximum - minimum) * 0.15;
  return { minimum: minimum - padding, maximum: maximum + padding };
}
function drawLineChart(canvas, values, color = '#2b83d8') {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  const bounds = canvas.getBoundingClientRect();
  if (!context || !bounds.width || !bounds.height) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  const padding = { top: 10, right: 12, bottom: 12, left: 12 };
  const width = bounds.width - padding.left - padding.right;
  const height = bounds.height - padding.top - padding.bottom;
  const { minimum, maximum } = niceDomain(values);
  context.strokeStyle = '#e8eff5';
  context.lineWidth = 1;
  for (let line = 0; line < 4; line += 1) {
    const y = padding.top + height * line / 3;
    context.beginPath(); context.moveTo(padding.left, y); context.lineTo(padding.left + width, y); context.stroke();
  }
  if (!values.length) return;
  const points = values.map((value, index) => ({
    x: padding.left + width * index / Math.max(values.length - 1, 1),
    y: padding.top + height * (1 - (value - minimum) / (maximum - minimum))
  }));
  context.beginPath();
  points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
  context.strokeStyle = color; context.lineWidth = 2.5; context.stroke();
  points.forEach((point) => { context.beginPath(); context.arc(point.x, point.y, 3.5, 0, Math.PI * 2); context.fillStyle = color; context.fill(); });
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMessage').textContent = message;
  toast.classList.toggle('is-error', isError);
  toast.classList.add('is-visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4200);
}

function withLoading(button, operation) {
  return async (...args) => {
    if (button) { button.disabled = true; button.dataset.originalText ||= button.textContent; button.textContent = 'Aguarde…'; }
    const loading = document.getElementById('appLoading');
    if (loading) loading.hidden = false;
    try { return await operation(...args); }
    finally {
      if (button) { button.disabled = false; button.textContent = button.dataset.originalText || 'Salvar'; }
      if (loading) loading.hidden = true;
    }
  };
}

function goToScreen(screen) {
  const screenLabels = { dashboard: 'Painel geral', properties: 'Propriedades', ponds: 'Viveiros e tanques', record: 'Registrar medição', history: 'Histórico', reports: 'Gráficos e relatórios', settings: 'Configurações' };
  if (!screenLabels[screen]) return;
  document.querySelectorAll('.page-section').forEach((page) => {
    const visible = page.dataset.page === screen;
    page.hidden = !visible;
    page.classList.toggle('is-visible', visible);
  });
  document.querySelectorAll('.nav-item[data-screen]').forEach((item) => {
    const active = item.dataset.screen === screen;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
  });
  document.getElementById('currentSection').textContent = screenLabels[screen];
  document.querySelectorAll('.settings-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.settingsTab === 'general'));
  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (screen === 'dashboard' || screen === 'reports') requestAnimationFrame(drawCharts);
  if (screen === 'history') renderHistory();
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('is-open');
  document.getElementById('sidebarBackdrop')?.classList.remove('is-visible');
  const button = document.getElementById('mobileMenuButton');
  if (button) { button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-label', 'Abrir menu'); }
}

function optionsFor(items, selected, placeholder, labelFor) {
  return `<option value="">${escapeHTML(placeholder)}</option>` + items.map((item) =>
    `<option value="${item.id}" ${String(item.id) === String(selected) ? 'selected' : ''}>${escapeHTML(labelFor(item))}</option>`).join('');
}

function updateSelects() {
  const propertySelect = document.getElementById('pondProperty');
  const measurementProperty = document.getElementById('measurementProperty');
  const filter = document.getElementById('pondPropertyFilter');
  const oldProperty = propertySelect.value;
  const oldMeasurementProperty = measurementProperty.value;
  const oldFilter = filter.value;
  propertySelect.innerHTML = optionsFor(state.properties, oldProperty, 'Selecione uma propriedade', (item) => item.name);
  measurementProperty.innerHTML = optionsFor(state.properties, oldMeasurementProperty, 'Selecione uma propriedade', (item) => item.name);
  filter.innerHTML = '<option value="all">Todas as propriedades</option>' + state.properties.map((item) =>
    `<option value="${item.id}" ${String(item.id) === String(oldFilter) ? 'selected' : ''}>${escapeHTML(item.name)}</option>`).join('');
  const historyPond = document.getElementById('historyPondFilter');
  const reportPond = document.getElementById('reportPondFilter');
  const previousHistory = historyPond.value;
  const previousReport = reportPond.value;
  historyPond.innerHTML = '<option value="all">Todos os viveiros</option>' + state.ponds.map((item) => `<option value="${item.id}" ${String(item.id) === previousHistory ? 'selected' : ''}>${escapeHTML(item.name)}</option>`).join('');
  reportPond.innerHTML = '<option value="all">Todos os viveiros</option>' + state.ponds.map((item) => `<option value="${item.id}" ${String(item.id) === previousReport ? 'selected' : ''}>${escapeHTML(item.name)}</option>`).join('');
  const speciesSelect = document.getElementById('pondSpecies');
  const previousSpecies = speciesSelect.value;
  speciesSelect.innerHTML = optionsFor(state.species, previousSpecies, 'Selecione se aplicável', (item) => item.commonName);
  const parameterSelect = document.getElementById('measurementParameter');
  const previousParameter = parameterSelect.value;
  parameterSelect.innerHTML = optionsFor(state.parameters, previousParameter, 'Selecione um parâmetro', (item) => `${item.name} (${item.unit})`);
  const dashboardParameter = document.getElementById('dashboardParameter');
  const previousDashboardParameter = dashboardParameter.value;
  dashboardParameter.innerHTML = optionsFor(state.parameters, previousDashboardParameter, 'Selecione um parâmetro', (item) => item.name);
  const historyParameter = document.getElementById('historyParameterFilter');
  const previousParameterFilter = historyParameter.value;
  historyParameter.innerHTML = '<option value="all">Todos os parâmetros</option>' + state.parameters.map((item) => `<option value="${item.id}" ${String(item.id) === previousParameterFilter ? 'selected' : ''}>${escapeHTML(item.name)}</option>`).join('');
  const reportParameter = document.getElementById('reportParameter');
  const previousReportParameter = reportParameter.value;
  reportParameter.innerHTML = optionsFor(state.parameters, previousReportParameter, 'Selecione um parâmetro', (item) => item.name);
  updateMeasurementPonds();
  updateParameterUnit();
}

function updateMeasurementPonds() {
  const propertyId = document.getElementById('measurementProperty').value;
  const select = document.getElementById('measurementPond');
  const previous = select.value;
  const matches = state.ponds.filter((pond) => String(pond.propertyId) === propertyId);
  select.innerHTML = optionsFor(matches, previous, matches.length ? 'Selecione uma estrutura' : 'Cadastre um viveiro primeiro', (pond) => pond.name);
  select.disabled = matches.length === 0;
}

function updateParameterUnit() {
  const parameter = getParameter(document.getElementById('measurementParameter').value);
  document.getElementById('measurementUnit').textContent = parameter?.unit || '—';
}

function renderPropertyCards() {
  const container = document.getElementById('propertyCards');
  container.innerHTML = state.properties.map((property) => {
    const linked = state.ponds.filter((pond) => pond.propertyId === property.id).length;
    const location = [property.municipality, property.state].filter(Boolean).join(' · ') || 'Localização não informada';
    return `<article class="property-card"><div class="property-card-top"><div class="property-card-icon" aria-hidden="true">⌂</div><div><h3>${escapeHTML(property.name)}</h3><p class="property-location">${escapeHTML(location)}</p></div></div><div class="property-card-details"><span><small>ESTRUTURAS</small>${linked} cadastradas</span><span><small>ÁREA TOTAL</small>${property.areaHectares == null ? 'Não informada' : `${formatNumber(property.areaHectares)} ha`}</span><span><small>CADASTRO</small>${escapeHTML(formatDateTime(property.createdAt))}</span></div><div class="inline-actions"><button type="button" data-action="edit-property" data-id="${property.id}">Editar</button><button type="button" data-action="delete-property" data-id="${property.id}">Excluir</button></div></article>`;
  }).join('') || '<div class="panel empty-state"><strong>Nenhuma propriedade cadastrada</strong><p>Use o formulário para adicionar a primeira propriedade.</p></div>';
  document.getElementById('propertyCount').textContent = state.properties.length;
  document.getElementById('propertyScreenCount').textContent = String(state.properties.length).padStart(2, '0');
  document.getElementById('propertyListDescription').textContent = `${state.properties.length} ${state.properties.length === 1 ? 'propriedade cadastrada' : 'propriedades cadastradas'}`;
}

function renderPondCards() {
  const selected = document.getElementById('pondPropertyFilter').value;
  const matches = state.ponds.filter((pond) => selected === 'all' || String(pond.propertyId) === selected);
  document.getElementById('pondCards').innerHTML = matches.map((pond) => {
    const property = propertyForPond(pond);
    const conditions = [pond.speciesName, pond.cultivationPhase, pond.cultureSystem].filter(Boolean).join(' · ') || 'Contexto de cultivo incompleto';
    return `<article class="pond-card"><div class="pond-card-top"><div class="pond-card-heading"><div class="property-card-icon" aria-hidden="true">▤</div><div><h3>${escapeHTML(pond.name)}</h3><p class="pond-card-species">${escapeHTML(conditions)}</p></div></div></div><div class="pond-card-details"><span><small>TIPO</small>${escapeHTML(pond.structureType || 'Não informado')}</span><span><small>VOLUME</small>${pond.volumeM3 == null ? 'Não informado' : `${formatNumber(pond.volumeM3)} m³`}</span><span><small>ÁGUA / SALINIDADE</small>${escapeHTML(pond.waterType || 'Não informada')}${pond.salinityPpt == null ? '' : ` · ${formatNumber(pond.salinityPpt)} ppt`}</span></div><div class="pond-property-label">⌂ ${escapeHTML(property?.name || 'Propriedade indisponível')}</div><div class="inline-actions"><button type="button" data-action="edit-pond" data-id="${pond.id}">Editar</button><button type="button" data-action="delete-pond" data-id="${pond.id}">Excluir</button></div></article>`;
  }).join('') || '<div class="panel empty-state"><strong>Nenhuma estrutura cadastrada</strong><p>Adicione uma estrutura vinculada a uma propriedade.</p></div>';
  document.getElementById('metricPonds').textContent = state.ponds.length;
  renderDashboardPonds();
}

function renderDashboardPonds() {
  const container = document.getElementById('dashboardPondList');
  container.innerHTML = state.ponds.slice(0, 4).map((pond) => {
    const property = propertyForPond(pond);
    const readings = state.readings.filter((reading) => reading.pondId === pond.id).length;
    return `<div class="pond-list-item"><span class="pond-mini-icon" aria-hidden="true">▤</span><span class="pond-mini-main"><strong>${escapeHTML(pond.name)}</strong><small>${escapeHTML(property?.name || '')} · ${readings} medições</small></span></div>`;
  }).join('') || '<p class="empty-state">Cadastre uma estrutura para ver o resumo.</p>';
}

function measurementRow(reading) {
  const analysisButtons = reading.analysisClassification
    ? `<button type="button" data-action="view-analysis" data-id="${reading.id}">Ver análise</button><button type="button" data-action="reanalyze" data-id="${reading.id}">Reanalisar</button>`
    : `<button type="button" data-action="analyze" data-id="${reading.id}">Analisar</button>`;
  return `<tr><td>${escapeHTML(reading.parameterName)}</td><td><strong>${escapeHTML(reading.pondName)}</strong></td><td>${escapeHTML(reading.propertyName)}</td><td><span class="measurement-value">${escapeHTML(formatValue(reading))}</span></td><td>${escapeHTML(formatDateTime(reading.measuredAt))}</td><td>${escapeHTML(reading.notes || '—')}</td><td>${statusBadge(reading.analysisClassification)}<div class="inline-actions">${analysisButtons}<button type="button" data-action="delete-measurement" data-id="${reading.id}">Excluir</button></div></td></tr>`;
}

function renderRecentMeasurements() {
  document.getElementById('recentMeasurements').innerHTML = state.readings.slice(0, 5).map((reading) =>
    `<tr><td>${escapeHTML(reading.parameterName)}</td><td><strong>${escapeHTML(reading.pondName)}</strong></td><td>${escapeHTML(formatValue(reading))}</td><td>${escapeHTML(formatDateTime(reading.measuredAt))}</td><td>${statusBadge(reading.analysisClassification)}</td></tr>`).join('');
  document.getElementById('metricReadings').textContent = state.summary.measurements;
  document.getElementById('metricProperties').textContent = state.summary.properties;
  document.getElementById('metricPeriod').textContent = state.readings[0] ? formatDateTime(state.readings[0].measuredAt) : '—';
}

async function loadHistory() {
  const params = new URLSearchParams();
  const pondId = document.getElementById('historyPondFilter').value;
  const parameterId = document.getElementById('historyParameterFilter').value;
  const from = document.getElementById('historyFrom').value;
  const to = document.getElementById('historyTo').value;
  if (pondId !== 'all') params.set('pondId', pondId);
  if (parameterId !== 'all') params.set('parameterId', parameterId);
  if (from) params.set('from', new Date(`${from}T00:00`).toISOString());
  if (to) params.set('to', new Date(`${to}T23:59:59.999`).toISOString());
  state.historyReadings = await window.aquaApi.get(`/measurements${params.size ? `?${params}` : ''}`);
  renderHistory();
}

function renderHistory() {
  const search = document.getElementById('historySearch').value.trim().toLocaleLowerCase('pt-BR');
  const filtered = state.historyReadings.filter((reading) => `${reading.pondName} ${reading.propertyName} ${reading.parameterName}`.toLocaleLowerCase('pt-BR').includes(search));
  document.getElementById('historyRows').innerHTML = filtered.map(measurementRow).join('');
  document.getElementById('historyEmpty').hidden = filtered.length > 0;
  document.querySelector('#page-history .table-scroll').hidden = filtered.length === 0;
  document.getElementById('historyCount').textContent = filtered.length;
  document.getElementById('historyPondCount').textContent = new Set(filtered.map((reading) => reading.pondId)).size;
  document.getElementById('historyFooterCount').textContent = `Exibindo ${filtered.length} ${filtered.length === 1 ? 'medição' : 'medições'}`;
  document.getElementById('lastMeasurementLabel').textContent = state.historyReadings[0] ? formatDateTime(state.historyReadings[0].measuredAt) : 'Sem registros';
}

function renderReportRows() {
  document.getElementById('reportRows').innerHTML = state.ponds.map((pond) => {
    const property = propertyForPond(pond);
    const latest = state.readings.find((reading) => reading.pondId === pond.id);
    const count = state.readings.filter((reading) => reading.pondId === pond.id).length;
    return `<tr><td><strong>${escapeHTML(pond.name)}</strong></td><td>${escapeHTML(property?.name || '—')}</td><td>${count}</td><td>${latest ? escapeHTML(formatDateTime(latest.measuredAt)) : 'Sem registros'}</td><td>${latest ? escapeHTML(classificationLabels[latest.analysisClassification] || classificationLabels.insufficient) : 'Sem medições'}</td></tr>`;
  }).join('');
}

function valuesForChart(parameterId, pondId, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return state.readings.filter((reading) => String(reading.parameterId) === String(parameterId)
    && (pondId === 'all' || String(reading.pondId) === String(pondId))
    && new Date(reading.measuredAt).getTime() >= cutoff)
    .sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt));
}

function drawDashboardChart() {
  const parameterId = document.getElementById('dashboardParameter').value;
  const rows = state.readings.filter((reading) => String(reading.parameterId) === String(parameterId)).slice(0, 20).reverse();
  const parameter = getParameter(parameterId);
  drawLineChart(document.getElementById('dashboardChart'), rows.map((row) => row.value));
  document.getElementById('chartLegend').textContent = parameter?.name || 'Parâmetro';
  document.getElementById('chartValue').textContent = rows.length ? `${formatNumber(rows.at(-1).value)} ${parameter?.unit || ''}` : 'Sem medições';
  document.getElementById('dashboardChartDescription').textContent = rows.length
    ? `Medições reais de ${parameter?.name}: ${rows.map((row) => formatNumber(row.value)).join(', ')} ${parameter?.unit || ''}.`
    : 'Nenhuma medição deste parâmetro foi registrada.';
  document.querySelector('#dashboardChart').setAttribute('aria-label', `Gráfico de medições reais de ${parameter?.name || 'parâmetro'}`);
}

function drawReportChart() {
  const parameterId = document.getElementById('reportParameter').value;
  const days = Number(document.getElementById('reportRange').value);
  const pondId = document.getElementById('reportPondFilter').value;
  const rows = valuesForChart(parameterId, pondId, days);
  const parameter = getParameter(parameterId);
  drawLineChart(document.getElementById('reportChart'), rows.map((row) => row.value));
  document.getElementById('reportValue').textContent = rows.length ? `${formatNumber(rows.at(-1).value)} ${parameter?.unit || ''}` : 'Sem medições';
  document.getElementById('reportLegend').textContent = parameter?.name || 'Parâmetro';
  document.getElementById('reportChartDescription').textContent = rows.length
    ? `${rows.length} medições reais de ${parameter?.name}: ${rows.map((row) => `${formatNumber(row.value)} ${parameter?.unit || ''} em ${formatDateTime(row.measuredAt)}`).join('; ')}.`
    : 'Não há medições reais para os filtros selecionados.';
  document.getElementById('reportXAxisLabels').innerHTML = rows.slice(-7).map((row) => `<span>${escapeHTML(formatDateTime(row.measuredAt))}</span>`).join('');
}

function drawDistributionChart() {
  const counts = state.parameters.map((parameter) => ({
    parameter,
    count: state.readings.filter((reading) => reading.parameterId === parameter.id).length
  })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
  const canvas = document.getElementById('distributionChart');
  if (canvas) {
    const context = canvas.getContext('2d');
    if (context) {
      const ratio = window.devicePixelRatio || 1;
      const bounds = canvas.getBoundingClientRect();
      canvas.width = Math.round(bounds.width * ratio); canvas.height = Math.round(bounds.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, bounds.width, bounds.height);
      const total = counts.reduce((sum, item) => sum + item.count, 0);
      let start = -Math.PI / 2;
      const colors = ['#2b83d8', '#20a6ba', '#7964c9', '#e2a13a', '#6b9a78'];
      counts.forEach((item, index) => {
        const end = start + (total ? item.count / total : 0) * Math.PI * 2;
        context.beginPath(); context.arc(bounds.width / 2, bounds.height / 2, Math.min(bounds.width, bounds.height) * .39, start, end);
        context.strokeStyle = colors[index % colors.length]; context.lineWidth = 18; context.stroke(); start = end;
      });
      document.querySelector('.donut-center strong').textContent = total;
    }
  }
  const legend = document.querySelector('.distribution-legend');
  legend.innerHTML = counts.slice(0, 5).map((item) => `<div><i class="legend-dot blue-dot"></i><span>${escapeHTML(item.parameter.name)}</span><strong>${item.count}</strong></div>`).join('')
    || '<p>Nenhuma medição registrada.</p>';
  document.getElementById('distributionChartDescription').textContent = counts.length
    ? `Distribuição real: ${counts.map((item) => `${item.parameter.name}: ${item.count}`).join(', ')}.`
    : 'Não há medições para distribuir.';
}

function drawCharts() { drawDashboardChart(); drawReportChart(); drawDistributionChart(); }

function showAnalysis(analysis) {
  const item = analysis.items[0];
  const classification = analysis.classification;
  document.getElementById('analysisDialogTitle').textContent = classificationLabels[classification] || classificationLabels.insufficient;
  document.getElementById('analysisExplanation').textContent = item?.explanation || 'A análise não encontrou dados suficientes.';
  const reference = document.getElementById('analysisReference');
  reference.textContent = item?.sourceTitle || 'Nenhuma referência aplicada';
  if (item?.sourceUrl) {
    const link = document.createElement('a');
    link.href = item.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Abrir fonte';
    reference.append(document.createTextNode(' · '), link);
  }
  document.getElementById('analysisVersion').textContent = item?.sourceName
    ? `${item.sourceName}, versão ${item.sourceVersion || 'não informada'} · motor ${analysis.rulesetVersion}`
    : `Motor ${analysis.rulesetVersion}; nenhuma fonte aplicada`;
  document.getElementById('analysisValue').textContent = item
    ? `${formatNumber(item.measuredValue)} ${item.measuredUnit}${item.evaluatedValue !== item.measuredValue ? ` → ${formatNumber(item.evaluatedValue)} ${item.evaluatedUnit}` : ''}`
    : '—';
  const context = item?.contextSnapshot || {};
  document.getElementById('analysisContext').textContent = Object.entries(context).map(([key, value]) => `${key}: ${value}`).join(' · ') || 'Sem dados contextuais adicionais';
  document.getElementById('analysisDate').textContent = formatDateTime(analysis.analyzedAt);
  document.getElementById('analysisDialog').showModal();
}

async function refreshData() {
  const [properties, species, parameters, summary] = await Promise.all([
    window.aquaApi.get('/properties'), window.aquaApi.get('/species'),
    window.aquaApi.get('/parameters'), window.aquaApi.get('/dashboard/summary')
  ]);
  state.properties = properties; state.species = species; state.parameters = parameters; state.summary = summary;
  const pondLists = await Promise.all(properties.map((property) => window.aquaApi.get(`/properties/${property.id}/ponds`)));
  state.ponds = pondLists.flat();
  state.readings = await window.aquaApi.get('/measurements');
  state.historyReadings = state.readings;
  updateSelects(); renderPropertyCards(); renderPondCards(); renderRecentMeasurements();
  renderHistory(); renderReportRows(); drawCharts();
}

function setAuthenticated(user) {
  state.user = user;
  const displayName = user.name || user.email;
  document.querySelector('.sidebar-user .workspace-name strong').textContent = displayName;
  document.querySelector('.sidebar-user .workspace-name small').textContent = user.email;
  document.getElementById('accountDetails').textContent = `${user.name} · ${user.email}`;
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  document.querySelector('.user-avatar').textContent = initials;
  document.querySelector('.workspace-switcher .workspace-name strong').textContent = 'Minha operação';
  document.querySelector('.breadcrumbs > span:first-child').textContent = 'Minha operação';
  document.querySelector('.demo-notice').hidden = true;
  document.querySelector('.demo-pill').innerHTML = '<span></span> Dados reais';
}

function revealWorkspace() {
  document.getElementById('authGate').hidden = true;
  document.getElementById('appShell').hidden = false;
}

function showAuth(mode = 'login') {
  document.getElementById('appShell').hidden = true;
  document.getElementById('authGate').hidden = false;
  const login = mode === 'login';
  document.getElementById('loginForm').hidden = !login;
  document.getElementById('registerForm').hidden = login;
  document.getElementById('authTitle').textContent = login ? 'Entre na sua conta' : 'Crie sua conta';
  document.getElementById('authDescription').textContent = login ? 'Acesse os dados da sua operação aquícola.' : 'Sua senha será armazenada usando hash seguro.';
  document.getElementById('authSwitch').textContent = login ? 'Criar uma conta' : 'Já tenho uma conta';
  document.getElementById('authFeedback').textContent = '';
}

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function setFormBusy(form, busy) {
  form.querySelectorAll('button[type="submit"]').forEach((button) => { button.disabled = busy; });
}

async function submitAuth(form, path) {
  const feedback = document.getElementById('authFeedback');
  feedback.textContent = 'Conectando…';
  setFormBusy(form, true);
  try {
    const body = Object.fromEntries(new FormData(form));
    const result = await window.aquaApi.post(path, body);
    setAuthenticated(result.user);
    await refreshData();
    revealWorkspace();
    form.reset();
    goToScreen('dashboard');
  } catch (error) {
    feedback.textContent = error.message;
  } finally { setFormBusy(form, false); }
}

function editProperty(id) {
  const property = getProperty(id);
  if (!property) return;
  state.editingPropertyId = property.id;
  const form = document.getElementById('propertyForm');
  form.elements.name.value = property.name;
  form.elements.city.value = property.municipality || '';
  form.elements.state.value = property.state || '';
  form.elements.area.value = property.areaHectares ?? '';
  form.querySelector('h2').textContent = 'Editar propriedade';
  form.querySelector('button[type="submit"]').textContent = 'Salvar alterações';
  goToScreen('properties');
}

function editPond(id) {
  const pond = getPond(id);
  if (!pond) return;
  state.editingPondId = pond.id;
  const form = document.getElementById('pondForm');
  form.elements.name.value = pond.name;
  form.elements.propertyId.value = pond.propertyId;
  form.elements.type.value = pond.structureType || '';
  form.elements.speciesId.value = pond.speciesId || '';
  form.elements.volume.value = pond.volumeM3 ?? '';
  form.elements.phase.value = pond.cultivationPhase || '';
  form.elements.cultureSystem.value = pond.cultureSystem || '';
  form.elements.waterType.value = pond.waterType || '';
  form.elements.salinity.value = pond.salinityPpt ?? '';
  form.querySelector('h2').textContent = 'Editar estrutura';
  form.querySelector('button[type="submit"]').textContent = 'Salvar alterações';
  goToScreen('ponds');
}

async function handleAction(button) {
  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  if (action === 'edit-property') return editProperty(id);
  if (action === 'edit-pond') return editPond(id);
  if (action === 'view-analysis') {
    try {
      const analysis = await window.aquaApi.get(`/measurements/${id}/analysis`);
      if (analysis) showAnalysis(analysis); else showToast('Esta medição ainda não possui análise.', true);
    } catch (error) { showToast(error.message, true); }
    return;
  }
  if (action === 'analyze' || action === 'reanalyze') {
    try {
      const analysis = await window.aquaApi.post(`/measurements/${id}/analysis`, {});
      showAnalysis(analysis);
      await refreshData();
    } catch (error) { showToast(error.message, true); }
    return;
  }
  if (!window.confirm('Deseja realmente excluir este registro?')) return;
  try {
    if (action === 'delete-property') await window.aquaApi.delete(`/properties/${id}`);
    if (action === 'delete-pond') await window.aquaApi.delete(`/ponds/${id}`);
    if (action === 'delete-measurement') await window.aquaApi.delete(`/measurements/${id}`);
    await refreshData();
    showToast('Registro excluído.');
  } catch (error) { showToast(error.message, true); }
}

function bindEvents() {
  document.querySelectorAll('[data-screen]').forEach((button) => button.addEventListener('click', () => goToScreen(button.dataset.screen)));
  document.querySelectorAll('[data-screen-link]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); goToScreen(link.dataset.screenLink); }));
  document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => goToScreen(button.dataset.go)));
  document.getElementById('mobileMenuButton').addEventListener('click', () => {
    const open = document.getElementById('sidebar').classList.toggle('is-open');
    document.getElementById('sidebarBackdrop').classList.toggle('is-visible', open);
    document.getElementById('mobileMenuButton').setAttribute('aria-expanded', String(open));
  });
  document.getElementById('sidebarBackdrop').addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSidebar(); });
  document.querySelector('.notice-close').addEventListener('click', () => { document.querySelector('.demo-notice').hidden = true; });
  document.getElementById('dashboardParameter').addEventListener('change', drawDashboardChart);
  document.getElementById('reportParameter').addEventListener('change', drawReportChart);
  ['reportRange', 'reportPondFilter'].forEach((id) => document.getElementById(id).addEventListener('change', drawReportChart));
  document.getElementById('pondPropertyFilter').addEventListener('change', renderPondCards);
  document.getElementById('measurementProperty').addEventListener('change', updateMeasurementPonds);
  document.getElementById('measurementParameter').addEventListener('change', updateParameterUnit);
  document.getElementById('historySearch').addEventListener('input', renderHistory);
  ['historyPondFilter', 'historyParameterFilter', 'historyFrom', 'historyTo'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => loadHistory().catch((error) => showToast(error.message, true)));
  });
  document.body.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (button) handleAction(button);
  });
  window.addEventListener('resize', () => requestAnimationFrame(drawCharts));

  document.getElementById('authSwitch').addEventListener('click', () => showAuth(document.getElementById('registerForm').hidden ? 'register' : 'login'));
  document.getElementById('loginForm').addEventListener('submit', (event) => { event.preventDefault(); submitAuth(event.currentTarget, '/auth/login'); });
  document.getElementById('registerForm').addEventListener('submit', (event) => { event.preventDefault(); submitAuth(event.currentTarget, '/auth/register'); });
  document.getElementById('logoutButton').addEventListener('click', async () => {
    try {
      await window.aquaApi.post('/auth/logout', {});
      Object.assign(state, { user: null, properties: [], ponds: [], species: [], parameters: [], readings: [], historyReadings: [] });
      showAuth('login');
    }
    catch (error) { showToast(error.message, true); }
  });
  document.getElementById('closeAnalysisDialog').addEventListener('click', () => document.getElementById('analysisDialog').close());
  document.getElementById('analysisDialog').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });

  document.getElementById('propertyForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    form.elements.name.setCustomValidity(form.elements.name.value.trim() ? '' : 'Informe um nome de propriedade.');
    form.elements.city.setCustomValidity(form.elements.city.value.trim() ? '' : 'Informe o município.');
    if (!form.reportValidity()) return;
    const body = { name: form.elements.name.value.trim(), municipality: form.elements.city.value.trim(), state: form.elements.state.value || null,
      areaHectares: form.elements.area.value ? Number(form.elements.area.value) : null };
    const id = state.editingPropertyId;
    try {
      if (id) await window.aquaApi.patch(`/properties/${id}`, body); else await window.aquaApi.post('/properties', body);
      state.editingPropertyId = null; form.reset(); form.querySelector('h2').textContent = 'Cadastrar propriedade'; form.querySelector('button[type="submit"]').textContent = 'Adicionar propriedade →';
      await refreshData(); showToast(id ? 'Propriedade atualizada.' : 'Propriedade cadastrada.');
    } catch (error) { showToast(error.message, true); }
  });

  document.getElementById('pondForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    form.elements.name.setCustomValidity(form.elements.name.value.trim() ? '' : 'Informe um nome para a estrutura.');
    if (!form.reportValidity()) return;
    const body = { propertyId: Number(form.elements.propertyId.value), name: form.elements.name.value.trim(),
      structureType: form.elements.type.value || null, speciesId: form.elements.speciesId.value ? Number(form.elements.speciesId.value) : null,
      volumeM3: form.elements.volume.value ? Number(form.elements.volume.value) : null,
      cultivationPhase: form.elements.phase.value || null, cultureSystem: form.elements.cultureSystem.value || null,
      waterType: form.elements.waterType.value || null, salinityPpt: form.elements.salinity.value ? Number(form.elements.salinity.value) : null };
    const id = state.editingPondId;
    try {
      if (id) await window.aquaApi.patch(`/ponds/${id}`, body); else await window.aquaApi.post('/ponds', body);
      state.editingPondId = null; form.reset(); form.querySelector('h2').textContent = 'Adicionar estrutura'; form.querySelector('button[type="submit"]').textContent = 'Adicionar estrutura →';
      await refreshData(); showToast(id ? 'Estrutura atualizada.' : 'Estrutura cadastrada.');
    } catch (error) { showToast(error.message, true); }
  });

  document.getElementById('measurementForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const dateInput = form.elements.measuredAt;
    dateInput.setCustomValidity('');
    if (!form.reportValidity()) return;
    const date = new Date(dateInput.value);
    if (!Number.isFinite(date.getTime()) || date > new Date()) { dateInput.setCustomValidity('Informe uma data válida que não esteja no futuro.'); dateInput.reportValidity(); return; }
    const parameter = getParameter(form.elements.parameterId.value);
    const body = { pondId: Number(form.elements.pondId.value), parameterId: Number(form.elements.parameterId.value),
      value: Number(form.elements.value.value), unit: parameter.unit, measuredAt: date.toISOString(), notes: form.elements.notes.value.trim() || null };
    try {
      const created = await window.aquaApi.post('/measurements', body);
      let analysisMessage = 'Classificação pendente.';
      try {
        const result = await window.aquaApi.post(`/measurements/${created.id}/analysis`, {});
        analysisMessage = `Análise: ${classificationLabels[result.classification]}.`;
      } catch (error) { analysisMessage = `Medição salva; análise indisponível: ${error.message}`; }
      form.reset(); document.getElementById('measurementDate').value = localDateTimeValue();
      await refreshData(); goToScreen('history'); showToast(`Medição salva. ${analysisMessage}`);
    } catch (error) { showToast(error.message, true); }
  });

  document.querySelectorAll('.settings-tab').forEach((tab) => tab.addEventListener('click', (event) => {
    event.preventDefault(); document.querySelectorAll('.settings-tab').forEach((item) => item.classList.toggle('active', item === tab));
    document.getElementById(tab.getAttribute('href').slice(1)).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  document.getElementById('saveSettingsButton').addEventListener('click', () => {
    document.getElementById('settingsSaveMessage').textContent = 'Estas preferências são demonstrativas e não são persistidas.';
    showToast('As preferências da interface ainda não são persistidas.');
  });
}

async function init() {
  bindEvents();
  document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date());
  document.getElementById('measurementDate').value = localDateTimeValue();
  showAuth('login');
  try {
    const session = await window.aquaApi.get('/auth/session');
    setAuthenticated(session.user);
    await refreshData();
    revealWorkspace();
    goToScreen('dashboard');
  } catch (error) {
    if (error.status === 401) return;
    document.getElementById('authFeedback').textContent = error.message;
  }
}

init();
