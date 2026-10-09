const MAP_STATES = [
  {"name": "Andaman and Nicobar"}, {"name": "Andhra Pradesh"}, {"name": "Arunachal Pradesh"},
  {"name": "Assam"}, {"name": "Bihar"}, {"name": "Chandigarh"}, {"name": "Chhattisgarh"},
  {"name": "Dadra and Nagar Haveli"}, {"name": "Daman and Diu"}, {"name": "Delhi"}, {"name": "Goa"},
  {"name": "Gujarat"}, {"name": "Haryana"}, {"name": "Himachal Pradesh"}, {"name": "Jharkhand"},
  {"name": "Karnataka"}, {"name": "Kerala"}, {"name": "Lakshadweep"}, {"name": "Madhya Pradesh"},
  {"name": "Maharashtra"}, {"name": "Manipur"}, {"name": "Meghalaya"}, {"name": "Mizoram"},
  {"name": "Nagaland"}, {"name": "Orissa"}, {"name": "Puducherry"}, {"name": "Punjab"},
  {"name": "Rajasthan"}, {"name": "Sikkim"}, {"name": "Tamil Nadu"}, {"name": "Tripura"},
  {"name": "Uttar Pradesh"}, {"name": "Uttaranchal"}, {"name": "West Bengal"},
  {"name": "Jammu and Kashmir"}, {"name": "Ladakh"}
];

const ALERTS = [
  {"message": "High dengue risk in Nagpur", "time": "2 hours ago", "tone": "danger"},
  {"message": "Unusual rainfall increase detected in Bhopal", "time": "5 hours ago", "tone": "warm"},
  {"message": "Water stagnation risk in Chennai", "time": "1 day ago", "tone": "blue"},
  {"message": "Environmental conditions back to normal in Hyderabad", "time": "2 days ago", "tone": "green"},
  {"message": "Weekly climate summary is available", "time": "3 days ago", "tone": "blue"},
  {"message": "Sensor network check completed in Maharashtra", "time": "3 days ago", "tone": "green"}
];

/* Regional baseline demonstration records */
const DEMO_DATA = [
  {name: 'Nagpur', state: 'Maharashtra', risk: 72, temperature: 33.1, rain: 92, humidity: 81, change: 18, lng: 79.0882, lat: 21.1458},
  {name: 'Bhopal', state: 'Madhya Pradesh', risk: 64, temperature: 31.7, rain: 108, humidity: 76, change: 14, lng: 77.4126, lat: 23.2599},
  {name: 'Chennai', state: 'Tamil Nadu', risk: 56, temperature: 34.2, rain: 78, humidity: 84, change: 9, lng: 80.2707, lat: 13.0827},
  {name: 'Hyderabad', state: 'Telangana', risk: 38, temperature: 30.4, rain: 64, humidity: 69, change: -6, lng: 78.4867, lat: 17.385}
];

const adjustments = {Dengue: 0, Malaria: -11, Chikungunya: -19, Zika: -35};
let disease = 'Dengue', district = 0, zoom = 1;

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

const score = i => Math.max(8, DEMO_DATA[i].risk + adjustments[disease]);
const label = r => r >= 60 ? 'High Risk' : r >= 40 ? 'Moderate Risk' : 'Low Risk';

function update() {
  const d = DEMO_DATA[district], r = score(district);
  $$('[role=tab]').forEach(b => {
    const active = b.textContent.trim() === disease;
    b.setAttribute('aria-selected', String(active));
    b.classList.toggle('bg-primary', active);
    b.classList.toggle('text-primary-foreground', active);
    b.classList.toggle('text-foreground', !active);
  });
  const summary = $('.summary-grid');
  if (summary) {
    $('.stat-label', summary).textContent = disease + ' Risk';
    $('.stat-value', summary).textContent = r >= 60 ? 'High' : r >= 40 ? 'Moderate' : 'Low';
  }
  const detail = $('[data-panel="district"]');
  if (detail) {
    $('.district-value', detail).textContent = r + '%';
    $('.risk-badge', detail).textContent = label(r);
    const select = $('[aria-label="Select district"]', detail);
    if (select) select.value = district;
    const vals = $$('.weather-item strong', detail);
    if (vals.length >= 3) {
      [d.temperature + '°C', d.rain + ' mm', d.humidity + '%'].forEach((v, i) => vals[i].textContent = v);
    }
    const trend = $('.trend', detail);
    if (trend && trend.lastChild) trend.lastChild.textContent = Math.abs(d.change) + '%';
    const factors = $$('.factor', detail);
    if (factors.length >= 3) {
      factors[0].lastChild.textContent = d.rain > 80 ? 'High rainfall in last 2 weeks' : 'Moderate rainfall in last 2 weeks';
      factors[1].lastChild.textContent = r > 50 ? 'Increase in stagnant water areas' : 'Stable water levels in monitored areas';
      factors[2].lastChild.textContent = r > 50 ? 'Favorable temperature for vector breeding' : 'Improving environmental conditions';
    }
  }
  const map = $('.map-svg');
  if (map) {
    map.setAttribute('aria-label', disease + ' sample risk map of India');
    const tooltipParent = $('.map-tooltip')?.parentElement;
    if (tooltipParent) {
      tooltipParent.setAttribute('transform', `translate(${(d.lng - 58) * 15 + 12} ${(39 - d.lat) * 12 - 37})`);
      const texts = $$('text', tooltipParent);
      [d.name, label(r), r + '%'].forEach((v, i) => { if (texts[i]) texts[i].textContent = v; });
    }
    $$('.map-state').forEach((p, i) => {
      const stateName = MAP_STATES[i]?.name;
      let level = ['Maharashtra', 'Madhya Pradesh', 'Chhattisgarh'].includes(stateName) ? 0 :
                  ['Uttar Pradesh', 'Bihar', 'Telangana', 'Odisha', 'Jharkhand', 'West Bengal'].includes(stateName) ? 1 :
                  ['Rajasthan', 'Gujarat', 'Andhra Pradesh', 'Karnataka', 'Tamil Nadu'].includes(stateName) ? 2 : 3;
      level = Math.min(3, level + (disease === 'Dengue' ? 0 : disease === 'Zika' ? 2 : 1));
      p.setAttribute('fill', `var(--risk-${['critical', 'high', 'medium', 'low'][level]})`);
    });
  }
  updateCharts();
  const rows = $$('.data-table tbody tr');
  rows.forEach((row, i) => {
    if (row.cells.length === 5 && row.closest('table').querySelectorAll('th')[2]?.textContent === 'Disease') {
      row.cells[2].textContent = disease;
      row.cells[3].textContent = score(i) + '%';
      row.cells[4].textContent = label(score(i));
    }
  });
}

function updateCharts() {
  const select = $('[aria-label="Forecast period"]');
  const count = select?.value === '4' ? 10 : 18;
  const predicted = [9, 15, 20, 22, 28, 35, 41, 47, 52, 59, 60, 67, 73, 77, 75, 72, 70, 69];
  const historical = [5, 9, 12, 14, 18, 22, 19, 24, 28, 30, 29, 36, 42, 44, 40, 35, 32, 29];
  const adjust = disease === 'Dengue' ? 0 : disease === 'Zika' ? 28 : 13;

  for (const [arr, cls] of [[predicted, 'prediction'], [historical, 'historical']]) {
    const pts = arr.slice(0, count).map((v, i) => [34 + i * 16.5, 104 - Math.max(3, v - adjust) * 0.88]);
    $$('.' + cls + '-line').forEach(line => line.setAttribute('points', pts.map(p => p.join(',')).join(' ')));
    $$('.forecast-svg').forEach(svg => {
      $$('.' + cls + '-dot', svg).forEach((dot, i) => {
        dot.style.display = i < count ? '' : 'none';
        if (pts[i]) {
          dot.setAttribute('cx', pts[i][0]);
          dot.setAttribute('cy', pts[i][1]);
        }
      });
      if (cls === 'historical') {
        $('.historical-area', svg)?.setAttribute('d', `M34 104 L${pts.map(v => v.join(' ')).join(' L')} L${pts.at(-1)[0]} 104Z`);
      }
    });
  }
}

function closeModal() {
  const m = $('.modal-backdrop:not(.closing)');
  document.body.style.overflow = '';
  if (!m) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    m.remove();
    return;
  }
  m.classList.add('closing');
  setTimeout(() => m.remove(), 190);
}

function showModal(title, content) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="modal-head"><h2>${title}</h2><button class="inline-flex items-center justify-center size-9 rounded-md hover:bg-accent" aria-label="Close dialog">✕</button></div>${content}</div>`;
  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  $('button', wrap).onclick = closeModal;
  wrap.onclick = e => { if (e.target === wrap) closeModal(); };
  $('button', wrap).focus();
}

/* -------------------------------------------------------------------------- */
/* API INTEGRATION & BACKEND STATUS LOGIC                                      */
/* -------------------------------------------------------------------------- */

let lastHealthResponse = null;

async function checkBackendConnection() {
  const pill = $('#backend-status-indicator');
  if (!pill) return;

  const dot = $('.status-dot', pill);
  const text = $('.status-text', pill);

  pill.className = 'backend-status-pill checking';
  if (text) text.textContent = 'API: Checking...';

  if (!window.ClimateGuardAPI) {
    pill.className = 'backend-status-pill offline';
    if (text) text.textContent = 'API: Helper Missing';
    return;
  }

  const health = await window.ClimateGuardAPI.checkHealth();
  lastHealthResponse = health;

  if (health.ok && health.model_loaded) {
    pill.className = 'backend-status-pill online';
    pill.title = `Connected to ClimateGuard API at ${window.ClimateGuardAPI.getBaseUrl()} (Model Ready)`;
    if (text) text.textContent = 'API: Connected';
  } else if (health.ok && !health.model_loaded) {
    pill.className = 'backend-status-pill warning';
    pill.title = `Backend running at ${window.ClimateGuardAPI.getBaseUrl()} but ML model is not loaded`;
    if (text) text.textContent = 'API: Model Warning';
  } else {
    pill.className = 'backend-status-pill offline';
    pill.title = `Failed to connect to backend at ${window.ClimateGuardAPI.getBaseUrl()}: ${health.error}`;
    if (text) text.textContent = 'API: Offline';
  }
}

function showBackendDiagnosticModal() {
  const baseUrl = window.ClimateGuardAPI ? window.ClimateGuardAPI.getBaseUrl() : 'http://127.0.0.1:8002';
  const isOk = lastHealthResponse?.ok;
  const isLoaded = lastHealthResponse?.model_loaded;
  const statusStr = isOk ? (isLoaded ? 'Online & Model Loaded' : 'Online (Model Unloaded)') : 'Offline / Unreachable';
  const statusColor = isOk && isLoaded ? 'text-green-600 font-bold' : isOk ? 'text-yellow-600 font-bold' : 'text-red-600 font-bold';

  const modalHtml = `
    <div class="space-y-4">
      <div class="p-3 rounded-md bg-card border border-border">
        <p class="text-sm"><strong>Backend URL:</strong> <code class="text-xs bg-muted px-1.5 py-0.5 rounded">${baseUrl}</code></p>
        <p class="text-sm mt-1"><strong>Status:</strong> <span class="${statusColor}">${statusStr}</span></p>
        <p class="text-sm mt-1"><strong>Data Status:</strong> <code>${lastHealthResponse?.data_status || 'UNKNOWN'}</code></p>
        ${lastHealthResponse?.error ? `<p class="text-xs text-red-500 mt-1"><strong>Error details:</strong> ${lastHealthResponse.error}</p>` : ''}
      </div>

      <h4 class="font-semibold text-sm">Available Endpoints</h4>
      <ul class="text-xs space-y-1 text-muted-foreground font-mono">
        <li>GET / - API Welcome</li>
        <li>GET /health - System & Model Health Check</li>
        <li>POST /predict - Outbreak Risk Prediction Model</li>
      </ul>

      <p class="text-xs text-muted-foreground">
        Note: The Random Forest model is trained on demonstration data (<code>SYNTHETIC_NOT_OBSERVED</code>).
      </p>

      <div class="pt-2 flex justify-end gap-2">
        <button id="btn-recheck-api" class="inline-flex items-center justify-center gap-2 rounded-md text-xs font-semibold bg-primary text-primary-foreground px-4 py-2 hover:opacity-90">
          🔄 Test Connection Now
        </button>
      </div>
    </div>
  `;

  showModal('ClimateGuard Backend Connection Status', modalHtml);

  $('#btn-recheck-api')?.addEventListener('click', async () => {
    const btn = $('#btn-recheck-api');
    if (btn) btn.textContent = 'Checking...';
    await checkBackendConnection();
    showBackendDiagnosticModal();
  });
}

function initBackendStatusPill() {
  const accountDiv = $('.account');
  if (!accountDiv) return;

  if (!$('#backend-status-indicator')) {
    const pill = document.createElement('div');
    pill.id = 'backend-status-indicator';
    pill.className = 'backend-status-pill checking';
    pill.role = 'button';
    pill.tabIndex = 0;
    pill.innerHTML = `<span class="status-dot"></span><span class="status-text">API: Checking...</span>`;
    accountDiv.insertBefore(pill, accountDiv.firstChild);

    pill.addEventListener('click', showBackendDiagnosticModal);
    pill.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showBackendDiagnosticModal();
      }
    });
  }

  checkBackendConnection();
}

/* -------------------------------------------------------------------------- */
/* PREDICT FORM SUBMISSION LOGIC                                              */
/* -------------------------------------------------------------------------- */

function initPredictionForm() {
  const form = $('#prediction-form');
  if (!form) return;

  const btnSubmit = $('#btn-submit-predict');
  const btnClear = $('#btn-clear-predict');
  const btnSample = $('#btn-load-sample');
  const errorMsg = $('#prediction-error-msg');
  const outputCard = $('#prediction-output-card');

  // Benchmark sample loader
  btnSample?.addEventListener('click', () => {
    const sample = {
      cases_previous_week: 12,
      cases_3week_average: 10.3,
      rain_previous_week: 42.0,
      temperature_previous_week: 28.5,
      humidity_previous_week: 76.0,
      ndvi: 0.55,
      surface_water_index: 0.40
    };
    for (const [key, val] of Object.entries(sample)) {
      const field = form.querySelector(`[name="${key}"]`);
      if (field) field.value = val;
    }
    if (errorMsg) errorMsg.classList.add('hidden');
  });

  // Clear / Reset form
  btnClear?.addEventListener('click', () => {
    form.reset();
    if (errorMsg) errorMsg.classList.add('hidden');
    if (outputCard) outputCard.classList.add('hidden');
  });

  // Handle submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (errorMsg) {
      errorMsg.textContent = '';
      errorMsg.classList.add('hidden');
    }

    const payload = {
      cases_previous_week: $('#cases_previous_week')?.value,
      cases_3week_average: $('#cases_3week_average')?.value,
      rain_previous_week: $('#rain_previous_week')?.value,
      temperature_previous_week: $('#temperature_previous_week')?.value,
      humidity_previous_week: $('#humidity_previous_week')?.value,
      ndvi: $('#ndvi')?.value,
      surface_water_index: $('#surface_water_index')?.value
    };

    // UI Loading state
    if (btnSubmit) {
      btnSubmit.disabled = true;
      $('.btn-label', btnSubmit).textContent = 'Analyzing Climate Signals...';
      $('.btn-loading-spinner', btnSubmit)?.classList.remove('hidden');
    }

    try {
      if (!window.ClimateGuardAPI) {
        throw new Error('API helper module (api.js) not loaded.');
      }

      const res = await window.ClimateGuardAPI.predict(payload);

      if (!res.ok) {
        if (errorMsg) {
          errorMsg.textContent = `Prediction Error: ${res.error}`;
          errorMsg.classList.remove('hidden');
        }
        if (outputCard) outputCard.classList.add('hidden');
        return;
      }

      // Render successful output
      if (outputCard) {
        outputCard.classList.remove('hidden');

        const isElevated = res.prediction === 1 || res.risk_level === 'Elevated';
        const riskBox = $('#output-risk-box');
        const riskLevelEl = $('#output-risk-level');
        const codeEl = $('#output-prediction-code');

        if (riskBox) {
          riskBox.className = `output-result-box ${isElevated ? 'risk-elevated' : 'risk-lower'}`;
        }
        if (riskLevelEl) {
          riskLevelEl.textContent = res.risk_level || (isElevated ? 'Elevated' : 'Lower');
        }
        if (codeEl) {
          codeEl.textContent = `Model Output Class: ${res.prediction}`;
        }

        const probTextEl = $('#output-prob-text');
        const probBarEl = $('#output-prob-bar');
        if (res.elevated_probability !== null && res.elevated_probability !== undefined) {
          const pct = Math.round(res.elevated_probability * 1000) / 10;
          if (probTextEl) probTextEl.textContent = `${pct}%`;
          if (probBarEl) probBarEl.style.width = `${Math.min(100, pct)}%`;
        } else {
          if (probTextEl) probTextEl.textContent = 'N/A';
          if (probBarEl) probBarEl.style.width = '0%';
        }

        const statusEl = $('#output-data-status');
        if (statusEl) statusEl.textContent = res.data_status || 'SYNTHETIC_NOT_OBSERVED';

        const warnEl = $('#output-warning-text');
        if (warnEl) warnEl.textContent = res.warning || 'Experimental result from a model trained on synthetic data. Not a validated real-world forecast.';

        const timeEl = $('#output-timestamp');
        if (timeEl) timeEl.textContent = new Date().toLocaleTimeString();

        // Dynamically update dashboard summary grid risk level if element exists
        const mainRiskVal = $('.summary-grid .stat-value.risk-text');
        if (mainRiskVal) {
          mainRiskVal.textContent = isElevated ? 'Elevated' : 'Lower';
          mainRiskVal.style.color = isElevated ? '#dc2626' : '#16a34a';
        }
      }

    } catch (err) {
      if (errorMsg) {
        errorMsg.textContent = `Unexpected Error: ${err.message}`;
        errorMsg.classList.remove('hidden');
      }
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        $('.btn-label', btnSubmit).textContent = 'Run ML Model Prediction';
        $('.btn-loading-spinner', btnSubmit)?.classList.add('hidden');
      }
    }
  });
}

/* DOM Event Listener Initialization */
document.addEventListener('DOMContentLoaded', () => {
  initBackendStatusPill();
  initPredictionForm();
});

$$('[role=tab]').forEach(b => b.onclick = () => { disease = b.textContent.trim(); update(); });
$('[aria-label="Select district"]')?.addEventListener('change', e => { district = Number(e.target.value); update(); });
$('[aria-label="Forecast period"]')?.addEventListener('change', updateCharts);

$$('.map-state').forEach((p, i) => {
  p.onclick = () => {
    const index = DEMO_DATA.findIndex(d => d.state === MAP_STATES[i]?.name);
    if (index >= 0) { district = index; update(); }
  };
});

$$('.map-svg [role=button]').forEach((p, i) => {
  p.onclick = () => { district = i; update(); };
  p.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { district = i; update(); } };
});

for (const [name, delta] of [['Zoom in', 0.25], ['Zoom out', -0.25]]) {
  $(`[aria-label="${name}"]`)?.addEventListener('click', () => {
    zoom = Math.max(1, Math.min(2.2, zoom + delta));
    const g = $('.map-svg>g');
    if (window.__mapZoom) window.__mapZoom(g, zoom);
    else if (g) g.setAttribute('transform', `translate(${400 * (1 - zoom)} ${190 * (1 - zoom)}) scale(${zoom})`);
  });
}

const alertsHtml = () => `<div class="alert-list">${ALERTS.map(a => `<div class="alert-row tone-${a.tone}"><span class="alert-message">${a.message}</span><span class="alert-time">${a.time}</span></div>`).join('')}</div><p>Sample notifications from the demonstration dataset.</p>`;

$$('button').forEach(b => {
  const text = b.textContent.trim();
  if (text === 'How It Works') {
    b.onclick = () => showModal('From signals to prevention', '<h3>Environmental data</h3><p>Climate and sensor readings capture temperature, rainfall, humidity, and water conditions.</p><h3>Regional risk analysis</h3><p>A connected prediction model can analyze these signals to estimate disease outbreak risk.</p><h3>District-level insights</h3><p>Risk maps and alerts help public-health teams identify regions that need attention.</p><p>This preview uses sample data. It is not medical advice.</p>');
  }
  if (text === 'Explore Map') b.onclick = () => $('#risk-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (text === 'View All' || b.getAttribute('aria-label') === 'View notifications') b.onclick = () => showModal('Recent alerts', alertsHtml());
  if (b.getAttribute('aria-label') === 'Open profile') b.onclick = () => showModal('Radhika Sharma', '<h3>Public health analyst</h3><p>Demonstration profile. Account and sign-in services are not connected.</p>');
  if (text === 'Export CSV' || text === 'Download report') b.onclick = downloadReport;
});

$('[aria-label="Toggle navigation"]')?.addEventListener('click', () => $('.sidebar').classList.toggle('is-open'));

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    $('.search-results')?.remove();
  }
});

const input = $('[aria-label="Search district, city or disease"]');
input?.addEventListener('input', () => {
  $('.search-results')?.remove();
  const q = input.value.toLowerCase().trim();
  if (!q) return;
  const results = DEMO_DATA.map((d, i) => ({ label: d.name + ', ' + d.state, index: i })).filter(d => d.label.toLowerCase().includes(q));
  Object.keys(adjustments).filter(d => d.toLowerCase().includes(q)).forEach(d => results.push({ label: d, disease: d }));
  const box = document.createElement('div');
  box.className = 'search-results';
  if (!results.length) { box.textContent = 'No matching regions or diseases'; }
  results.forEach(result => {
    const b = document.createElement('button');
    b.className = 'inline-flex w-full items-center rounded-md p-3 text-xs hover:bg-accent';
    b.textContent = result.label;
    b.onclick = () => {
      if (result.disease) disease = result.disease;
      else district = result.index;
      input.value = '';
      box.remove();
      update();
    };
    box.appendChild(b);
  });
  $('.search')?.appendChild(box);
});

input?.addEventListener('keydown', e => {
  if (e.key === 'Enter') $('.search-results button')?.click();
});

function downloadReport() {
  const csv = 'District,State,Disease,Sample risk (%),Temperature (C),Rainfall (mm),Humidity (%)\n' + DEMO_DATA.map((d, i) => `${d.name},${d.state},${disease},${score(i)},${d.temperature},${d.rain},${d.humidity}`).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aarogyasight-sample-report.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
