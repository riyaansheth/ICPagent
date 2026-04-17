// app.js — UI logic, state management, event handlers, DOM rendering

import { scoreProspect, AuthError, RateLimitError, NetworkError, ParseError } from './api.js';

// ── Default ICP config ──────────────────────────────────────────────────────
const DEFAULT_ICP = {
  titles: 'VP Revenue Operations, Head of Sales, CRO, VP Sales, Director of Revenue Operations',
  industries: 'B2B SaaS, FinTech, MarTech, Sales Tech',
  companySize: '50–500 employees, Series A–C',
  geography: 'United States, Canada, United Kingdom',
  painPoints: 'Forecast accuracy, rep admin overhead, pipeline visibility, CRM hygiene, quota attainment reporting',
  budgetSignals: 'Series B or later, recent funding round, $20M+ ARR, active hiring for AEs or RevOps'
};

// ── Storage keys ────────────────────────────────────────────────────────────
const KEY_API = 'icp_scoring_api_key';
const KEY_PROXYCURL = 'icp_scoring_proxycurl_key';
const KEY_CONFIG = 'icp_scoring_config';

// ── App state ───────────────────────────────────────────────────────────────
const state = {
  apiKey: '',
  proxycurlKey: '',
  icpConfig: { ...DEFAULT_ICP },
  history: [],        // { result, prospectSnippet, timestamp, modelUsed }
  isLoading: false,
  historySortAsc: false // sort by score
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const els = {
  apiKeyInput: $('api-key-input'),
  apiKeyToggle: $('api-key-toggle'),
  proxycurlKeyInput: $('proxycurl-key-input'),
  proxycurlKeyToggle: $('proxycurl-key-toggle'),
  keyStatus: $('key-status'),
  icpTitles: $('icp-titles'),
  icpIndustries: $('icp-industries'),
  icpCompanySize: $('icp-company-size'),
  icpGeography: $('icp-geography'),
  icpPainPoints: $('icp-pain-points'),
  icpBudget: $('icp-budget-signals'),
  resetIcpBtn: $('reset-icp-btn'),
  icpSaveNotice: $('icp-save-notice'),
  prospectInput: $('prospect-input'),
  charCount: $('char-count'),
  prospectError: $('prospect-error'),
  scoreBtn: $('score-btn'),
  btnText: document.querySelector('.btn-text'),
  btnSpinner: document.querySelector('.btn-spinner'),
  btnArrow: document.querySelector('.btn-arrow'),
  scoreError: $('score-error'),
  resultSection: $('result-section'),
  ringFill: $('ring-fill'),
  scoreNumber: $('score-number'),
  tierBadge: $('tier-badge'),
  resultReasoning: $('result-reasoning'),
  dimensionsGrid: $('dimensions-grid'),
  nextAction: $('next-action'),
  profileSummaryText: $('profile-summary'),
  historySection: $('history-section'),
  historyTbody: $('history-tbody'),
  exportCsvBtn: $('export-csv-btn'),
  modelIndicator: $('model-indicator'),
  sortHeader: document.querySelector('th[data-col="score"]')
};

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSavedData();
  bindEvents();
  updateScoreBtn();
});

function loadSavedData() {
  // API key
  const savedKey = localStorage.getItem(KEY_API) || '';
  if (savedKey) {
    state.apiKey = savedKey;
    els.apiKeyInput.value = savedKey;
    showKeyStatus('✓ Keys loaded', 'valid');
  }

  // Proxycurl key
  const savedProxyKey = localStorage.getItem(KEY_PROXYCURL) || '';
  if (savedProxyKey) {
    state.proxycurlKey = savedProxyKey;
    els.proxycurlKeyInput.value = savedProxyKey;
  }

  // ICP config
  try {
    const saved = localStorage.getItem(KEY_CONFIG);
    if (saved) state.icpConfig = { ...DEFAULT_ICP, ...JSON.parse(saved) };
  } catch { /* ignore */ }

  fillIcpForm(state.icpConfig);
}

function fillIcpForm(cfg) {
  els.icpTitles.value = cfg.titles || '';
  els.icpIndustries.value = cfg.industries || '';
  els.icpCompanySize.value = cfg.companySize || '';
  els.icpGeography.value = cfg.geography || '';
  els.icpPainPoints.value = cfg.painPoints || '';
  els.icpBudget.value = cfg.budgetSignals || '';
}

// ── Events ───────────────────────────────────────────────────────────────────
function bindEvents() {
  // API keys
  els.apiKeyInput.addEventListener('input', onApiKeyChange);
  els.apiKeyToggle.addEventListener('click', toggleKeyVisibility);
  els.proxycurlKeyInput.addEventListener('input', onProxycurlKeyChange);
  els.proxycurlKeyToggle.addEventListener('click', toggleProxycurlKeyVisibility);

  // ICP fields — save on change
  [els.icpTitles, els.icpIndustries, els.icpCompanySize,
  els.icpGeography, els.icpPainPoints, els.icpBudget].forEach(el => {
    el.addEventListener('input', onIcpChange);
  });

  els.resetIcpBtn.addEventListener('click', resetIcp);

  // Prospect
  els.prospectInput.addEventListener('input', onProspectInput);

  // Score
  els.scoreBtn.addEventListener('click', scoreAndRender);

  // History sort
  if (els.sortHeader) {
    els.sortHeader.addEventListener('click', () => {
      state.historySortAsc = !state.historySortAsc;
      renderHistory();
    });
  }

  // CSV export
  els.exportCsvBtn.addEventListener('click', exportCSV);
}

let icpSaveTimer;
function onIcpChange() {
  state.icpConfig = {
    titles: els.icpTitles.value,
    industries: els.icpIndustries.value,
    companySize: els.icpCompanySize.value,
    geography: els.icpGeography.value,
    painPoints: els.icpPainPoints.value,
    budgetSignals: els.icpBudget.value
  };
  localStorage.setItem(KEY_CONFIG, JSON.stringify(state.icpConfig));

  // Show save notice briefly
  clearTimeout(icpSaveTimer);
  els.icpSaveNotice.classList.remove('hidden');
  icpSaveTimer = setTimeout(() => els.icpSaveNotice.classList.add('hidden'), 1800);
}

function onApiKeyChange() {
  const val = els.apiKeyInput.value.trim();
  state.apiKey = val;
  if (val) {
    localStorage.setItem(KEY_API, val);
    showKeyStatus('✓ Key saved', 'valid');
  } else {
    localStorage.removeItem(KEY_API);
    els.keyStatus.classList.add('hidden');
  }
  updateScoreBtn();
}

function toggleKeyVisibility() {
  els.apiKeyInput.type = els.apiKeyInput.type === 'password' ? 'text' : 'password';
}

function onProxycurlKeyChange() {
  const val = els.proxycurlKeyInput.value.trim();
  state.proxycurlKey = val;
  if (val) {
    localStorage.setItem(KEY_PROXYCURL, val);
  } else {
    localStorage.removeItem(KEY_PROXYCURL);
  }
  updateScoreBtn();
}

function toggleProxycurlKeyVisibility() {
  els.proxycurlKeyInput.type = els.proxycurlKeyInput.type === 'password' ? 'text' : 'password';
}

function onProspectInput() {
  const val = els.prospectInput.value;
  if (val.length > 0) els.prospectError.classList.add('hidden');
  updateScoreBtn();
}

function resetIcp() {
  state.icpConfig = { ...DEFAULT_ICP };
  fillIcpForm(state.icpConfig);
  localStorage.setItem(KEY_CONFIG, JSON.stringify(state.icpConfig));
  els.icpSaveNotice.classList.remove('hidden');
  setTimeout(() => els.icpSaveNotice.classList.add('hidden'), 1800);
}

function updateScoreBtn() {
  const ready = state.apiKey.trim() && els.prospectInput.value.trim();
  els.scoreBtn.disabled = !ready;
}

function showKeyStatus(msg, type) {
  els.keyStatus.textContent = msg;
  els.keyStatus.className = `key-status ${type}`;
}

// ── Core scoring flow ─────────────────────────────────────────────────────────
async function scoreAndRender() {
  // Validate
  const prospectUrl = els.prospectInput.value.trim();
  if (!prospectUrl || !prospectUrl.match(/^https?:\/\//i)) {
    els.prospectError.textContent = 'Please enter a valid URL.';
    els.prospectError.classList.remove('hidden');
    els.prospectInput.focus();
    return;
  }
  if (!state.apiKey.trim()) {
    showKeyStatus('⚠ Groq API key required', 'invalid');
    els.apiKeyInput.focus();
    return;
  }

  // Loading state
  setLoading(true, 'Extracting Profile...');
  hideError();

  try {
    let prospectText = '';

    // Bypass Proxycurl if it's the hardcoded riyaansheth profile
    if (prospectUrl.toLowerCase().includes('riyaansheth')) {
      prospectText = `Riyaan Sheth
He/Him
Pursuing Btech in CS at ATLAS SKILLTECH UNIVERSITY Learning Skills and Building high value projects
Mumbai, Maharashtra, India

About
Worked at Gift City, mumbai 
Created an exlusive website
Managed shipment to Shanghai, China
1+ year experience in python, css and javascript

Experience
Cloud IT engineer at Farz AI · Internship (May 2025 - Aug 2025)
assisting in developing web application as PaaS azure app service, Microsoft Azure and Azure SQL

Instructor at ATLAS SkillTech University · Internship (May 2025)
Interned as an Instructor for the tech summer camp students, taught them basics of programming and arduino. Build Projects, C++

Web designer and Manager at Gift City (2022 - 2023)
Built an exlusive website and an indiamart portal. Managed overseas transactions. Managed overseas shipment to Shanghai, China

Education
ATLAS SkillTech University (Bachelor of Technology - BTech, Computer Science, 2024 – 2028)
Kishinchand Chellaram (KC) College, Mumbai (12th, 2022 – 2024)

Activity Highlights:
- Secured Top 20 out of 300 participants at AMD Slingshot Prompt-a-thon (Created NutriNox, an AI based diet tracker).
- Selected for the second and final round of Mumbai Hacks competition.
- Represented ATLAS SkillTech University in the Smart India Hackathon (SIH) 2025.
- Completed internship as an Instructor at the Summer School on STEAM-AI.`.trim();

    } else {
      if (!state.proxycurlKey.trim()) {
        throw new Error('Proxycurl API key is required to scrape live LinkedIn profiles.');
      }
      
      // 1. Scrape URL using Proxycurl
      const targetUrl = `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(prospectUrl)}`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
      const scrapeRes = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${state.proxycurlKey}`
        }
      });

      if (!scrapeRes.ok) throw new Error(`Failed to extract profile (Proxycurl returned ${scrapeRes.status})`);
      
      const data = await scrapeRes.json();
      prospectText = `
Name: ${data.full_name || 'N/A'}
Headline: ${data.headline || 'N/A'}
Summary: ${data.summary || 'N/A'}
Occupation: ${data.occupation || 'N/A'}
Experiences: ${JSON.stringify((data.experiences || []).map(e => ({ title: e.title, company: e.company, desc: e.description })))}
      `.trim();
    }

    if (prospectText.length < 20) {
      throw new Error("Extracted data is empty or invalid.");
    }

    // 2. Score text
    els.btnText.textContent = 'Scoring Prospect...';
    
    const { result, modelUsed } = await scoreProspect(
      state.apiKey,
      state.icpConfig,
      prospectText
    );

    // Show model indicator if fallback was used
    if (modelUsed.includes('8b')) {
      els.modelIndicator.textContent = 'llama-3.1-8b (fallback)';
      els.modelIndicator.classList.remove('hidden');
    } else {
      els.modelIndicator.textContent = 'llama-3.3-70b';
      els.modelIndicator.classList.remove('hidden');
    }

    // Push to history
    const entry = {
      result,
      prospectSnippet: prospectUrl, // Save URL instead of text snippet
      timestamp: new Date(),
      modelUsed
    };
    state.history.unshift(entry);

    renderResult(result);
    renderHistory();

  } catch (err) {
    showScoreError(err);
  } finally {
    setLoading(false);
  }
}

// ── Render result ─────────────────────────────────────────────────────────────
function renderResult(result) {
  // Show section
  els.resultSection.classList.remove('hidden');
  // Force reflow for animation
  els.resultSection.style.animation = 'none';
  void els.resultSection.offsetHeight;
  els.resultSection.style.animation = '';

  // Score number
  els.scoreNumber.textContent = result.score;

  // Ring animation
  const pct = result.score / 100;
  const offset = 314.16 * (1 - pct);
  const tierLower = result.tier.toLowerCase();

  // Reset then animate
  els.ringFill.style.strokeDashoffset = '314.16';
  els.ringFill.setAttribute('class', 'ring-fill');
  setTimeout(() => {
    els.ringFill.style.strokeDashoffset = String(offset);
    els.ringFill.classList.add(tierLower);
  }, 30);

  // Tier badge
  els.tierBadge.textContent = result.tier;
  els.tierBadge.className = `tier-badge ${tierLower}`;

  // Reasoning
  els.resultReasoning.textContent = result.reasoning;

  // Profile Gist
  els.profileSummaryText.textContent = result.profile_summary;

  // Dimensions
  const LABELS = {
    title_fit: 'Title Fit',
    company_fit: 'Company Fit',
    pain_signal: 'Pain Signal',
    timing_signal: 'Timing Signal'
  };

  els.dimensionsGrid.innerHTML = '';
  for (const [key, data] of Object.entries(result.dimensions)) {
    const pctWidth = (data.score / 25) * 100;
    const card = document.createElement('div');
    card.className = 'dimension-card';
    card.innerHTML = `
      <div class="dim-header">
        <span class="dim-name">${LABELS[key] || key}</span>
        <span class="dim-score">${data.score}<span> / 25</span></span>
      </div>
      <div class="dim-bar-track">
        <div class="dim-bar-fill" style="width: 0%"></div>
      </div>
      <p class="dim-note">${data.note}</p>
    `;
    els.dimensionsGrid.appendChild(card);
    // Animate bar after append
    setTimeout(() => {
      card.querySelector('.dim-bar-fill').style.width = `${pctWidth}%`;
    }, 60);
  }

  // Next action
  els.nextAction.textContent = result.next_action;

  // Scroll result into view
  els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Render history ────────────────────────────────────────────────────────────
function renderHistory() {
  if (state.history.length === 0) return;
  els.historySection.classList.remove('hidden');

  const sorted = [...state.history].sort((a, b) => {
    return state.historySortAsc
      ? a.result.score - b.result.score
      : b.result.score - a.result.score;
  });

  els.historyTbody.innerHTML = sorted.map(entry => {
    const tier = entry.result.tier.toLowerCase();
    const time = entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const snippet = entry.prospectSnippet.replace(/</g, '&lt;');
    return `
      <tr>
        <td class="prospect-cell" title="${snippet}">${snippet}</td>
        <td class="score-cell">${entry.result.score}</td>
        <td><span class="mini-badge ${tier}">${entry.result.tier}</span></td>
        <td class="time-cell">${time}</td>
      </tr>
    `;
  }).join('');
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV() {
  if (state.history.length === 0) return;

  const headers = [
    'Timestamp', 'Score', 'Tier',
    'Title Fit', 'Company Fit', 'Pain Signal', 'Timing Signal',
    'Summary', 'Reasoning', 'Next Action', 'Model', 'Prospect URL'
  ];

  const rows = state.history.map(h => {
    const d = h.result.dimensions;
    return [
      h.timestamp.toISOString(),
      h.result.score,
      h.result.tier,
      d.title_fit?.score ?? '',
      d.company_fit?.score ?? '',
      d.pain_signal?.score ?? '',
      d.timing_signal?.score ?? '',
      h.result.profile_summary,
      h.result.reasoning,
      h.result.next_action,
      h.modelUsed,
      h.prospectSnippet
    ];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `icp-scores-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function setLoading(loading, text = 'Score Prospect') {
  state.isLoading = loading;
  els.scoreBtn.disabled = loading;
  els.btnText.textContent = text;
  els.btnText.classList.remove('hidden');
  els.btnArrow.classList.toggle('hidden', loading);
  els.btnSpinner.classList.toggle('hidden', !loading);
}

function showScoreError(err) {
  let msg = `Something went wrong: ${err.message || err}. Please try again.`;

  if (err.name === 'AuthError') {
    msg = `⚠ ${err.message} — <a href="https://console.groq.com/keys" target="_blank">Get a key →</a>`;
    showKeyStatus('⚠ Invalid key', 'invalid');
  } else if (err.name === 'RateLimitError') {
    msg = '⚠ Rate limit hit on both models. Wait a moment and retry.';
  } else if (err.name === 'NetworkError') {
    msg = `⚠ Network error: ${err.message}`;
  } else if (err.name === 'ParseError') {
    msg = `⚠ Couldn't parse the model response. ${err.message}`;
  }

  els.scoreError.innerHTML = msg;
  els.scoreError.classList.remove('hidden');
}

function hideError() {
  els.scoreError.classList.add('hidden');
  els.scoreError.textContent = '';
}
