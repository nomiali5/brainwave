# Brainwave — HD-MEA Neurophysiology Viewer

A single-page Cloudflare Worker application for visualizing [3Brain](https://www.3brain.com/) HD-MEA neurophysiology data from **BRW** and **BXR** files.

All heavy processing (HDF5 parsing via `h5py`, signal math via `numpy`) runs **entirely in the browser** using [Pyodide](https://pyodide.org/) (Python compiled to WebAssembly). No data ever leaves your machine.

---

## Features

| Feature | BRW | BXR |
|---------|-----|-----|
| Experiment info panel | ✅ | ✅ |
| Raw signal chart (first 3 s, up to 5 ch) | ✅ | — |
| Time-range slider | ✅ | — |
| Spike raster plot (0–10 s) | — | ✅ |
| Spike waveform overlay (up to 50 waveforms) | — | ✅ |
| Channel selector (waveforms) | — | ✅ |

---

## Project Structure

```
/
├── wrangler.toml       # Cloudflare Worker config
├── package.json
├── README.md
└── src/
    └── worker.js       # Entire SPA served as an HTML string
```

---

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up) (only needed for deployment)

### Install dependencies

```bash
npm install
```

### Start local dev server

```bash
npm run dev
# or: npx wrangler dev
```

Wrangler starts a local server (default: `http://localhost:8787`).  
Open the URL in a browser and drag-drop a `.brw` or `.bxr` file.

> **First load:** Pyodide (~10 MB) and h5py/numpy are downloaded from the jsDelivr CDN on the first visit and then cached by the browser.

---

## Deployment

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 2. Deploy to Cloudflare Workers

```bash
npm run deploy
# or: npx wrangler deploy
```

Wrangler will print the live URL (e.g. `https://brainwave.<your-subdomain>.workers.dev`).

### 3. (Optional) Set a custom domain

In the [Cloudflare dashboard](https://dash.cloudflare.com/), go to **Workers & Pages → brainwave → Settings → Triggers** and add a custom domain or route.

---

## How It Works

1. The Cloudflare Worker serves a single HTML page with embedded CSS and JavaScript.
2. When a file is uploaded, the browser loads **Pyodide** and installs `h5py` + `numpy` from the CDN.
3. The file's `ArrayBuffer` is passed to Python via `pyodide.globals.set('file_bytes', ...)`.
4. Python opens the buffer with `h5py.File(io.BytesIO(...))`, extracts metadata and signal data, and returns JSON.
5. JavaScript renders interactive charts with **Chart.js**.

---

## Supported File Formats

| Extension | Format | Contents |
|-----------|--------|----------|
| `.brw` | BRW (HDF5) | Continuous raw voltage traces |
| `.bxr` | BXR (HDF5) | Sorted spike events + waveforms |

> **Compressed BRW formats** (`EventsBasedSparseRaw`, `WaveletBasedEncodedRaw`) are detected and an info banner is shown; raw signal preview is not available for those variants.

---

## Test Files

The repository ships two helper scripts for generating and verifying
realistic sample files that can be dropped straight into the viewer.

### What the files simulate

| Property | Value |
|----------|-------|
| Electrode array | 4 × 4 patch (16 channels) from a 64 × 64 HD-MEA grid |
| Recording duration | 3 seconds (3 × 18 000 frames) |
| Sampling rate | 18 000 Hz |
| Spontaneously active neurons | 4 (channels 0, 65, 128, 194 — one per quadrant) |
| Firing rate (active channels) | 5 spikes / second |
| Background signal | Gaussian noise (σ = 200 digital units ≈ 25 µV after conversion) + 10 Hz sinusoidal LFP |

`sample_data.brw` — continuous raw voltage traces  
`sample_data.bxr` — sorted spike events + biphasic waveforms (150 spikes total)

### Generate the files

```bash
# Install Python dependencies (Python 3.10+ recommended)
pip install -r requirements.txt

# Create sample_data.brw and sample_data.bxr in the current directory
python generate_test_files.py
```

Expected output:

```
Generating sample_data.brw...
  - 16 channels, 18000 Hz, 3 seconds (54000 frames)
  - 3 data chunks
  - Synthetic spikes injected on channels: 0, 65, 128, 194
  ✓ sample_data.brw written (X.X MB)

Generating sample_data.bxr...
  - 150 spikes across 3 seconds
  - 4 active channels with regular spiking
  - Waveform length: 58 frames
  ✓ sample_data.bxr written (X.X KB)

Done. Files ready for upload to the visualization website.
```

### Verify the files

```bash
python verify_files.py
```

This reopens both files with `h5py` and prints a full summary of every
dataset (shape, dtype, value range, first bytes) and every attribute, so
you can confirm structural validity before uploading.

---

## License

MIT