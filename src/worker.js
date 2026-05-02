const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Brainwave — HD-MEA Neurophysiology Viewer</title>
<script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
<style>
  :root {
    --bg:        #0a0c10;
    --surface:   #11141c;
    --border:    #1e2435;
    --accent:    #00e5ff;
    --accent2:   #7b61ff;
    --warn:      #ff9f43;
    --error:     #ff4757;
    --text:      #cdd6f4;
    --muted:     #6c7a99;
    --radius:    10px;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; font-size: 14px; }

  /* ── layout ── */
  body { display: flex; flex-direction: column; min-height: 100vh; }
  header { padding: 18px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
  header svg { flex-shrink: 0; }
  header h1 { font-size: 1.25rem; font-weight: 700; letter-spacing: .04em; color: var(--accent); }
  header span { color: var(--muted); font-size: .85rem; }
  main { flex: 1; padding: 24px; display: flex; flex-direction: column; gap: 20px; max-width: 1400px; width: 100%; margin: 0 auto; }

  /* ── upload zone ── */
  #upload-zone {
    border: 2px dashed var(--border); border-radius: var(--radius);
    padding: 48px 24px; text-align: center; cursor: pointer;
    transition: border-color .2s, background .2s;
    background: var(--surface);
  }
  #upload-zone.drag-over { border-color: var(--accent); background: #0d1520; }
  #upload-zone p { color: var(--muted); margin-top: 8px; font-size: .9rem; }
  #upload-zone em { color: var(--accent); font-style: normal; font-weight: 600; }
  #file-input { display: none; }

  /* ── status / spinner ── */
  #status-bar {
    display: none; align-items: center; gap: 12px;
    padding: 14px 18px; background: var(--surface); border-radius: var(--radius);
    border: 1px solid var(--border);
  }
  #status-bar.visible { display: flex; }
  .spinner {
    width: 20px; height: 20px; border: 3px solid var(--border);
    border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  #status-msg { color: var(--text); }

  /* ── banners ── */
  .banner {
    padding: 12px 16px; border-radius: var(--radius); font-size: .9rem; display: none;
    border-left: 4px solid transparent;
  }
  .banner.visible { display: block; }
  .banner.warn  { background: #1f1800; border-color: var(--warn);  color: var(--warn);  }
  .banner.error { background: #1a0007; border-color: var(--error); color: var(--error); }
  .banner.info  { background: #001820; border-color: var(--accent); color: var(--accent); }

  /* ── info panel ── */
  #info-panel {
    display: none; background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px;
  }
  #info-panel.visible { display: block; }
  #info-panel h2 { color: var(--accent); font-size: 1rem; margin-bottom: 14px; letter-spacing: .05em; text-transform: uppercase; }
  .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
  .info-card { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; }
  .info-card .label { color: var(--muted); font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; }
  .info-card .value { color: var(--text); font-size: 1.1rem; font-weight: 600; margin-top: 4px; }

  /* ── controls ── */
  #controls { display: none; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 20px; gap: 20px; flex-wrap: wrap; align-items: center; }
  #controls.visible { display: flex; }
  .ctrl-group { display: flex; flex-direction: column; gap: 4px; }
  .ctrl-group label { color: var(--muted); font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; }
  select, input[type=range] { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: .9rem; cursor: pointer; }
  select:focus { outline: 1px solid var(--accent); }
  input[type=range] { width: 220px; accent-color: var(--accent); padding: 2px; }
  #time-label { color: var(--accent); font-size: .85rem; min-width: 90px; }

  /* ── charts grid ── */
  #charts-grid {
    display: none; grid-template-columns: 1fr 1fr; gap: 20px;
  }
  #charts-grid.visible { display: grid; }
  .chart-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 18px; display: flex; flex-direction: column; gap: 12px;
  }
  .chart-card h3 { color: var(--accent2); font-size: .9rem; text-transform: uppercase; letter-spacing: .05em; }
  .chart-wrap { position: relative; height: 300px; }
  canvas { width: 100% !important; }

  /* ── footer ── */
  footer { padding: 14px 24px; border-top: 1px solid var(--border); color: var(--muted); font-size: .78rem; text-align: center; }

  @media (max-width: 800px) {
    #charts-grid.visible { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>

<header>
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="15" stroke="#00e5ff" stroke-width="1.5"/>
    <path d="M8 16 Q12 8 16 16 Q20 24 24 16" stroke="#7b61ff" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="8"  cy="16" r="2" fill="#00e5ff"/>
    <circle cx="24" cy="16" r="2" fill="#00e5ff"/>
  </svg>
  <div>
    <h1>Brainwave</h1>
    <span>HD-MEA Neurophysiology Viewer · 3Brain BRW/BXR</span>
  </div>
</header>

<main>
  <!-- Upload -->
  <div id="upload-zone" role="button" tabindex="0" aria-label="Upload BRW or BXR file">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
    <p>Drag &amp; drop a <em>.brw</em> or <em>.bxr</em> file here, or <em>click to browse</em></p>
    <p style="font-size:.78rem;margin-top:4px;">All processing happens in your browser — no data is uploaded to any server.</p>
    <input type="file" id="file-input" accept=".brw,.bxr" />
  </div>

  <!-- Status -->
  <div id="status-bar">
    <div class="spinner"></div>
    <span id="status-msg">Initializing…</span>
  </div>

  <!-- Banners -->
  <div id="banner-warn"  class="banner warn"></div>
  <div id="banner-error" class="banner error"></div>
  <div id="banner-info"  class="banner info"></div>

  <!-- Info Panel -->
  <div id="info-panel">
    <h2>Experiment Info</h2>
    <div class="info-grid" id="info-grid"></div>
  </div>

  <!-- Controls -->
  <div id="controls">
    <div class="ctrl-group" id="channel-ctrl" style="display:none">
      <label for="channel-select">Waveform Channel</label>
      <select id="channel-select"></select>
    </div>
    <div class="ctrl-group" id="time-ctrl" style="display:none">
      <label for="time-slider">Time Window Start</label>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="range" id="time-slider" min="0" step="1" value="0" />
        <span id="time-label">0 – 3 s</span>
      </div>
    </div>
  </div>

  <!-- Charts -->
  <div id="charts-grid">
    <div class="chart-card" id="card-raw"      style="display:none"><h3>Raw Signal</h3><div class="chart-wrap"><canvas id="chart-raw"></canvas></div></div>
    <div class="chart-card" id="card-raster"   style="display:none"><h3>Spike Raster (0 – 10 s)</h3><div class="chart-wrap"><canvas id="chart-raster"></canvas></div></div>
    <div class="chart-card" id="card-waveform" style="display:none"><h3>Spike Waveforms</h3><div class="chart-wrap"><canvas id="chart-waveform"></canvas></div></div>
  </div>
</main>

<footer>Brainwave · client-side HD-MEA viewer · all data processed locally in WebAssembly</footer>

<script>
// ─── DOM refs ───────────────────────────────────────────────────────────────
const uploadZone   = document.getElementById('upload-zone');
const fileInput    = document.getElementById('file-input');
const statusBar    = document.getElementById('status-bar');
const statusMsg    = document.getElementById('status-msg');
const bannerWarn   = document.getElementById('banner-warn');
const bannerError  = document.getElementById('banner-error');
const bannerInfo   = document.getElementById('banner-info');
const infoPanel    = document.getElementById('info-panel');
const infoGrid     = document.getElementById('info-grid');
const controls     = document.getElementById('controls');
const channelCtrl  = document.getElementById('channel-ctrl');
const channelSel   = document.getElementById('channel-select');
const timeCtrl     = document.getElementById('time-ctrl');
const timeSlider   = document.getElementById('time-slider');
const timeLabel    = document.getElementById('time-label');
const chartsGrid   = document.getElementById('charts-grid');
const cardRaw      = document.getElementById('card-raw');
const cardRaster   = document.getElementById('card-raster');
const cardWaveform = document.getElementById('card-waveform');

// ─── State ──────────────────────────────────────────────────────────────────
let pyodide = null;
let parsedData = null;
let rawChart = null;
let rasterChart = null;
let waveformChart = null;
const WINDOW_SEC = 3;
const MAX_WAVEFORMS_PER_CHANNEL = 50;

// ─── Helpers ────────────────────────────────────────────────────────────────
function setStatus(msg) {
  statusBar.classList.add('visible');
  statusMsg.textContent = msg;
}
function hideStatus() { statusBar.classList.remove('visible'); }

function showError(msg) {
  bannerError.textContent = '⚠ ' + msg;
  bannerError.classList.add('visible');
}
function showWarn(msg) {
  bannerWarn.textContent = '⚠ ' + msg;
  bannerWarn.classList.add('visible');
}
function showInfo(msg) {
  bannerInfo.textContent = 'ℹ ' + msg;
  bannerInfo.classList.add('visible');
}
function clearBanners() {
  [bannerError, bannerWarn, bannerInfo].forEach(b => {
    b.classList.remove('visible');
    b.textContent = '';
  });
}

function infoCard(label, value) {
  return '<div class="info-card"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
}

function destroyChart(ref) { if (ref) { ref.destroy(); } }

// ─── Pyodide init ───────────────────────────────────────────────────────────
async function initPyodide() {
  if (pyodide) return pyodide;
  setStatus('Loading Pyodide WebAssembly runtime…');
  pyodide = await loadPyodide();
  // Attempt to grow the WASM heap so larger files can be processed
  try {
    pyodide._module.wasmMemory.grow(4096); // +256 MiB (each page = 64 KiB)
  } catch(e) {
    console.warn('Could not grow WASM memory:', e);
  }
  setStatus('Installing h5py and numpy…');
  await pyodide.loadPackage(['h5py', 'numpy']);
  return pyodide;
}

// ─── Upload events ──────────────────────────────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files.length) handleFile(fileInput.files[0]); });

// ─── Main file handler ──────────────────────────────────────────────────────
async function handleFile(file) {
  clearBanners();
  infoPanel.classList.remove('visible');
  controls.classList.remove('visible');
  chartsGrid.classList.remove('visible');
  [cardRaw, cardRaster, cardWaveform].forEach(c => c.style.display = 'none');
  destroyChart(rawChart);      rawChart      = null;
  destroyChart(rasterChart);   rasterChart   = null;
  destroyChart(waveformChart); waveformChart = null;

  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'brw' && ext !== 'bxr') {
    showError('Invalid file format. Please upload a .brw or .bxr file.');
    return;
  }

  try {
    const MAX_FILE_SIZE_MB = 200;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new Error(
        'File size (' + (file.size / 1024 / 1024).toFixed(1) + ' MB) exceeds the ' +
        MAX_FILE_SIZE_MB + ' MB limit for in-browser processing. ' +
        'Consider using a smaller recording interval or a BXR results file instead.'
      );
    }

    const py = await initPyodide();
    setStatus('Reading file…');
    const buffer = await file.arrayBuffer();
    const uint8  = new Uint8Array(buffer);

    setStatus('Parsing ' + file.name + '…');
    py.globals.set('file_bytes', uint8);

    const result = await py.runPythonAsync(PYTHON_PARSER);
    const pythonResult = result instanceof py.ffi.PyProxy ? result.toJs({ dict_converter: Object.fromEntries }) : result;
    parsedData   = typeof pythonResult === 'string' ? JSON.parse(pythonResult) : pythonResult;

    if (parsedData.error) { showError(parsedData.error); hideStatus(); return; }
    if (parsedData.warning) showWarn(parsedData.warning);
    if (parsedData.info)    showInfo(parsedData.info);

    hideStatus();
    renderInfoPanel(parsedData);
    renderCharts(parsedData);

  } catch (err) {
    hideStatus();
    showError('Parsing failed: ' + (err.message || String(err)));
    console.error(err);
  }
}

// ─── Info panel ─────────────────────────────────────────────────────────────
function renderInfoPanel(d) {
  const meta = d.meta;
  let html = '';
  html += infoCard('File Type',        meta.file_type);
  html += infoCard('Sampling Rate',    meta.sampling_rate + ' Hz');
  html += infoCard('Plate Model',      meta.plate_model || '—');
  html += infoCard('Stored Channels',  meta.num_channels);
  html += infoCard('Duration',         meta.duration_sec != null ? meta.duration_sec.toFixed(2) + ' s' : '—');
  if (meta.file_type === 'BXR') {
    html += infoCard('Spikes Detected', meta.num_spikes != null ? meta.num_spikes.toLocaleString() : '—');
  }
  infoGrid.innerHTML = html;
  infoPanel.classList.add('visible');
}

// ─── Chart rendering ─────────────────────────────────────────────────────────
const COLORS = ['#00e5ff','#7b61ff','#ff9f43','#2ed573','#ff4757','#eccc68'];

function renderCharts(d) {
  chartsGrid.classList.add('visible');

  if (d.raw_signal) {
    renderRawChart(d.raw_signal, d.meta.sampling_rate);
    cardRaw.style.display = 'flex';

    const maxStart = Math.max(0, (d.meta.duration_sec || WINDOW_SEC) - WINDOW_SEC);
    timeSlider.max   = Math.floor(maxStart);
    timeSlider.value = 0;
    timeLabel.textContent = '0 – ' + WINDOW_SEC + ' s';
    timeCtrl.style.display = 'flex';
    controls.classList.add('visible');

    timeSlider.oninput = () => {
      const start = parseInt(timeSlider.value, 10);
      timeLabel.textContent = start + ' – ' + (start + WINDOW_SEC) + ' s';
      renderRawChartWindow(d.raw_signal, d.meta.sampling_rate, start);
    };
  }

  if (d.spike_raster) {
    renderRasterChart(d.spike_raster);
    cardRaster.style.display = 'flex';
    chartsGrid.classList.add('visible');
  }

  if (d.spike_waveforms) {
    const chIdxs = Object.keys(d.spike_waveforms).map(Number).sort((a,b)=>a-b);
    channelSel.innerHTML = chIdxs.map(c => '<option value="' + c + '">' + c + '</option>').join('');
    channelCtrl.style.display = 'flex';
    controls.classList.add('visible');
    renderWaveformChart(d.spike_waveforms, chIdxs[0], d.meta.sampling_rate);
    cardWaveform.style.display = 'flex';

    channelSel.onchange = () => {
      destroyChart(waveformChart);
      renderWaveformChart(d.spike_waveforms, parseInt(channelSel.value, 10), d.meta.sampling_rate);
    };
  }
}

function rawChartDatasets(rawSignal, samplingRate, startSec) {
  const startSample = Math.round(startSec * samplingRate);
  const endSample   = Math.round((startSec + WINDOW_SEC) * samplingRate);
  const datasets = [];
  rawSignal.channels.forEach((ch, i) => {
    const slice = ch.analog.slice(startSample, endSample);
    const data  = Array.from(slice).map((v, j) => ({ x: startSec + j / samplingRate, y: v }));
    datasets.push({
      label:           'Ch ' + ch.index,
      data,
      borderColor:     COLORS[i % COLORS.length],
      borderWidth:     1,
      pointRadius:     0,
      tension:         0,
    });
  });
  return datasets;
}

function renderRawChart(rawSignal, samplingRate) {
  destroyChart(rawChart);
  const ctx = document.getElementById('chart-raw').getContext('2d');
  rawChart = new Chart(ctx, {
    type: 'line',
    data: { datasets: rawChartDatasets(rawSignal, samplingRate, 0) },
    options: rawChartOptions(),
  });
}

function renderRawChartWindow(rawSignal, samplingRate, startSec) {
  if (!rawChart) return;
  rawChart.data.datasets = rawChartDatasets(rawSignal, samplingRate, startSec);
  rawChart.options.scales.x.min = startSec;
  rawChart.options.scales.x.max = startSec + WINDOW_SEC;
  rawChart.update('none');
}

function rawChartOptions() {
  return {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#cdd6f4', boxWidth: 12, font: { size: 11 } } },
      tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + ' µV' } },
    },
    scales: {
      x: {
        type: 'linear',
        min: 0, max: WINDOW_SEC,
        title: { display: true, text: 'Time (s)', color: '#6c7a99' },
        ticks: { color: '#6c7a99', maxTicksLimit: 8 },
        grid:  { color: '#1e2435' },
      },
      y: {
        title: { display: true, text: 'Amplitude (µV)', color: '#6c7a99' },
        ticks: { color: '#6c7a99' },
        grid:  { color: '#1e2435' },
      },
    },
  };
}

function renderRasterChart(spikeRaster) {
  destroyChart(rasterChart);
  const ctx = document.getElementById('chart-raster').getContext('2d');
  // Group by channel for coloring
  const byChannel = {};
  spikeRaster.forEach(pt => {
    if (!byChannel[pt.ch]) byChannel[pt.ch] = [];
    byChannel[pt.ch].push({ x: pt.t, y: pt.ch });
  });
  const datasets = Object.entries(byChannel).map(([ch, data], i) => ({
    label:           'Ch ' + ch,
    data,
    backgroundColor: COLORS[i % COLORS.length] + '99',
    pointRadius:     3,
    pointStyle:      'rect',
    showLine:        false,
  }));
  rasterChart = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => 'Ch ' + ctx.parsed.y + '  @  ' + ctx.parsed.x.toFixed(3) + ' s' } },
      },
      scales: {
        x: {
          min: 0, max: 10,
          title: { display: true, text: 'Time (s)', color: '#6c7a99' },
          ticks: { color: '#6c7a99' },
          grid:  { color: '#1e2435' },
        },
        y: {
          title: { display: true, text: 'Channel Index', color: '#6c7a99' },
          ticks: { color: '#6c7a99', stepSize: 1 },
          grid:  { color: '#1e2435' },
        },
      },
    },
  });
}

function renderWaveformChart(spikeWaveforms, chIdx, samplingRate) {
  destroyChart(waveformChart);
  const ctx = document.getElementById('chart-waveform').getContext('2d');
  const waveforms = spikeWaveforms[chIdx] || [];
  const nSamples  = waveforms.length > 0 ? waveforms[0].length : 0;
  const samplePeriodMs = samplingRate > 0 ? (1000 / samplingRate) : (1000 / 20000);
  const xMs = Array.from({ length: nSamples }, (_, i) => (i - Math.floor(nSamples / 2)) * samplePeriodMs);
  const datasets = waveforms.slice(0, MAX_WAVEFORMS_PER_CHANNEL).map(w => ({
    data:        xMs.map((x, i) => ({ x, y: w[i] })),
    borderColor: '#00e5ff22',
    borderWidth: 1,
    pointRadius: 0,
    tension:     0,
    showLine:    true,
  }));
  waveformChart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Time (ms)', color: '#6c7a99' },
          ticks: { color: '#6c7a99' },
          grid:  { color: '#1e2435' },
        },
        y: {
          title: { display: true, text: 'Amplitude (µV)', color: '#6c7a99' },
          ticks: { color: '#6c7a99' },
          grid:  { color: '#1e2435' },
        },
      },
    },
  });
}

// ─── Python parser (runs in Pyodide) ────────────────────────────────────────
const PYTHON_PARSER = \`
import io, json, traceback
import numpy as np
import h5py

def parse_file(file_bytes):
    result = {}
    data = None
    buf  = None
    f    = None
    try:
        data = file_bytes.tobytes()
        buf  = io.BytesIO(data)
        try:
            f = h5py.File(buf, 'r')
        except Exception:
            return json.dumps({"error": "Invalid file format. Please upload a .brw or .bxr file."})

        # ── root attributes ──────────────────────────────────────────────
        attrs = dict(f.attrs)
        sampling_rate      = float(attrs.get('SamplingRate', attrs.get('samplingRate', 0)))
        min_analog         = float(attrs.get('MinAnalogValue', -4096.0))
        max_analog         = float(attrs.get('MaxAnalogValue',  4096.0))
        min_digital        = float(attrs.get('MinDigitalValue', -32768.0))
        max_digital        = float(attrs.get('MaxDigitalValue',  32767.0))
        plate_model        = str(attrs.get('PlateModel', attrs.get('plateModel', '')))

        if min_digital == max_digital:
            min_digital = -32768.0
            max_digital =  32767.0
        conv_factor = (max_analog - min_analog) / (max_digital - min_digital)
        offset      = min_analog - conv_factor * min_digital

        # ── detect file type ─────────────────────────────────────────────
        has_well = 'Well_A1' in f
        if not has_well:
            return json.dumps({"error": "No Well_A1 data found. Multi-well files show Well_A1 only."})

        well = f['Well_A1']
        well_keys = list(well.keys())

        has_spike_times = 'SpikeTimes' in well
        file_type = 'BXR' if has_spike_times else 'BRW'

        # ── stored channel indices ───────────────────────────────────────
        stored_ch_idxs = []
        if 'StoredChIdxs' in well:
            stored_ch_idxs = well['StoredChIdxs'][:].tolist()
        num_channels = len(stored_ch_idxs)

        # ── duration ─────────────────────────────────────────────────────
        duration_sec = None
        if 'SpikeTOC' in well:
            toc = well['SpikeTOC'][:]
            if toc.size > 0:
                last_frame = int(toc[-1, 1]) if toc.ndim == 2 else int(toc[-1])
                duration_sec = last_frame / sampling_rate if sampling_rate > 0 else None
        elif 'RawTOC' in well:
            # duration will be computed from n_frames after reading Raw
            pass

        result['meta'] = {
            'file_type':    file_type,
            'sampling_rate': sampling_rate,
            'plate_model':   plate_model,
            'num_channels':  num_channels,
            'duration_sec':  duration_sec,
        }

        # ════════════════════════════════════════════════════════════════
        # BXR path
        # ════════════════════════════════════════════════════════════════
        if file_type == 'BXR':
            spike_times_frames = well['SpikeTimes'][:] if 'SpikeTimes' in well else np.array([])
            spike_ch_idxs      = well['SpikeChIdxs'][:] if 'SpikeChIdxs' in well else np.array([])
            spike_forms_raw    = well['SpikeForms'][:]   if 'SpikeForms' in well  else None

            num_spikes = len(spike_times_frames)
            result['meta']['num_spikes'] = num_spikes

            # spike times in seconds
            spike_times_sec = (spike_times_frames.astype(float) / sampling_rate).tolist() if sampling_rate > 0 else spike_times_frames.tolist()

            # raster: first 10 s
            raster = []
            for t, ch in zip(spike_times_sec, spike_ch_idxs.tolist()):
                if t <= 10.0:
                    raster.append({'t': round(t, 5), 'ch': int(ch)})
            result['spike_raster'] = raster

            # waveforms per channel (up to 50 each), all channels with spikes
            waveforms_by_ch = {}
            if spike_forms_raw is not None and spike_forms_raw.ndim == 2:
                for idx, (ch, wf) in enumerate(zip(spike_ch_idxs.tolist(), spike_forms_raw)):
                    ch = int(ch)
                    if ch not in waveforms_by_ch:
                        waveforms_by_ch[ch] = []
                    if len(waveforms_by_ch[ch]) < 50:
                        analog_wf = (offset + wf.astype(float) * conv_factor).tolist()
                        waveforms_by_ch[ch].append(analog_wf)
            result['spike_waveforms'] = waveforms_by_ch

        # ════════════════════════════════════════════════════════════════
        # BRW path
        # ════════════════════════════════════════════════════════════════
        else:
            has_raw          = 'Raw' in well
            has_sparse_raw   = 'EventsBasedSparseRaw' in well
            has_wavelet_raw  = 'WaveletBasedEncodedRaw' in well

            if has_sparse_raw or has_wavelet_raw:
                result['info'] = 'Compressed raw format detected — raw signal preview not available; showing metadata only.'
                return json.dumps(result)

            if not has_raw:
                result['warning'] = 'No Raw dataset found in Well_A1.'
                return json.dumps(result)

            raw_dataset = well['Raw']
            raw_toc     = well['RawTOC'][:] if 'RawTOC' in well else None

            # decode first 3 s for up to 5 channels
            window_samples = int(3.0 * sampling_rate)
            num_ch_to_show = min(5, num_channels)
            ch_indices     = stored_ch_idxs[:num_ch_to_show] if stored_ch_idxs else list(range(num_ch_to_show))

            # Raw is a 1-D uint8 array: each int16 sample = 2 bytes (little-endian).
            # Layout: [frame0_ch0_lo, frame0_ch0_hi, frame0_ch1_lo, frame0_ch1_hi, ...,
            #          frame1_ch0_lo, frame1_ch0_hi, ...]
            n_channels_stored = len(stored_ch_idxs) if stored_ch_idxs else num_channels
            if n_channels_stored == 0:
                result['warning'] = 'No channel information available.'
                return json.dumps(result)

            bytes_per_frame  = n_channels_stored * 2   # int16 = 2 bytes per sample
            total_bytes      = raw_dataset.shape[0]
            n_frames         = total_bytes // bytes_per_frame

            # RawTOC entries are byte offsets into Raw for the start of each chunk
            chunk_byte_start = int(raw_toc[0]) if raw_toc is not None and len(raw_toc) > 0 else 0

            target_frames = int(min(window_samples, n_frames))
            byte_start    = chunk_byte_start
            byte_end      = byte_start + target_frames * bytes_per_frame

            raw_bytes = np.array(raw_dataset[byte_start:byte_end], dtype=np.uint8)
            samples   = np.frombuffer(raw_bytes.tobytes(), dtype=np.int16)

            # ensure we have complete frames
            complete_frames = samples.size // n_channels_stored
            samples = samples[:complete_frames * n_channels_stored].reshape(complete_frames, n_channels_stored)

            channels_out = []
            for i, ch_idx in enumerate(ch_indices):
                # column i corresponds to stored_ch_idxs[i]
                digital_vals = samples[:, i].astype(float)
                analog_vals  = (offset + digital_vals * conv_factor).tolist()
                channels_out.append({'index': int(ch_idx), 'analog': analog_vals})

            if duration_sec is None:
                duration_sec = float(n_frames) / sampling_rate
                result['meta']['duration_sec'] = duration_sec

            result['raw_signal'] = {'channels': channels_out}

    except Exception as e:
        result['error'] = 'Parsing failed: ' + traceback.format_exc()
    finally:
        if f is not None:
            f.close()
        if data is not None:
            del data
        if buf is not None:
            del buf

    return json.dumps(result)

parse_file(file_bytes)
\`;

// Bootstrap: pre-warm Pyodide on page load (non-blocking)
initPyodide().then(() => {
  hideStatus();
  console.info('[Brainwave] Pyodide ready');
}).catch(err => {
  hideStatus();
  showWarn('Pyodide failed to pre-load. It will be loaded when you open a file. (' + err.message + ')');
});
</script>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    return new Response(HTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  },
};
