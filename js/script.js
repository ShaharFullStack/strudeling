// ============================================================
// STRUDEL BUILDER - Application State & Logic
// ============================================================

const TRACK_TYPES = {
  drums: {
    label: 'Drums',
    color: 'var(--accent-drums)',
    glow: 'var(--glow-drums)',
    sounds: ['bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'cr', 'cb'],
    defaultSound: 'bd',
    mode: 'steps', // step sequencer
    defaultSteps: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]
  },
  bass: {
    label: 'Bass',
    color: 'var(--accent-bass)',
    glow: 'var(--glow-bass)',
    sounds: ['sawtooth', 'square', 'triangle', 'sine'],
    defaultSound: 'sawtooth',
    mode: 'notes', // piano roll
    defaultNotes: [0, -1, 2, -1, 0, -1, 4, -1, 0, -1, 2, -1, 5, -1, 4, -1]
  },
  melody: {
    label: 'Melody',
    color: 'var(--accent-melody)',
    glow: 'var(--glow-melody)',
    sounds: ['triangle', 'sine', 'square', 'sawtooth'],
    defaultSound: 'triangle',
    mode: 'notes',
    defaultNotes: [4, -1, 5, 7, -1, 4, -1, 2, 0, -1, -1, 2, 4, -1, 5, -1]
  },
  chords: {
    label: 'Chords',
    color: 'var(--accent-chords)',
    glow: 'var(--glow-chords)',
    sounds: ['sine', 'triangle', 'sawtooth', 'square'],
    defaultSound: 'sine',
    mode: 'chords',
    defaultChords: ['Am', '~', 'F', '~', 'C', '~', 'G', '~', 'Am', '~', 'F', '~', 'C', '~', 'G', '~']
  }
};

const AVAILABLE_CHORDS = ['Am','C','Dm','Em','F','G','Bdim','A','Bm','D','E','Fm','Gm','Bb','Cm','Eb','~'];

const TRANSFORMS = [
  { id: 'rev', label: 'rev', desc: 'Reverse' },
  { id: 'fast2', label: 'fast(2)', desc: 'Double speed' },
  { id: 'slow2', label: 'slow(2)', desc: 'Half speed' },
  { id: 'juxrev', label: 'jux(rev)', desc: 'Stereo reverse' },
  { id: 'every3rev', label: 'every(3,rev)', desc: 'Reverse every 3' },
  { id: 'every4fast2', label: 'every(4,fast(2))', desc: 'Fast every 4' },
  { id: 'sometimes', label: 'sometimes(rev)', desc: 'Random reverse' },
  { id: 'degrade', label: 'degrade()', desc: 'Random gaps' },
];

let state = {
  playing: false,
  bpm: 120,
  scale: 'A:minor',
  tracks: [],
  activeTrack: null,
  strudelReady: false
};

let trackIdCounter = 0;

// ============================================================
// STRUDEL ENGINE
// ============================================================

let strudelInitialized = false;

// Call initStrudel at top level with prebake for samples
const strudelReady = (async () => {
  try {
    await initStrudel({
      prebake: () => {
        // Load the default sample library (drum machines, instruments)
        return samples('github:tidalcycles/dirt-samples');
      }
    });
    strudelInitialized = true;
    state.strudelReady = true;
    console.log('Strudel engine + samples ready');
  } catch(e) {
    console.warn('Init with samples failed, trying bare init:', e);
    try {
      await initStrudel();
      strudelInitialized = true;
      state.strudelReady = true;
      console.log('Strudel engine ready (no samples)');
    } catch(e2) {
      console.error('Strudel init failed completely:', e2);
    }
  }
})();

function generateDisplayCode() {
  if (state.tracks.length === 0) return '// Add tracks to start making music!';

  const trackCodes = buildTrackCodes();
  if (trackCodes.length === 0) return '// All tracks are muted';

  const cps = (state.bpm / 60 / 4).toFixed(3);

  if (trackCodes.length === 1) {
    return trackCodes[0] + `.cps(${cps})`;
  } else {
    const lines = [];
    lines.push('stack(');
    trackCodes.forEach((c, i) => {
      lines.push('  ' + c + (i < trackCodes.length - 1 ? ',' : ''));
    });
    lines.push(`)` + `.cps(${cps})`);
    return lines.join('\n');
  }
}

function buildTrackCodes() {
  const trackCodes = [];

  for (const track of state.tracks) {
    if (track.muted) continue;
    let code = '';

    if (track.type === 'drums') {
      const pattern = track.steps.map(s => s ? track.sound : '~').join(' ');
      code = `s("${pattern}")`;
    } else if (track.type === 'chords') {
      const chordPattern = track.chords.filter(c => c).join(' ');
      code = `note("<${chordPattern}>".voicings("lefthand"))`;
      code += `.s("${track.sound}")`;
      code += `.slow(4)`;
    } else {
      const notePattern = track.notes.map(n => n === -1 ? '~' : n).join(' ');
      code = `n("${notePattern}")`;
      code += `.scale("${state.scale}")`;
      code += `.s("${track.sound}")`;
      if (track.type === 'bass') code += `.slow(2)`;
    }

    // Effects
    if (track.gain !== undefined && track.gain !== 0.8) {
      code += `.gain(${track.gain.toFixed(2)})`;
    }
    if (track.lpf && track.lpf < 20000) code += `.lpf(${track.lpf})`;
    if (track.hpf && track.hpf > 20) code += `.hpf(${track.hpf})`;
    if (track.delay && track.delay > 0) code += `.delay(${track.delay.toFixed(2)})`;
    if (track.room && track.room > 0) code += `.room(${track.room.toFixed(2)})`;
    if (track.pan !== undefined && track.pan !== 0.5) code += `.pan(${track.pan.toFixed(2)})`;

    // Transforms
    for (const t of (track.transforms || [])) {
      const transform = TRANSFORMS.find(tr => tr.id === t);
      if (transform) code += `.${transform.label}`;
    }

    trackCodes.push(code);
  }

  return trackCodes;
}

async function playCode() {
  // Make sure engine is ready
  if (!strudelInitialized) {
    console.log('Waiting for Strudel engine...');
    await strudelReady;
    if (!strudelInitialized) {
      console.error('Engine failed to initialize');
      return;
    }
  }

  const trackCodes = buildTrackCodes();
  if (trackCodes.length === 0) {
    // No active tracks - stop playback
    try { hush(); } catch(e) {}
    return;
  }

  const cps = (state.bpm / 60 / 4).toFixed(3);

  // Build the pattern expression
  let patternExpr;
  if (trackCodes.length === 1) {
    patternExpr = trackCodes[0];
  } else {
    patternExpr = `stack(\n${trackCodes.map(c => '  ' + c).join(',\n')}\n)`;
  }

  // Use the global evaluate() for hot-swapping: replaces the pattern seamlessly
  // without stopping the scheduler, so the music keeps flowing.
  // evaluate() is exported by @strudel/web and internally calls repl.evaluate()
  try {
    const code = patternExpr + `.cps(${cps})`;
    await evaluate(code);
    console.log('Pattern updated (hot-swap)');
  } catch(e) {
    console.error('Play error:', e);
  }
}

function stopCode() {
  try {
    hush();
  } catch(e) {
    console.warn('Stop error:', e);
  }
}

// ============================================================
// TRACK MANAGEMENT
// ============================================================

function createTrack(type, preset = null) {
  const typeInfo = TRACK_TYPES[type];
  const id = ++trackIdCounter;
  const track = {
    id,
    type,
    name: `${typeInfo.label} ${id}`,
    sound: typeInfo.defaultSound,
    muted: false,
    gain: 0.8,
    lpf: 20000,
    hpf: 20,
    delay: 0,
    room: 0,
    pan: 0.5,
    transforms: [],
  };

  if (type === 'drums') {
    track.steps = preset ? [...preset] : [...typeInfo.defaultSteps];
  } else if (type === 'chords') {
    track.chords = preset ? [...preset] : [...typeInfo.defaultChords];
  } else {
    track.notes = preset ? [...preset] : [...typeInfo.defaultNotes];
  }

  state.tracks.push(track);
  state.activeTrack = id;
  renderTracks();
  updateCode();
  return track;
}

function removeTrack(id) {
  state.tracks = state.tracks.filter(t => t.id !== id);
  if (state.activeTrack === id) state.activeTrack = state.tracks.length > 0 ? state.tracks[0].id : null;
  renderTracks();
  updateCode();
}

function toggleMute(id) {
  const track = state.tracks.find(t => t.id === id);
  if (track) {
    track.muted = !track.muted;
    renderTracks();
    updateCode();
    if (state.playing) playCode();
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderTracks() {
  const panel = document.getElementById('tracksPanel');
  const addBtn = document.getElementById('addTrackBtn');
  // Remove all track cards
  panel.querySelectorAll('.track-card').forEach(el => el.remove());

  for (const track of state.tracks) {
    const typeInfo = TRACK_TYPES[track.type];
    const isActive = track.id === state.activeTrack;

    const card = document.createElement('div');
    card.className = `track-card ${isActive ? 'active' : ''}`;
    card.dataset.id = track.id;

    let bodyHTML = '';

    // Sound selector
    bodyHTML += `<div class="section-label">Sound</div>`;
    bodyHTML += `<div class="sound-selector">`;
    for (const snd of typeInfo.sounds) {
      bodyHTML += `<div class="sound-chip ${track.sound === snd ? 'selected' : ''}"
        style="${track.sound === snd ? `background:${typeInfo.color};border-color:${typeInfo.color}` : ''}"
        data-sound="${snd}" data-track="${track.id}">${snd}</div>`;
    }
    bodyHTML += `</div>`;

    // Pattern editor
    if (track.type === 'drums') {
      bodyHTML += `<div class="section-label">Pattern (16 steps)</div>`;
      bodyHTML += `<div class="step-grid">`;
      for (let i = 0; i < 16; i++) {
        const on = track.steps[i];
        const beatMarker = i % 4 === 0 ? 'beat-marker' : '';
        bodyHTML += `<div class="step-cell ${on ? 'on' : ''} ${beatMarker}"
          style="${on ? `background:${typeInfo.color};box-shadow:0 0 8px ${typeInfo.glow}` : ''}"
          data-step="${i}" data-track="${track.id}"></div>`;
      }
      bodyHTML += `</div>`;
    } else if (track.type === 'chords') {
      bodyHTML += `<div class="section-label">Chord Sequence (16 steps)</div>`;
      bodyHTML += `<div class="step-grid">`;
      for (let i = 0; i < 16; i++) {
        const chord = track.chords[i];
        const isRest = chord === '~';
        bodyHTML += `<div class="step-cell ${!isRest ? 'on' : ''}"
          style="${!isRest ? `background:${typeInfo.color};box-shadow:0 0 8px ${typeInfo.glow};font-size:9px;display:flex;align-items:center;justify-content:center;color:#000;font-weight:700;font-family:'JetBrains Mono',monospace` : 'display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text-dim)'}"
          data-chord-step="${i}" data-track="${track.id}">${chord}</div>`;
      }
      bodyHTML += `</div>`;
    } else {
      // Piano roll style note grid
      const noteNames = ['7','6','5','4','3','2','1','0'];
      bodyHTML += `<div class="section-label">Notes (scale degrees, 16 steps)</div>`;
      bodyHTML += `<div class="piano-grid-container">`;
      bodyHTML += `<div class="piano-labels">`;
      for (const nn of noteNames) {
        bodyHTML += `<div class="note-row-label">${nn}</div>`;
      }
      bodyHTML += `</div><div class="piano-grid">`;
      for (const nn of noteNames) {
        const noteVal = parseInt(nn);
        bodyHTML += `<div class="piano-row">`;
        for (let i = 0; i < 16; i++) {
          const isOn = track.notes[i] === noteVal;
          bodyHTML += `<div class="piano-cell ${isOn ? 'on' : ''}"
            style="${isOn ? `background:${typeInfo.color};box-shadow:0 0 6px ${typeInfo.glow}` : ''}"
            data-note="${noteVal}" data-col="${i}" data-track="${track.id}"></div>`;
        }
        bodyHTML += `</div>`;
      }
      bodyHTML += `</div></div>`;
    }

    // Effects
    bodyHTML += `<div class="section-label">Effects</div>`;
    bodyHTML += renderSlider('gain', 'Volume', track.gain, 0, 1, 0.01, track.id);
    bodyHTML += renderSlider('lpf', 'Low Pass', track.lpf, 100, 20000, 100, track.id);
    bodyHTML += renderSlider('room', 'Reverb', track.room, 0, 2, 0.05, track.id);
    bodyHTML += renderSlider('delay', 'Delay', track.delay, 0, 1, 0.05, track.id);
    bodyHTML += renderSlider('pan', 'Pan', track.pan, 0, 1, 0.01, track.id);

    // Transforms
    bodyHTML += `<div class="section-label">Pattern Transforms</div>`;
    bodyHTML += `<div class="transform-chips">`;
    for (const t of TRANSFORMS) {
      const isActive = track.transforms.includes(t.id);
      bodyHTML += `<div class="transform-chip ${isActive ? 'active' : ''}"
        data-transform="${t.id}" data-track="${track.id}"
        title="${t.desc}">${t.label}</div>`;
    }
    bodyHTML += `</div>`;

    card.innerHTML = `
      <div class="track-header" data-track="${track.id}">
        <div class="track-color" style="background:${typeInfo.color}"></div>
        <div class="track-name">${track.name}</div>
        <div class="track-pattern-preview">${getPatternPreview(track)}</div>
        <div class="track-controls-row">
          <div class="track-btn ${track.muted ? 'muted' : ''}" data-action="mute" data-track="${track.id}" title="Mute">
            ${track.muted ? '🔇' : '🔊'}
          </div>
          <div class="track-btn" data-action="delete" data-track="${track.id}" title="Delete">✕</div>
        </div>
      </div>
      <div class="track-body">${bodyHTML}</div>
    `;

    panel.insertBefore(card, addBtn);
  }

  attachTrackEvents();
}

function renderSlider(param, label, value, min, max, step, trackId) {
  return `<div class="slider-row">
    <div class="slider-label">${label}</div>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${value}"
      data-param="${param}" data-track="${trackId}">
    <div class="slider-value">${typeof value === 'number' ? (value > 100 ? Math.round(value) : value.toFixed(2)) : value}</div>
  </div>`;
}

function getPatternPreview(track) {
  if (track.type === 'drums') {
    return track.steps.map(s => s ? '●' : '·').join('');
  } else if (track.type === 'chords') {
    return track.chords.filter(c => c !== '~').join(' ');
  } else {
    return track.notes.map(n => n === -1 ? '·' : n).join(' ');
  }
}

function attachTrackEvents() {
  // Track header click -> expand/collapse
  document.querySelectorAll('.track-header').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.track-btn')) return;
      const id = parseInt(el.dataset.track);
      state.activeTrack = state.activeTrack === id ? null : id;
      renderTracks();
    });
  });

  // Mute / Delete
  document.querySelectorAll('.track-btn').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt(el.dataset.track);
      if (el.dataset.action === 'mute') toggleMute(id);
      else if (el.dataset.action === 'delete') removeTrack(id);
    });
  });

  // Step cells (drums)
  document.querySelectorAll('.step-cell[data-step]').forEach(el => {
    el.addEventListener('click', () => {
      const trackId = parseInt(el.dataset.track);
      const step = parseInt(el.dataset.step);
      const track = state.tracks.find(t => t.id === trackId);
      if (track) {
        track.steps[step] = track.steps[step] ? 0 : 1;
        renderTracks();
        updateCode();
        if (state.playing) playCode();
      }
    });
  });

  // Chord cells
  document.querySelectorAll('.step-cell[data-chord-step]').forEach(el => {
    el.addEventListener('click', () => {
      const trackId = parseInt(el.dataset.track);
      const step = parseInt(el.dataset['chordStep']);
      const track = state.tracks.find(t => t.id === trackId);
      if (track) {
        const currentIdx = AVAILABLE_CHORDS.indexOf(track.chords[step]);
        track.chords[step] = AVAILABLE_CHORDS[(currentIdx + 1) % AVAILABLE_CHORDS.length];
        renderTracks();
        updateCode();
        if (state.playing) playCode();
      }
    });
  });

  // Piano cells (notes)
  document.querySelectorAll('.piano-cell').forEach(el => {
    el.addEventListener('click', () => {
      const trackId = parseInt(el.dataset.track);
      const noteVal = parseInt(el.dataset.note);
      const col = parseInt(el.dataset.col);
      const track = state.tracks.find(t => t.id === trackId);
      if (track) {
        // Toggle: if this note is already on at this column, turn it off (rest)
        if (track.notes[col] === noteVal) {
          track.notes[col] = -1;
        } else {
          track.notes[col] = noteVal;
        }
        renderTracks();
        updateCode();
        if (state.playing) playCode();
      }
    });
  });

  // Sound chips
  document.querySelectorAll('.sound-chip[data-sound]').forEach(el => {
    el.addEventListener('click', () => {
      const trackId = parseInt(el.dataset.track);
      const sound = el.dataset.sound;
      const track = state.tracks.find(t => t.id === trackId);
      if (track) {
        track.sound = sound;
        renderTracks();
        updateCode();
        if (state.playing) playCode();
      }
    });
  });

  // Sliders
  document.querySelectorAll('input[type="range"][data-param]').forEach(el => {
    el.addEventListener('input', () => {
      const trackId = parseInt(el.dataset.track);
      const param = el.dataset.param;
      const track = state.tracks.find(t => t.id === trackId);
      if (track) {
        track[param] = parseFloat(el.value);
        el.nextElementSibling.textContent = parseFloat(el.value) > 100 ? Math.round(el.value) : parseFloat(el.value).toFixed(2);
        updateCode();
      }
    });
    el.addEventListener('change', () => {
      if (state.playing) playCode();
    });
  });

  // Transform chips
  document.querySelectorAll('.transform-chip').forEach(el => {
    el.addEventListener('click', () => {
      const trackId = parseInt(el.dataset.track);
      const transformId = el.dataset.transform;
      const track = state.tracks.find(t => t.id === trackId);
      if (track) {
        const idx = track.transforms.indexOf(transformId);
        if (idx >= 0) track.transforms.splice(idx, 1);
        else track.transforms.push(transformId);
        renderTracks();
        updateCode();
        if (state.playing) playCode();
      }
    });
  });
}

function updateCode() {
  const code = generateDisplayCode();
  const codeEl = document.getElementById('codeOutput');
  // Simple syntax highlighting
  const highlighted = code
    .replace(/(".*?")/g, '<span class="string">$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>')
    .replace(/\b(cps|stack|note|sound|gain|lpf|hpf|delay|room|pan|scale|slow|fast|rev|jux|every|sometimes|degrade|voicings)\b/g, '<span class="function">$1</span>')
    .replace(/(\.s)\b/g, '<span class="function">.s</span>')
    .replace(/(\.n)\b/g, '<span class="function">.n</span>');
  codeEl.innerHTML = highlighted;
}

// ============================================================
// PRESETS
// ============================================================

const PRESETS = {
  empty: () => {
    state.tracks = [];
    trackIdCounter = 0;
    createTrack('drums');
  },
  lofi: () => {
    state.tracks = [];
    trackIdCounter = 0;
    state.bpm = 85;
    state.scale = 'C:minor';
    document.getElementById('bpm').value = 85;
    document.getElementById('globalScale').value = 'C:minor';
    const d = createTrack('drums', [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0]);
    d.room = 0.3;
    const b = createTrack('bass', [0,-1,0,-1, 3,-1,-1,-1, 0,-1,2,-1, 3,-1,-1,-1]);
    b.sound = 'triangle';
    b.lpf = 600;
    b.gain = 0.7;
    const m = createTrack('melody', [4,-1,5,-1, 7,-1,-1,5, 4,-1,2,-1, 0,-1,-1,-1]);
    m.sound = 'sine';
    m.room = 0.6;
    m.delay = 0.3;
    m.lpf = 3000;
    renderTracks();
    updateCode();
  },
  techno: () => {
    state.tracks = [];
    trackIdCounter = 0;
    state.bpm = 130;
    state.scale = 'A:minor';
    document.getElementById('bpm').value = 130;
    document.getElementById('globalScale').value = 'A:minor';
    const bd = createTrack('drums', [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]);
    bd.sound = 'bd';
    const hh = createTrack('drums', [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]);
    hh.sound = 'hh';
    hh.name = 'Hi-Hat';
    hh.gain = 0.5;
    const b = createTrack('bass', [0,-1,-1,0, -1,-1,0,-1, -1,0,-1,-1, 0,-1,-1,-1]);
    b.sound = 'sawtooth';
    b.lpf = 800;
    b.transforms = ['every4fast2'];
    renderTracks();
    updateCode();
  },
  ambient: () => {
    state.tracks = [];
    trackIdCounter = 0;
    state.bpm = 70;
    state.scale = 'D:dorian';
    document.getElementById('bpm').value = 70;
    document.getElementById('globalScale').value = 'D:dorian';
    const m = createTrack('melody', [0,-1,-1,2, -1,-1,4,-1, -1,5,-1,-1, 7,-1,-1,-1]);
    m.sound = 'sine';
    m.room = 1.5;
    m.delay = 0.5;
    m.lpf = 4000;
    m.transforms = ['juxrev', 'slow2'];
    const c = createTrack('chords', ['Dm','~','~','~', 'Am','~','~','~', 'C','~','~','~', 'G','~','~','~']);
    c.sound = 'sine';
    c.room = 1.8;
    c.gain = 0.4;
    renderTracks();
    updateCode();
  },
  funk: () => {
    state.tracks = [];
    trackIdCounter = 0;
    state.bpm = 110;
    state.scale = 'E:minor';
    document.getElementById('bpm').value = 110;
    document.getElementById('globalScale').value = 'E:minor';
    const d = createTrack('drums', [1,0,0,1, 0,0,1,0, 0,1,1,0, 0,0,1,0]);
    const b = createTrack('bass', [0,0,3,0, -1,0,2,0, 0,0,3,0, 5,-1,3,-1]);
    b.sound = 'square';
    b.lpf = 1200;
    b.gain = 0.7;
    const m = createTrack('melody', [4,5,7,-1, 5,4,-1,2, 0,-1,2,4, 5,-1,7,-1]);
    m.sound = 'sawtooth';
    m.lpf = 5000;
    m.delay = 0.15;
    m.transforms = ['juxrev'];
    renderTracks();
    updateCode();
  }
};

// ============================================================
// SHUFFLE
// ============================================================

function shuffle() {
  for (const track of state.tracks) {
    if (track.type === 'drums') {
      track.steps = Array.from({length: 16}, () => Math.random() > 0.6 ? 1 : 0);
      // Keep kick on beats
      if (track.sound === 'bd') { track.steps[0] = 1; track.steps[8] = 1; }
    } else if (track.type === 'chords') {
      const chords = ['Am','C','Dm','Em','F','G'];
      track.chords = Array.from({length: 16}, (_, i) =>
        i % 4 === 0 ? chords[Math.floor(Math.random() * chords.length)] : '~');
    } else {
      track.notes = Array.from({length: 16}, () =>
        Math.random() > 0.4 ? Math.floor(Math.random() * 8) : -1);
    }
  }
  renderTracks();
  updateCode();
  if (state.playing) playCode();
}

// ============================================================
// EVENT LISTENERS
// ============================================================

document.getElementById('playBtn').addEventListener('click', async () => {
  if (!state.playing) {
    const btn = document.getElementById('playBtn');

    if (!strudelInitialized) {
      btn.innerHTML = '⏳ Loading...';
      btn.disabled = true;
      await strudelReady;
      btn.disabled = false;
    }

    state.playing = true;
    btn.innerHTML = '■ Stop';
    btn.classList.add('playing');
    await playCode();
  } else {
    state.playing = false;
    document.getElementById('playBtn').innerHTML = '▶ Play';
    document.getElementById('playBtn').classList.remove('playing');
    stopCode();
  }
});

document.getElementById('bpm').addEventListener('change', (e) => {
  state.bpm = parseInt(e.target.value) || 120;
  updateCode();
  if (state.playing) playCode();
});

document.getElementById('globalScale').addEventListener('change', (e) => {
  state.scale = e.target.value;
  updateCode();
  if (state.playing) playCode();
});

document.getElementById('shuffleBtn').addEventListener('click', shuffle);

document.getElementById('addTrackBtn').addEventListener('click', () => {
  // Cycle through types
  const types = ['drums', 'bass', 'melody', 'chords'];
  const existingTypes = state.tracks.map(t => t.type);
  const next = types.find(t => !existingTypes.includes(t)) || types[0];
  createTrack(next);
  updateCode();
});

document.getElementById('copyCode').addEventListener('click', () => {
  const code = generateDisplayCode();
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('copyCode');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 1500);
  });
});

// Presets
document.querySelectorAll('.preset-chip').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    const preset = el.dataset.preset;
    if (PRESETS[preset]) {
      if (state.playing) {
        stopCode();
        state.playing = false;
        document.getElementById('playBtn').innerHTML = '▶ Play';
        document.getElementById('playBtn').classList.remove('playing');
      }
      PRESETS[preset]();
    }
  });
});

// ============================================================
// INIT
// ============================================================

(function boot() {
  // Start with empty preset
  PRESETS.empty();
  updateCode();

  // Engine is already initializing at top level via strudelReady promise
  document.getElementById('loading').classList.add('hidden');
  console.log('Strudel Builder UI ready. Engine initializing in background...');
})();
