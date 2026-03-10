// ============================================================
// STRUDEL BUILDER - Canvas Piano Roll Edition
// ============================================================

const TRACK_TYPES = {
  drums: {
    label: 'Drums',
    color: '#ff6b4a',
    colorDim: '#ff6b4a88',
    glow: '#ff6b4a33',
    rows: ['bd', 'sd', 'hh', 'lt', 'cp', 'rim', 'cr', 'cb'],
    defaultSound: 'bd',
    defaultEvents: [
      { row: 0, start: 0, duration: 1/16 },
      { row: 0, start: 4/16, duration: 1/16 },
      { row: 0, start: 8/16, duration: 1/16 },
      { row: 0, start: 12/16, duration: 1/16 },
    ]
  },
  bass: {
    label: 'Bass',
    color: '#4aadff',
    colorDim: '#4aadff88',
    glow: '#4aadff33',
    rows: ['7','6','5','4','3','2','1','0'],
    sounds: ['sawtooth', 'square', 'triangle', 'sine'],
    defaultSound: 'sawtooth',
    defaultEvents: [
      { row: 7, start: 0, duration: 1/16 },
      { row: 5, start: 2/16, duration: 1/16 },
      { row: 7, start: 4/16, duration: 1/16 },
      { row: 3, start: 6/16, duration: 1/16 },
      { row: 7, start: 8/16, duration: 1/16 },
      { row: 5, start: 10/16, duration: 1/16 },
      { row: 2, start: 12/16, duration: 1/16 },
      { row: 3, start: 14/16, duration: 1/16 },
    ]
  },
  melody: {
    label: 'Melody',
    color: '#b44aff',
    colorDim: '#b44aff88',
    glow: '#b44aff33',
    rows: ['7','6','5','4','3','2','1','0'],
    sounds: ['triangle', 'sine', 'square', 'sawtooth'],
    defaultSound: 'triangle',
    defaultEvents: [
      { row: 3, start: 0, duration: 1/16 },
      { row: 2, start: 2/16, duration: 1/16 },
      { row: 0, start: 3/16, duration: 1/16 },
      { row: 3, start: 5/16, duration: 1/16 },
      { row: 5, start: 7/16, duration: 1/16 },
      { row: 7, start: 8/16, duration: 1/16 },
      { row: 5, start: 11/16, duration: 1/16 },
      { row: 3, start: 12/16, duration: 1/16 },
      { row: 2, start: 14/16, duration: 1/16 },
    ]
  },
  chords: {
    label: 'Chords',
    color: '#4affb4',
    colorDim: '#4affb488',
    glow: '#4affb433',
    rows: ['G','F','Em','E','Dm','D','C','Bm','Bb','Am','A','Ab'],
    sounds: ['sine', 'triangle', 'sawtooth', 'square'],
    defaultSound: 'sine',
    defaultEvents: [
      { row: 10, start: 0, duration: 4/16 },
      { row: 6, start: 4/16, duration: 4/16 },
      { row: 6, start: 8/16, duration: 4/16 },  // C
      { row: 0, start: 12/16, duration: 4/16 },  // G
    ]
  }
};

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
const canvasInstances = {}; // trackId -> CanvasPianoRoll

// ============================================================
// STRUDEL ENGINE
// ============================================================

let strudelInitialized = false;

const strudelReady = (async () => {
  try {
    await initStrudel({
      prebake: () => samples('github:tidalcycles/dirt-samples')
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

// ============================================================
// EVENTS -> MINI NOTATION
// ============================================================

function eventsToMiniNotation(events, _trackType, rows, gridRes = 32) {
  if (events.length === 0) return '~';
  const step = 1 / gridRes;
  const slots = new Array(gridRes).fill(null);

  for (const ev of events) {
    const startSlot = Math.round(ev.start / step);
    const durSlots = Math.max(1, Math.round(ev.duration / step));
    if (startSlot >= 0 && startSlot < gridRes) {
      const rowLabel = rows[ev.row];
      slots[startSlot] = { label: rowLabel, span: durSlots };
    }
  }

  const parts = [];
  let i = 0;
  while (i < gridRes) {
    if (slots[i] !== null) {
      const { label, span } = slots[i];
      parts.push(span > 1 ? `${label}@${span}` : label);
      i += span;
    } else {
      let restCount = 0;
      while (i < gridRes && slots[i] === null) { restCount++; i++; }
      parts.push(restCount > 1 ? `~@${restCount}` : '~');
    }
  }
  return parts.join(' ');
}

function drumsEventsToMiniNotation(events, rows, gridRes = 32) {
  if (events.length === 0) return '~';
  const step = 1 / gridRes;
  const slots = new Array(gridRes).fill(null);

  for (const ev of events) {
    const startSlot = Math.round(ev.start / step);
    if (startSlot >= 0 && startSlot < gridRes) {
      // For drums, multiple sounds can stack at the same slot
      if (slots[startSlot] === null) slots[startSlot] = [];
      slots[startSlot].push(rows[ev.row]);
    }
  }

  const parts = [];
  let i = 0;
  while (i < gridRes) {
    if (slots[i] !== null) {
      const sounds = slots[i];
      if (sounds.length === 1) {
        parts.push(sounds[0]);
      } else {
        parts.push(`[${sounds.join(',')}]`);
      }
      i++;
    } else {
      let restCount = 0;
      while (i < gridRes && slots[i] === null) { restCount++; i++; }
      parts.push(restCount > 1 ? `~@${restCount}` : '~');
    }
  }
  return parts.join(' ');
}

// ============================================================
// CODE GENERATION
// ============================================================

function buildTrackCodes(forEval = false) {
  const trackCodes = [];
  const q = (str) => forEval ? `mini("${str}")` : `"${str}"`;

  for (const track of state.tracks) {
    if (track.muted) continue;
    let code = '';
    const typeInfo = TRACK_TYPES[track.type];

    if (track.type === 'drums') {
      const pattern = drumsEventsToMiniNotation(track.events, typeInfo.rows);
      code = `s(${q(pattern)})`;
    } else if (track.type === 'chords') {
      const pattern = eventsToMiniNotation(track.events, track.type, typeInfo.rows);
      code = `chord(${q('<' + pattern + '>')}).voicing()`;
      code += `.s("${track.sound}")`;
      code += `.fast(4)`;
    } else {
      const pattern = eventsToMiniNotation(track.events, track.type, typeInfo.rows);
      code = `n(${q(pattern)})`;
      code += `.scale("${state.scale}")`;
      code += `.s("${track.sound}")`;
      if (track.type === 'bass') code += `.slow(2)`;
    }

    if (track.gain !== undefined && track.gain !== 0.8) code += `.gain(${track.gain.toFixed(2)})`;
    if (track.lpf && track.lpf < 20000) code += `.lpf(${track.lpf})`;
    if (track.hpf && track.hpf > 20) code += `.hpf(${track.hpf})`;
    if (track.delay && track.delay > 0) code += `.delay(${track.delay.toFixed(2)})`;
    if (track.room && track.room > 0) code += `.room(${track.room.toFixed(2)})`;
    if (track.pan !== undefined && track.pan !== 0.5) code += `.pan(${track.pan.toFixed(2)})`;

    for (const t of (track.transforms || [])) {
      const transform = TRANSFORMS.find(tr => tr.id === t);
      if (transform) code += `.${transform.label}`;
    }

    trackCodes.push(code);
  }
  return trackCodes;
}

function generateDisplayCode() {
  if (state.tracks.length === 0) return '// Add tracks to start making music!';
  const trackCodes = buildTrackCodes();
  if (trackCodes.length === 0) return '// All tracks are muted';
  const cps = (state.bpm / 60 / 4).toFixed(3);

  if (trackCodes.length === 1) {
    return trackCodes[0] + `.cps(${cps})`;
  }
  const lines = ['stack('];
  trackCodes.forEach((c, i) => {
    lines.push('  ' + c + (i < trackCodes.length - 1 ? ',' : ''));
  });
  lines.push(`).cps(${cps})`);
  return lines.join('\n');
}

// ============================================================
// PLAYBACK
// ============================================================

async function playCode() {
  if (!strudelInitialized) {
    await strudelReady;
    if (!strudelInitialized) return;
  }

  const trackCodes = buildTrackCodes(true);
  if (trackCodes.length === 0) {
    try { hush(); } catch(e) {}
    return;
  }

  const cps = (state.bpm / 60 / 4).toFixed(3);
  let patternExpr;
  if (trackCodes.length === 1) {
    patternExpr = trackCodes[0];
  } else {
    patternExpr = `stack(\n${trackCodes.map(c => '  ' + c).join(',\n')}\n)`;
  }

  try {
    const pattern = (0, eval)(patternExpr + `.cps(${cps})`);
    pattern.play();
  } catch(e) {
    console.error('Play error:', e);
  }
}

function stopCode() {
  try { hush(); } catch(e) {}
}

// ============================================================
// CANVAS PIANO ROLL
// ============================================================

class CanvasPianoRoll {
  constructor(canvas, track) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.track = track;
    this.typeInfo = TRACK_TYPES[track.type];

    // View
    this.zoom = 1.0;
    this.scrollX = 0;
    this.gridRes = 16;

    // Layout
    this.labelWidth = 40;
    this.rowHeight = track.type === 'drums' ? 28 : 24;
    this.rows = this.typeInfo.rows;
    this.numRows = this.rows.length;

    // Interaction
    this.dragging = null;
    this.hoverInfo = null;

    // Chord picker
    this.chordPicker = null;

    this._resize();
    this._bindEvents();
    this.draw();
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = this.numRows * this.rowHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = w;
    this.height = h;
  }

  get gridWidth() { return this.width - this.labelWidth; }
  get visibleDuration() { return 1.0 / this.zoom; }

  timeToX(t) {
    return this.labelWidth + ((t - this.scrollX) / this.visibleDuration) * this.gridWidth;
  }
  xToTime(x) {
    return this.scrollX + ((x - this.labelWidth) / this.gridWidth) * this.visibleDuration;
  }
  yToRow(y) {
    return Math.floor(y / this.rowHeight);
  }
  snap(t) {
    const step = 1.0 / (this.gridRes * this.zoom);
    // Snap to the visible grid resolution, scaled by zoom
    const actualStep = 1.0 / this.gridRes;
    return Math.round(t / actualStep) * actualStep;
  }

  // Hit test: find event at (x, y), return { index, edge: null|'left'|'right' }
  hitTest(x, y) {
    const t = this.xToTime(x);
    const row = this.yToRow(y);
    const edgeThresh = 6; // pixels

    for (let i = 0; i < this.track.events.length; i++) {
      const ev = this.track.events[i];
      if (ev.row !== row) continue;
      const ex1 = this.timeToX(ev.start);
      const ex2 = this.timeToX(ev.start + ev.duration);
      if (x >= ex1 - 2 && x <= ex2 + 2) {
        let edge = null;
        if (Math.abs(x - ex1) < edgeThresh) edge = 'left';
        else if (Math.abs(x - ex2) < edgeThresh) edge = 'right';
        return { index: i, edge };
      }
    }
    return null;
  }

  _overlaps(start, duration, row, excludeIndex = -1) {
    const end = start + duration;
    for (let i = 0; i < this.track.events.length; i++) {
      if (i === excludeIndex) continue;
      const ev = this.track.events[i];
      if (ev.row !== row) continue;
      if (start < ev.start + ev.duration && end > ev.start) return true;
    }
    return false;
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => this._onMouseLeave());
    this.canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); });
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    this.canvas.addEventListener('dblclick', (e) => this._onDblClick(e));
  }

  _getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _onMouseDown(e) {
    if (this.chordPicker) { this._closeChordPicker(); return; }
    const { x, y } = this._getPos(e);
    if (x < this.labelWidth) return;

    const hit = this.hitTest(x, y);

    if (e.button === 2) {
      // Right click: delete
      if (hit) {
        this.track.events.splice(hit.index, 1);
        this._onChange();
      }
      return;
    }

    if (hit) {
      if (hit.edge === 'left') {
        this.dragging = { type: 'resize-left', index: hit.index, origStart: this.track.events[hit.index].start, origDur: this.track.events[hit.index].duration };
      } else if (hit.edge === 'right') {
        this.dragging = { type: 'resize-right', index: hit.index, origStart: this.track.events[hit.index].start, origDur: this.track.events[hit.index].duration };
      } else {
        const ev = this.track.events[hit.index];
        this.dragging = { type: 'move', index: hit.index, offsetT: this.xToTime(x) - ev.start, origRow: ev.row };
      }
    } else {
      // Create new event
      const row = this.yToRow(y);
      if (row < 0 || row >= this.numRows) return;
      const t = this.snap(this.xToTime(x));
      const dur = 1 / this.gridRes;
      if (t >= 0 && t < 1 && !this._overlaps(t, dur, row)) {
        const newEv = { row, start: t, duration: dur };
        this.track.events.push(newEv);
        const idx = this.track.events.length - 1;
        this.dragging = { type: 'draw', index: idx, anchorTime: t };
        this._onChange();
      }
    }
  }

  _onMouseMove(e) {
    const { x, y } = this._getPos(e);

    if (this.dragging) {
      const ev = this.track.events[this.dragging.index];
      if (!ev) { this.dragging = null; return; }
      const t = this.snap(this.xToTime(x));

      if (this.dragging.type === 'draw') {
        const anchor = this.dragging.anchorTime;
        const newStart = Math.max(0, Math.min(anchor, t));
        const newEnd = Math.min(1, Math.max(anchor + 1/this.gridRes, t + 1/this.gridRes));
        if (!this._overlaps(newStart, newEnd - newStart, ev.row, this.dragging.index)) {
          ev.start = newStart;
          ev.duration = newEnd - newStart;
        }
      } else if (this.dragging.type === 'resize-right') {
        const minDur = 1 / this.gridRes;
        const newEnd = Math.min(1, Math.max(ev.start + minDur, this.snap(this.xToTime(x))));
        const newDur = newEnd - ev.start;
        if (!this._overlaps(ev.start, newDur, ev.row, this.dragging.index)) {
          ev.duration = newDur;
        }
      } else if (this.dragging.type === 'resize-left') {
        const minDur = 1 / this.gridRes;
        const origEnd = this.dragging.origStart + this.dragging.origDur;
        const newStart = Math.max(0, Math.min(origEnd - minDur, this.snap(this.xToTime(x))));
        const newDur = origEnd - newStart;
        if (!this._overlaps(newStart, newDur, ev.row, this.dragging.index)) {
          ev.start = newStart;
          ev.duration = newDur;
        }
      } else if (this.dragging.type === 'move') {
        const newT = this.snap(Math.max(0, Math.min(1 - ev.duration, this.xToTime(x) - this.dragging.offsetT)));
        const newRow = Math.max(0, Math.min(this.numRows - 1, this.yToRow(y)));
        if (!this._overlaps(newT, ev.duration, newRow, this.dragging.index)) {
          ev.start = newT;
          ev.row = newRow;
        }
      }
      this.draw();
      return;
    }

    // Hover cursor
    if (x < this.labelWidth) {
      this.canvas.style.cursor = 'default';
      this.hoverInfo = null;
      this.draw();
      return;
    }
    const hit = this.hitTest(x, y);
    if (hit) {
      if (hit.edge) this.canvas.style.cursor = 'col-resize';
      else this.canvas.style.cursor = 'grab';
      this.hoverInfo = hit;
    } else {
      this.canvas.style.cursor = 'crosshair';
      this.hoverInfo = { row: this.yToRow(y), time: this.snap(this.xToTime(x)) };
    }
    this.draw();
  }

  _onMouseUp() {
    if (this.dragging) {
      this.dragging = null;
      this._onChange();
    }
  }

  _onMouseLeave() {
    this.hoverInfo = null;
    this.dragging = null;
    this.draw();
  }

  _onDblClick(e) {
    const { x, y } = this._getPos(e);
    const hit = this.hitTest(x, y);
    if (hit && this.track.type === 'chords') {
      this._openChordPicker(hit.index, e.clientX, e.clientY);
    } else if (hit) {
      this.track.events.splice(hit.index, 1);
      this._onChange();
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const { x } = this._getPos(e);
    const tAtCursor = this.xToTime(x);

    if (e.ctrlKey || !e.shiftKey) {
      // Zoom
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(1, Math.min(16, this.zoom * factor));
      this.zoom = newZoom;
      // Keep cursor position stable
      this.scrollX = tAtCursor - ((x - this.labelWidth) / this.gridWidth) * this.visibleDuration;
    } else {
      // Scroll
      this.scrollX += e.deltaY * 0.001;
    }
    this.scrollX = Math.max(0, Math.min(1 - this.visibleDuration, this.scrollX));
    this.draw();
  }

  _openChordPicker(eventIndex, clientX, clientY) {
    this._closeChordPicker();
    const ev = this.track.events[eventIndex];
    const picker = document.createElement('div');
    picker.className = 'chord-picker';
    picker.style.left = clientX + 'px';
    picker.style.top = clientY + 'px';
    for (const chord of this.rows) {
      const chip = document.createElement('div');
      chip.className = 'chord-picker-item' + (chord === this.rows[ev.row] ? ' active' : '');
      chip.textContent = chord;
      chip.addEventListener('click', () => {
        ev.row = this.rows.indexOf(chord);
        this._closeChordPicker();
        this._onChange();
      });
      picker.appendChild(chip);
    }
    document.body.appendChild(picker);
    this.chordPicker = picker;
  }

  _closeChordPicker() {
    if (this.chordPicker) {
      this.chordPicker.remove();
      this.chordPicker = null;
    }
  }

  _onChange() {
    updateCode();
    if (state.playing) playCode();
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#12121a';
    ctx.fillRect(0, 0, w, h);

    // Row backgrounds (alternating)
    for (let r = 0; r < this.numRows; r++) {
      const y = r * this.rowHeight;
      ctx.fillStyle = r % 2 === 0 ? '#15151f' : '#12121a';
      ctx.fillRect(this.labelWidth, y, this.gridWidth, this.rowHeight);
    }

    // Row labels
    ctx.fillStyle = '#555568';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < this.numRows; r++) {
      const y = r * this.rowHeight + this.rowHeight / 2;
      ctx.fillText(this.rows[r], this.labelWidth - 6, y);
    }

    // Grid lines (vertical)
    const stepSize = 1 / this.gridRes;
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= this.gridRes; i++) {
      const t = i * stepSize;
      if (t < this.scrollX - stepSize || t > this.scrollX + this.visibleDuration + stepSize) continue;
      const x = this.timeToX(t);
      if (x < this.labelWidth || x > w) continue;
      // Beat markers
      if (i % (this.gridRes / 4) === 0) {
        ctx.strokeStyle = '#2e2e44';
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = '#1e1e2e';
        ctx.lineWidth = 0.5;
      }
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Row dividers
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= this.numRows; r++) {
      const y = r * this.rowHeight;
      ctx.beginPath();
      ctx.moveTo(this.labelWidth, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Events
    for (let i = 0; i < this.track.events.length; i++) {
      const ev = this.track.events[i];
      const x1 = this.timeToX(ev.start);
      const x2 = this.timeToX(ev.start + ev.duration);
      const y = ev.row * this.rowHeight + 2;
      const ew = Math.max(4, x2 - x1 - 1);
      const eh = this.rowHeight - 4;

      if (x1 > w || x2 < this.labelWidth) continue;

      // Glow
      ctx.shadowColor = this.typeInfo.glow;
      ctx.shadowBlur = 8;

      // Fill
      const isHovered = this.hoverInfo && this.hoverInfo.index === i;
      ctx.fillStyle = isHovered ? this.typeInfo.color : this.typeInfo.colorDim;
      ctx.beginPath();
      const rad = 3;
      ctx.roundRect(x1, y, ew, eh, rad);
      ctx.fill();

      ctx.shadowBlur = 0;

      // Border
      ctx.strokeStyle = this.typeInfo.color;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label inside event (for chords or long enough notes)
      if (ew > 20) {
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.rows[ev.row], x1 + ew / 2, y + eh / 2);
      }
    }

    // Hover ghost (when not hovering an existing event)
    if (this.hoverInfo && this.hoverInfo.index === undefined && !this.dragging) {
      if (this.hoverInfo.row >= 0 && this.hoverInfo.row < this.numRows && this.hoverInfo.time >= 0 && this.hoverInfo.time < 1) {
        const gx = this.timeToX(this.hoverInfo.time);
        const gy = this.hoverInfo.row * this.rowHeight + 2;
        const gw = Math.max(4, this.timeToX(this.hoverInfo.time + 1/this.gridRes) - gx - 1);
        ctx.fillStyle = this.typeInfo.color + '33';
        ctx.beginPath();
        ctx.roundRect(gx, gy, gw, this.rowHeight - 4, 3);
        ctx.fill();
      }
    }

    // Label area separator
    ctx.fillStyle = '#1a1a26';
    ctx.fillRect(0, 0, this.labelWidth, h);
    // Redraw labels on top
    ctx.fillStyle = '#555568';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < this.numRows; r++) {
      const y = r * this.rowHeight + this.rowHeight / 2;
      ctx.fillText(this.rows[r], this.labelWidth - 6, y);
    }

    // Zoom indicator
    if (this.zoom > 1) {
      ctx.fillStyle = '#555568';
      ctx.font = '10px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${this.zoom.toFixed(1)}x`, this.labelWidth + 4, 4);

      // Scrollbar
      const barY = h - 4;
      const barW = this.gridWidth;
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(this.labelWidth, barY, barW, 3);
      const thumbW = barW * this.visibleDuration;
      const thumbX = this.labelWidth + (this.scrollX / (1 - this.visibleDuration + 0.001)) * (barW - thumbW);
      ctx.fillStyle = '#4a4a6a';
      ctx.fillRect(thumbX, barY, thumbW, 3);
    }
  }

  destroy() {
    this._closeChordPicker();
  }
}

// ============================================================
// TRACK MANAGEMENT
// ============================================================

function createTrack(type, eventsPreset = null) {
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
    events: eventsPreset ? eventsPreset.map(e => ({...e})) : typeInfo.defaultEvents.map(e => ({...e})),
  };

  state.tracks.push(track);
  state.activeTrack = id;
  renderTracks();
  updateCode();
  return track;
}

// Convert legacy 16-step array to events
function stepsToEvents(steps, sound) {
  const events = [];
  const rows = TRACK_TYPES.drums.rows;
  const rowIdx = rows.indexOf(sound || 'bd');
  for (let i = 0; i < steps.length; i++) {
    if (steps[i]) {
      events.push({ row: rowIdx >= 0 ? rowIdx : 0, start: i/16, duration: 1/16 });
    }
  }
  return events;
}

function notesToEvents(notes, type) {
  const events = [];
  const rows = TRACK_TYPES[type].rows;
  for (let i = 0; i < notes.length; i++) {
    if (notes[i] !== -1) {
      const rowIdx = rows.indexOf(String(notes[i]));
      events.push({ row: rowIdx >= 0 ? rowIdx : 0, start: i/16, duration: 1/16 });
    }
  }
  return events;
}

function chordsToEvents(chords) {
  const events = [];
  const rows = TRACK_TYPES.chords.rows;
  let i = 0;
  while (i < chords.length) {
    if (chords[i] !== '~') {
      const chord = chords[i];
      const rowIdx = rows.indexOf(chord);
      let dur = 1;
      while (i + dur < chords.length && chords[i + dur] === '~') dur++;
      events.push({ row: rowIdx >= 0 ? rowIdx : 0, start: i/16, duration: dur/16 });
      i += dur;
    } else {
      i++;
    }
  }
  return events;
}

function removeTrack(id) {
  if (canvasInstances[id]) { canvasInstances[id].destroy(); delete canvasInstances[id]; }
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
  panel.querySelectorAll('.track-card').forEach(el => el.remove());

  // Clean up old canvas instances
  for (const id of Object.keys(canvasInstances)) {
    if (!state.tracks.find(t => t.id === parseInt(id))) {
      canvasInstances[id].destroy();
      delete canvasInstances[id];
    }
  }

  for (const track of state.tracks) {
    const typeInfo = TRACK_TYPES[track.type];
    const isActive = track.id === state.activeTrack;

    const card = document.createElement('div');
    card.className = `track-card ${isActive ? 'active' : ''}`;
    card.dataset.id = track.id;

    let bodyHTML = '';

    // Sound selector (not for drums - drums use rows)
    if (track.type !== 'drums') {
      bodyHTML += `<div class="section-label">Sound</div>`;
      bodyHTML += `<div class="sound-selector">`;
      for (const snd of typeInfo.sounds || []) {
        bodyHTML += `<div class="sound-chip ${track.sound === snd ? 'selected' : ''}"
          style="${track.sound === snd ? `background:${typeInfo.color};border-color:${typeInfo.color}` : ''}"
          data-sound="${snd}" data-track="${track.id}">${snd}</div>`;
      }
      bodyHTML += `</div>`;
    }

    // Canvas container
    const gridLabel = track.type === 'drums' ? 'Drum Pattern' : track.type === 'chords' ? 'Chord Sequence' : 'Notes (scale degrees)';
    bodyHTML += `<div class="section-label">${gridLabel} <span class="canvas-hint">click: draw | drag edges: resize | drag: move | right-click: delete | scroll: zoom</span></div>`;
    bodyHTML += `<div class="canvas-container" id="canvas-wrap-${track.id}"><canvas id="canvas-${track.id}"></canvas></div>`;

    // Grid resolution selector
    bodyHTML += `<div class="grid-res-row">`;
    bodyHTML += `<span class="section-label" style="margin:0">Grid</span>`;
    for (const res of [4, 8, 16, 32]) {
      const active = (canvasInstances[track.id]?.gridRes || 16) === res;
      bodyHTML += `<div class="grid-res-chip ${active ? 'active' : ''}" data-res="${res}" data-track="${track.id}">1/${res}</div>`;
    }
    bodyHTML += `</div>`;

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
      const isOn = track.transforms.includes(t.id);
      bodyHTML += `<div class="transform-chip ${isOn ? 'active' : ''}"
        data-transform="${t.id}" data-track="${track.id}"
        title="${t.desc}">${t.label}</div>`;
    }
    bodyHTML += `</div>`;

    card.innerHTML = `
      <div class="track-header" data-track="${track.id}">
        <div class="track-color" style="background:${typeInfo.color}"></div>
        <div class="track-name">${track.name}</div>
        <div class="track-event-count">${track.events.length} events</div>
        <div class="track-controls-row">
          <div class="track-btn ${track.muted ? 'muted' : ''}" data-action="mute" data-track="${track.id}" title="Mute">
            ${track.muted ? '\u{1F507}' : '\u{1F50A}'}
          </div>
          <div class="track-btn" data-action="delete" data-track="${track.id}" title="Delete">\u2715</div>
        </div>
      </div>
      <div class="track-body">${bodyHTML}</div>
    `;

    panel.insertBefore(card, addBtn);

    // Initialize canvas after DOM insertion
    if (isActive) {
      requestAnimationFrame(() => {
        const canvasEl = document.getElementById(`canvas-${track.id}`);
        if (canvasEl) {
          if (canvasInstances[track.id]) {
            canvasInstances[track.id].canvas = canvasEl;
            canvasInstances[track.id].ctx = canvasEl.getContext('2d');
            canvasInstances[track.id].track = track;
            canvasInstances[track.id]._resize();
            canvasInstances[track.id]._bindEvents();
            canvasInstances[track.id].draw();
          } else {
            canvasInstances[track.id] = new CanvasPianoRoll(canvasEl, track);
          }
        }
      });
    }
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

  // Grid resolution chips
  document.querySelectorAll('.grid-res-chip').forEach(el => {
    el.addEventListener('click', () => {
      const trackId = parseInt(el.dataset.track);
      const res = parseInt(el.dataset.res);
      if (canvasInstances[trackId]) {
        canvasInstances[trackId].gridRes = res;
        canvasInstances[trackId].draw();
      }
      // Update active state visually
      el.parentElement.querySelectorAll('.grid-res-chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
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
    const d = createTrack('drums', stepsToEvents([1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0], 'bd'));
    d.room = 0.3;
    const b = createTrack('bass', notesToEvents([0,-1,0,-1, 3,-1,-1,-1, 0,-1,2,-1, 3,-1,-1,-1], 'bass'));
    b.sound = 'triangle';
    b.lpf = 600;
    b.gain = 0.7;
    const m = createTrack('melody', notesToEvents([4,-1,5,-1, 7,-1,-1,5, 4,-1,2,-1, 0,-1,-1,-1], 'melody'));
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
    const bd = createTrack('drums', stepsToEvents([1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], 'bd'));
    bd.sound = 'bd';
    // Add hi-hat events to the same track on a different row
    const hhRow = TRACK_TYPES.drums.rows.indexOf('hh');
    for (let i = 0; i < 16; i++) {
      if ([2,6,10,14].includes(i)) {
        bd.events.push({ row: hhRow, start: i/16, duration: 1/16 });
      }
    }
    const b = createTrack('bass', notesToEvents([0,-1,-1,0, -1,-1,0,-1, -1,0,-1,-1, 0,-1,-1,-1], 'bass'));
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
    const m = createTrack('melody', notesToEvents([0,-1,-1,2, -1,-1,4,-1, -1,5,-1,-1, 7,-1,-1,-1], 'melody'));
    m.sound = 'sine';
    m.room = 1.5;
    m.delay = 0.5;
    m.lpf = 4000;
    m.transforms = ['juxrev', 'slow2'];
    const c = createTrack('chords', chordsToEvents(['Dm','~','~','~', 'Am','~','~','~', 'C','~','~','~', 'G','~','~','~']));
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
    const d = createTrack('drums', stepsToEvents([1,0,0,1, 0,0,1,0, 0,1,1,0, 0,0,1,0], 'bd'));
    const b = createTrack('bass', notesToEvents([0,0,3,0, -1,0,2,0, 0,0,3,0, 5,-1,3,-1], 'bass'));
    b.sound = 'square';
    b.lpf = 1200;
    b.gain = 0.7;
    const m = createTrack('melody', notesToEvents([4,5,7,-1, 5,4,-1,2, 0,-1,2,4, 5,-1,7,-1], 'melody'));
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
    track.events = [];

    if (track.type === 'drums') {
      for (let i = 0; i < 16; i++) {
        if (Math.random() > 0.6) {
          const row = Math.floor(Math.random() * 4); // bd, sd, hh, oh
          track.events.push({ row, start: i/16, duration: 1/16 });
        }
      }
      // Ensure kick on downbeats
      if (!track.events.find(e => e.row === 0 && e.start === 0)) {
        track.events.push({ row: 0, start: 0, duration: 1/16 });
      }
      if (!track.events.find(e => e.row === 0 && e.start === 0.5)) {
        track.events.push({ row: 0, start: 0.5, duration: 1/16 });
      }
    } else if (track.type === 'chords') {
      const chordRows = [10, 6, 4, 2, 0]; // Am, C, Dm, E, G
      for (let i = 0; i < 4; i++) {
        const row = chordRows[Math.floor(Math.random() * chordRows.length)];
        track.events.push({ row, start: i * 0.25, duration: 0.25 });
      }
    } else {
      for (let i = 0; i < 16; i++) {
        if (Math.random() > 0.4) {
          const row = Math.floor(Math.random() * 8);
          track.events.push({ row, start: i/16, duration: 1/16 });
        }
      }
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
      btn.innerHTML = '\u23F3 Loading...';
      btn.disabled = true;
      await strudelReady;
      btn.disabled = false;
    }
    state.playing = true;
    btn.innerHTML = '\u25A0 Stop';
    btn.classList.add('playing');
    await playCode();
  } else {
    state.playing = false;
    document.getElementById('playBtn').innerHTML = '\u25B6 Play';
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

document.querySelectorAll('.preset-chip').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    const preset = el.dataset.preset;
    if (PRESETS[preset]) {
      if (state.playing) {
        stopCode();
        state.playing = false;
        document.getElementById('playBtn').innerHTML = '\u25B6 Play';
        document.getElementById('playBtn').classList.remove('playing');
      }
      PRESETS[preset]();
    }
  });
});

// Window resize: update canvases
window.addEventListener('resize', () => {
  for (const id of Object.keys(canvasInstances)) {
    const inst = canvasInstances[id];
    if (inst.canvas.parentElement) {
      inst._resize();
      inst.draw();
    }
  }
});

// ============================================================
// INIT
// ============================================================

(function boot() {
  PRESETS.empty();
  updateCode();
  document.getElementById('loading').classList.add('hidden');
  console.log('Strudel Builder UI ready. Engine initializing in background...');
})();
