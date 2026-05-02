"""
Generate realistic sample .brw and .bxr test files conforming to the
3Brain BrainWave HDF5 file format specification.

Usage:
    python generate_test_files.py
"""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import h5py
import numpy as np

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SAMPLING_RATE = 18000.0        # Hz
N_CHANNELS = 16
N_CHUNKS = 3
FRAMES_PER_CHUNK = 18000       # 1 second per chunk
TOTAL_FRAMES = N_CHUNKS * FRAMES_PER_CHUNK  # 54 000

# 4×4 patch from a 64×64 grid
STORED_CH_IDXS = np.array(
    [0, 1, 2, 3, 64, 65, 66, 67, 128, 129, 130, 131, 192, 193, 194, 195],
    dtype=np.int32,
)

# Channels that fire synthetic spikes (one per quadrant of the patch)
ACTIVE_CH_IDXS = {0, 65, 128, 194}

MAX_ANALOG = 4125.0
MIN_ANALOG = -4125.0
MAX_DIGITAL = 32767.0
MIN_DIGITAL = -32768.0

EXPERIMENT_SETTINGS_JSON = json.dumps(
    {
        "JsonVersion": 1,
        "$type": "ExperimentSettings",
        "SamplingRate": SAMPLING_RATE,
        "PlateModel": 0,
    }
)

TOC_ARRAY = np.array(
    [[0, 18000], [18000, 36000], [36000, 54000]], dtype=np.int64
)


# ---------------------------------------------------------------------------
# Signal helpers
# ---------------------------------------------------------------------------

def _biphasic_spike(n_samples: int = 36) -> np.ndarray:
    """Return a single biphasic spike waveform (int16 amplitudes)."""
    half = n_samples // 2
    t_neg = np.linspace(-2, 2, half)
    t_pos = np.linspace(-2, 2, n_samples - half)
    neg_phase = -1500 * np.exp(-(t_neg ** 2) / 2)
    pos_phase = 1500 * np.exp(-(t_pos ** 2) / 2)
    return np.concatenate([neg_phase, pos_phase]).astype(np.float64)


SPIKE_WAVEFORM = _biphasic_spike(36)   # 2 ms at 18 kHz


def _generate_raw_signal(ch_idx: int, chunk_idx: int) -> np.ndarray:
    """
    Generate one chunk of raw signal for a single channel.

    Returns an int16 array of length FRAMES_PER_CHUNK.
    """
    rng = np.random.default_rng(seed=ch_idx * 100 + chunk_idx)

    t = (np.arange(FRAMES_PER_CHUNK) + chunk_idx * FRAMES_PER_CHUNK) / SAMPLING_RATE

    noise = rng.normal(0, 200, FRAMES_PER_CHUNK)
    lfp = 500 * np.sin(2 * np.pi * 10 * t)
    signal = noise + lfp

    if ch_idx in ACTIVE_CH_IDXS:
        # 5 spikes per second → spike every FRAMES_PER_CHUNK / 5 = 3600 frames
        spike_interval = FRAMES_PER_CHUNK // 5
        for spike_num in range(5):
            # Spike position within the chunk
            pos = spike_num * spike_interval + spike_interval // 2
            end = min(pos + len(SPIKE_WAVEFORM), FRAMES_PER_CHUNK)
            wlen = end - pos
            signal[pos:end] += SPIKE_WAVEFORM[:wlen]

    signal = np.clip(signal, MIN_DIGITAL, MAX_DIGITAL).astype(np.int16)
    return signal


# ---------------------------------------------------------------------------
# BRW writer
# ---------------------------------------------------------------------------

def write_brw(path: str, brw_guid: str) -> None:
    print(f"Generating {path}...")
    print(f"  - {N_CHANNELS} channels, {int(SAMPLING_RATE)} Hz, "
          f"{N_CHUNKS} seconds ({TOTAL_FRAMES} frames)")
    print(f"  - {N_CHUNKS} data chunks")
    print(f"  - Synthetic spikes injected on channels: "
          + ", ".join(str(c) for c in sorted(ACTIVE_CH_IDXS)))

    ts_utc = int(datetime.now(timezone.utc).timestamp())

    with h5py.File(path, "w") as f:
        # Root attributes
        f.attrs["Version"] = np.int32(400)
        f.attrs["Description"] = "3Brain BRW Raw Data File"
        f.attrs["ExperimentDateTimeUtc"] = np.int64(ts_utc)
        f.attrs["ExperimentType"] = np.int16(0)
        f.attrs["GUID"] = brw_guid
        f.attrs["MaxAnalogValue"] = np.float64(MAX_ANALOG)
        f.attrs["MinAnalogValue"] = np.float64(MIN_ANALOG)
        f.attrs["MaxDigitalValue"] = np.float64(MAX_DIGITAL)
        f.attrs["MinDigitalValue"] = np.float64(MIN_DIGITAL)
        f.attrs["PlateModel"] = np.int16(0)
        f.attrs["SamplingRate"] = np.float64(SAMPLING_RATE)

        # Root datasets
        f.create_dataset("TOC", data=TOC_ARRAY)

        exp_ds = f.create_dataset(
            "ExperimentSettings",
            data=EXPERIMENT_SETTINGS_JSON,
        )
        exp_ds.attrs["Status"] = np.int32(0)

        f.create_dataset("ImageLayers", data=np.zeros(4, dtype=np.uint8))

        # Well group
        well = f.create_group("Well_A1")
        well.attrs["version"] = np.int32(100)

        well.create_dataset("StoredChIdxs", data=STORED_CH_IDXS)

        # Each chunk: N_CHANNELS channels × FRAMES_PER_CHUNK frames × 2 bytes
        bytes_per_chunk = N_CHANNELS * FRAMES_PER_CHUNK * 2
        raw_toc = np.array(
            [0, bytes_per_chunk, 2 * bytes_per_chunk], dtype=np.int64
        )
        well.create_dataset("RawTOC", data=raw_toc)

        # Build raw bytes
        all_raw = np.empty(N_CHUNKS * FRAMES_PER_CHUNK * N_CHANNELS, dtype=np.int16)

        for chunk_idx in range(N_CHUNKS):
            chunk_signals = np.stack(
                [_generate_raw_signal(ch, chunk_idx) for ch in STORED_CH_IDXS],
                axis=1,
            )  # shape (FRAMES_PER_CHUNK, N_CHANNELS)
            offset = chunk_idx * FRAMES_PER_CHUNK * N_CHANNELS
            all_raw[offset: offset + FRAMES_PER_CHUNK * N_CHANNELS] = (
                chunk_signals.ravel()
            )

        # Store as little-endian uint8 bytes
        raw_bytes = all_raw.astype("<i2").view(np.uint8)
        well.create_dataset("Raw", data=raw_bytes)

        # Noise statistics
        well.create_dataset(
            "NoiseMean",
            data=np.zeros(N_CHUNKS * N_CHANNELS, dtype=np.float32),
        )
        well.create_dataset(
            "NoiseStdDev",
            data=np.full(N_CHUNKS * N_CHANNELS, 200.0, dtype=np.float32),
        )
        well.create_dataset(
            "NoiseTOC",
            data=np.array([0, N_CHANNELS, 2 * N_CHANNELS], dtype=np.int64),
        )
        well.create_dataset("NoiseChIdxs", data=STORED_CH_IDXS.copy())

    size_mb = os.path.getsize(path) / 1_048_576
    print(f"  ✓ {path} written ({size_mb:.1f} MB)\n")


# ---------------------------------------------------------------------------
# BXR helpers
# ---------------------------------------------------------------------------

def _biphasic_waveform_bxr(
    wave_len: int = 58,
    trough_frame: int = 20,
    peak_frame: int = 29,
    amplitude_scale: float = 1.0,
    rng: Optional[np.random.Generator] = None,
) -> np.ndarray:
    """Return a single BXR spike waveform as int16 array of length wave_len."""
    if rng is None:
        rng = np.random.default_rng()

    waveform = np.zeros(wave_len, dtype=np.float64)
    sigma = 4.0

    for i in range(wave_len):
        neg = -1200 * amplitude_scale * np.exp(-((i - trough_frame) ** 2) / (2 * sigma ** 2))
        pos = 600 * amplitude_scale * np.exp(-((i - peak_frame) ** 2) / (2 * sigma ** 2))
        waveform[i] = neg + pos

    waveform += rng.normal(0, 50, wave_len)
    return np.clip(waveform, MIN_DIGITAL, MAX_DIGITAL).astype(np.int16)


def _generate_spike_data(brw_guid: str):
    """
    Return (spike_ch_idxs, spike_times, spike_forms, spike_toc).
    """
    rng = np.random.default_rng(seed=42)

    WAVE_LEN = 58
    TROUGH = 20
    PEAK = 29
    N_SPIKES = 150

    spike_interval = FRAMES_PER_CHUNK // 5   # 3600 frames between spikes on active channels

    active_ch_list = sorted(ACTIVE_CH_IDXS)   # [0, 65, 128, 194]
    inactive_ch_list = [c for c in STORED_CH_IDXS.tolist() if c not in ACTIVE_CH_IDXS]

    active_times = []
    active_chs = []
    for ch in active_ch_list:
        for spike_num in range(5 * N_CHUNKS):          # 15 spikes per channel total
            frame = spike_num * spike_interval + spike_interval // 2
            active_times.append(frame)
            active_chs.append(ch)

    # 150 - 60 = 90 random spikes on remaining channels
    n_random = N_SPIKES - len(active_times)
    random_chs = [inactive_ch_list[i % len(inactive_ch_list)] for i in range(n_random)]
    random_times = rng.integers(0, TOTAL_FRAMES, size=n_random).tolist()

    all_times = np.array(active_times + random_times, dtype=np.int64)
    all_chs = np.array(active_chs + random_chs, dtype=np.int32)

    sort_order = np.argsort(all_times, kind="stable")
    all_times = all_times[sort_order]
    all_chs = all_chs[sort_order]

    # Waveforms
    waveforms = np.empty(N_SPIKES * WAVE_LEN, dtype=np.int16)
    for i in range(N_SPIKES):
        scale = rng.uniform(0.8, 1.2)
        waveforms[i * WAVE_LEN: (i + 1) * WAVE_LEN] = _biphasic_waveform_bxr(
            wave_len=WAVE_LEN,
            trough_frame=TROUGH,
            peak_frame=PEAK,
            amplitude_scale=scale,
            rng=rng,
        )

    # SpikeTOC: index of first spike in each chunk
    chunk_boundaries = [i * FRAMES_PER_CHUNK for i in range(N_CHUNKS)]
    toc = []
    for boundary in chunk_boundaries:
        idx = int(np.searchsorted(all_times, boundary, side="left"))
        toc.append(idx)

    return (
        all_chs,
        all_times,
        waveforms,
        np.array(toc, dtype=np.int64),
        WAVE_LEN,
        TROUGH,
    )


# ---------------------------------------------------------------------------
# BXR writer
# ---------------------------------------------------------------------------

def write_bxr(path: str, bxr_guid: str, brw_guid: str) -> None:
    print(f"Generating {path}...")

    spike_chs, spike_times, spike_forms, spike_toc, wave_len, wave_offset = (
        _generate_spike_data(brw_guid)
    )
    n_spikes = len(spike_times)

    print(f"  - {n_spikes} spikes across {N_CHUNKS} seconds")
    print(f"  - {len(ACTIVE_CH_IDXS)} active channels with regular spiking")
    print(f"  - Waveform length: {wave_len} frames")

    with h5py.File(path, "w") as f:
        # Root attributes
        f.attrs["Version"] = np.int32(300)
        f.attrs["Description"] = "3Brain BXR Experiment Result File"
        f.attrs["ExperimentType"] = np.int16(0)
        f.attrs["GUID"] = bxr_guid
        f.attrs["SourceGUID"] = brw_guid
        f.attrs["MaxAnalogValue"] = np.float64(MAX_ANALOG)
        f.attrs["MinAnalogValue"] = np.float64(MIN_ANALOG)
        f.attrs["MaxDigitalValue"] = np.float64(MAX_DIGITAL)
        f.attrs["MinDigitalValue"] = np.float64(MIN_DIGITAL)
        f.attrs["PlateModel"] = np.int16(0)
        f.attrs["SamplingRate"] = np.float64(SAMPLING_RATE)

        # Root datasets
        f.create_dataset("TOC", data=TOC_ARRAY)

        exp_ds = f.create_dataset(
            "ExperimentSettings",
            data=EXPERIMENT_SETTINGS_JSON,
        )
        exp_ds.attrs["Status"] = np.int32(0)

        f.create_dataset("ImageLayers", data=np.zeros(4, dtype=np.uint8))

        # Well group
        well = f.create_group("Well_A1")
        well.attrs["version"] = np.int32(101)

        well.create_dataset("StoredChIdxs", data=STORED_CH_IDXS)
        well.create_dataset("SpikeChIdxs", data=spike_chs)
        well.create_dataset("SpikeTimes", data=spike_times)

        sf_ds = well.create_dataset("SpikeForms", data=spike_forms)
        sf_ds.attrs["Wavelength"] = np.int32(wave_len)
        sf_ds.attrs["WaveTimeOffset"] = np.int32(wave_offset)

        well.create_dataset("SpikeTOC", data=spike_toc)

    size_kb = os.path.getsize(path) / 1024
    print(f"  ✓ {path} written ({size_kb:.1f} KB)\n")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    brw_guid = str(uuid.uuid4())
    bxr_guid = str(uuid.uuid4())

    write_brw("sample_data.brw", brw_guid)
    write_bxr("sample_data.bxr", bxr_guid, brw_guid)

    print("Done. Files ready for upload to the visualization website.")


if __name__ == "__main__":
    main()
