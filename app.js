/**
 * RETRO ARCADE HUB - Core Controller (Enhanced Edition)
 * Controls game cabinet Canvas loops, HUD, Audio synth, and custom boot animations.
 */

// --- CONFIGURATION ---
const GITHUB_USERNAME = "kenken6291";

const GAMES = {
  invaders: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/neon-invaders/`,
    codeUrl: `https://github.com/${GITHUB_USERNAME}/neon-invaders`
  },
  tetris: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/neon-tetris/`,
    codeUrl: `https://github.com/${GITHUB_USERNAME}/neon-tetris`
  },
  headon: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/head-on-neon/`,
    codeUrl: `https://github.com/${GITHUB_USERNAME}/head-on-neon`
  },
  pacman: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/pacman-game/`,
    codeUrl: `https://github.com/${GITHUB_USERNAME}/pacman-game`
  },
  mahjong: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/mahjong-premium/`,
    codeUrl: `https://github.com/${GITHUB_USERNAME}/mahjong-premium`
  },
  gomoku: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/gomoku-premium/`,
    codeUrl: `https://github.com/${GITHUB_USERNAME}/gomoku-premium`
  },
  reversi: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/reversi-premium/`,
    codeUrl: `https://github.com/${GITHUB_USERNAME}/reversi-premium`
  },
  blokus: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/blokus-premium/`,
    codeUrl: `https://github.com/${GITHUB_USERNAME}/blokus-premium`
  },
  shogi: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/shogi-premium/`,
    codeUrl: `https://github.com/${GITHUB_USERNAME}/shogi-premium`
  },
  gunjin: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/gunjin-shogi-premium/`,
    codeUrl: `https://github.com/${GITHUB_USERNAME}/gunjin-shogi-premium`
  }
};

// --- STATE MANAGEMENT ---
let credits = 0;
let audioContext = null;
let masterGain = null;
let isBgmPlaying = false;
let isMuted = false;
let nextNoteTime = 0.0;
let currentNoteIndex = 0;
let schedulerTimer = null;
let demoAnimationIds = {}; // Stores requestAnimationFrame IDs

// --- WEB AUDIO API ENGINE ---

function initAudio() {
  if (audioContext) return;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.15; // default master volume
  masterGain.connect(audioContext.destination);
}

// 8-bit Sound Effects Synthesizer

// 1. Coin Insert (High pitch double tone chime)
function playCoinSE() {
  initAudio();
  if (audioContext.state === 'suspended') audioContext.resume();
  if (isMuted) return;

  const now = audioContext.currentTime;
  
  const osc1 = audioContext.createOscillator();
  const gain1 = audioContext.createGain();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(987.77, now); // B5
  gain1.gain.setValueAtTime(0.08, now);
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
  osc1.connect(gain1);
  gain1.connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.08);

  const osc2 = audioContext.createOscillator();
  const gain2 = audioContext.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(1318.51, now + 0.08); // E6
  gain2.gain.setValueAtTime(0.08, now + 0.08);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc2.connect(gain2);
  gain2.connect(masterGain);
  osc2.start(now + 0.08);
  osc2.stop(now + 0.3);
}

// 2. Button / Hover blip
function playHoverSE() {
  initAudio();
  if (audioContext.state === 'suspended') audioContext.resume();
  if (isMuted) return;

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(500, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);
  
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  
  osc.connect(gain);
  gain.connect(masterGain);
  
  osc.start(now);
  osc.stop(now + 0.06);
}

// 3. Error Buzzer
function playErrorSE() {
  initAudio();
  if (audioContext.state === 'suspended') audioContext.resume();
  if (isMuted) return;

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(130, now); // C3
  osc.frequency.linearRampToValueAtTime(90, now + 0.2);
  
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
  
  osc.connect(gain);
  gain.connect(masterGain);
  
  osc.start(now);
  osc.stop(now + 0.2);
}

// 4. Game Startup Fanfare (Web Audio sequence)
function playStartSE(callback) {
  initAudio();
  if (audioContext.state === 'suspended') audioContext.resume();
  if (isMuted) {
    if (callback) setTimeout(callback, 600);
    return;
  }

  const now = audioContext.currentTime;
  const tempo = 0.08;
  const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, G5, C6, E6
  
  notes.forEach((freq, idx) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + idx * tempo);
    
    // final note ring longer
    const duration = idx === notes.length - 1 ? 0.4 : 0.15;
    
    gain.gain.setValueAtTime(0.06, now + idx * tempo);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * tempo + duration);
    
    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.start(now + idx * tempo);
    osc.stop(now + idx * tempo + duration);
  });

  if (callback) {
    setTimeout(callback, (notes.length * tempo + 0.4) * 1000);
  }
}

// 5. Analog TV Static Noise (White Noise)
function playStaticNoiseSE(duration) {
  initAudio();
  if (audioContext.state === 'suspended') audioContext.resume();
  if (isMuted) return null;

  const bufferSize = audioContext.sampleRate * duration;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  
  // Fill buffer with random noise
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noiseSource = audioContext.createBufferSource();
  noiseSource.buffer = buffer;
  
  // Create static band-pass filter to sound like analog interference
  const filter = audioContext.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1000, audioContext.currentTime);
  filter.Q.setValueAtTime(0.8, audioContext.currentTime);
  
  // Gain nodes
  const noiseGain = audioContext.createGain();
  noiseGain.gain.setValueAtTime(0.12, audioContext.currentTime);
  noiseGain.gain.linearRampToValueAtTime(0.001, audioContext.currentTime + duration);
  
  noiseSource.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(masterGain);
  
  noiseSource.start();
  return noiseSource;
}

// --- 8-BIT BGM SEQUENCER ---
const NOTE_FREQS = {
  "C3": 130.81, "D3": 146.83, "E3": 164.81, "F3": 174.61, "G3": 196.00, "A3": 220.00, "B3": 246.94,
  "C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23, "G4": 392.00, "A4": 440.00, "B4": 493.88,
  "C5": 523.25, "D5": 587.33, "E5": 659.25, "F5": 698.46, "G5": 783.99, "A5": 880.00
};

// Synthwave 8-bit score loops
const BGM_MELODY = [
  "A4", null, "C5", "D5", "E5", null, "G5", "E5",
  "A5", "G5", "E5", "D5", "C5", "A4", "C5", "D5",
  "E5", null, "D5", "C5", "D5", null, "C5", "A4",
  "G4", "A4", "C5", "E4", "G4", null, null, null
];

const BGM_BASS = [
  "A3", "A3", "C3", "C3", "D3", "D3", "E3", "G3",
  "A3", "A3", "C3", "C3", "D3", "D3", "E3", "G3",
  "A3", "A3", "C3", "C3", "D3", "D3", "E3", "G3",
  "E3", "E3", "D3", "D3", "C3", "C3", "B3", "G3"
];

const STEP_DURATION = 0.15; // Step duration (16th note at ~100bpm)

function scheduleNote(stepIndex, time) {
  if (isMuted) return;

  const oscMelody = audioContext.createOscillator();
  const gainMelody = audioContext.createGain();
  
  const oscBass = audioContext.createOscillator();
  const gainBass = audioContext.createGain();

  // Play Bass Node
  const bassNote = BGM_BASS[stepIndex];
  if (bassNote && NOTE_FREQS[bassNote]) {
    oscBass.type = 'triangle';
    oscBass.frequency.setValueAtTime(NOTE_FREQS[bassNote], time);
    
    gainBass.gain.setValueAtTime(0.12, time);
    gainBass.gain.exponentialRampToValueAtTime(0.01, time + STEP_DURATION - 0.02);
    
    oscBass.connect(gainBass);
    gainBass.connect(masterGain);
    
    oscBass.start(time);
    oscBass.stop(time + STEP_DURATION);
  }

  // Play Melody Node
  const melodyNote = BGM_MELODY[stepIndex];
  if (melodyNote && NOTE_FREQS[melodyNote]) {
    oscMelody.type = 'square';
    oscMelody.frequency.setValueAtTime(NOTE_FREQS[melodyNote], time);
    
    gainMelody.gain.setValueAtTime(0.05, time);
    gainMelody.gain.exponentialRampToValueAtTime(0.001, time + STEP_DURATION - 0.02);
    
    oscMelody.connect(gainMelody);
    gainMelody.connect(masterGain);
    
    oscMelody.start(time);
    oscMelody.stop(time + STEP_DURATION);
  }
}

function audioScheduler() {
  while (nextNoteTime < audioContext.currentTime + 0.1) {
    scheduleNote(currentNoteIndex, nextNoteTime);
    nextNoteTime += STEP_DURATION;
    currentNoteIndex = (currentNoteIndex + 1) % 32;
  }
  schedulerTimer = setTimeout(audioScheduler, 25.0);
}

function startBGM() {
  initAudio();
  if (audioContext.state === 'suspended') audioContext.resume();
  
  if (isBgmPlaying) return;
  
  nextNoteTime = audioContext.currentTime + 0.05;
  currentNoteIndex = 0;
  isBgmPlaying = true;
  audioScheduler();
}

function stopBGM() {
  if (!isBgmPlaying) return;
  clearTimeout(schedulerTimer);
  isBgmPlaying = false;
}

// --- DYNAMIC STARFIELD BACKGROUND ---
class Star {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.reset();
    this.y = Math.random() * this.canvasHeight;
  }

  reset() {
    this.x = Math.random() * this.canvasWidth;
    this.y = -10;
    this.size = Math.random() * 2 + 1;
    this.speed = Math.random() * 1.5 + 0.5;
    const colors = ['#ffffff', '#00f3ff', '#ff007f', '#39ff14', '#ffe600'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    this.y += this.speed;
    if (this.y > this.canvasHeight) {
      this.reset();
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}

function setupStarfield() {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  let stars = [];
  const starCount = 60;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = [];
    for (let i = 0; i < starCount; i++) {
      stars.push(new Star(canvas.width, canvas.height));
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function animate() {
    ctx.fillStyle = "rgba(5, 5, 11, 0.25)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach(star => {
      star.update();
      star.draw(ctx);
    });

    requestAnimationFrame(animate);
  }

  animate();
}

// --- INTERACTIVE CABINET DEMA ANIMATIONS (CANVAS) ---

// Helper to draw pixel fonts onto demo screens
function drawPixelText(ctx, text, x, y, color = '#fff') {
  ctx.fillStyle = color;
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillText(text, x, y);
}

// 1. Space Invaders Demo
function initInvadersDemo(canvas) {
  const ctx = canvas.getContext('2d');
  let invaderX = 10;
  let invaderDir = 1;
  let shipX = 50;
  let shipDir = 1;
  let bullet = null;
  let score = 0;
  let aliens = [
    {x: 20, y: 35, alive: true}, {x: 40, y: 35, alive: true}, 
    {x: 60, y: 35, alive: true}, {x: 80, y: 35, alive: true},
    {x: 30, y: 55, alive: true}, {x: 50, y: 55, alive: true}, 
    {x: 70, y: 55, alive: true}
  ];

  function loop() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw Score
    drawPixelText(ctx, `SCORE:${score}`, 5, 15, '#39ff14');

    // Move Aliens
    invaderX += 0.5 * invaderDir;
    if (invaderX > 30 || invaderX < 5) {
      invaderDir *= -1;
      aliens.forEach(a => a.y += 2);
    }
    
    // Reset if aliens reach too low
    if (aliens.some(a => a.alive && a.y > 100)) {
      aliens.forEach(a => { a.y -= 25; });
    }

    // Draw Aliens
    aliens.forEach(alien => {
      if (!alien.alive) return;
      ctx.fillStyle = '#ff007f';
      // Draw small alien dot block
      ctx.fillRect(invaderX + alien.x, alien.y, 8, 6);
      ctx.fillRect(invaderX + alien.x + 2, alien.y - 2, 4, 2);
    });

    // Move & Draw Player Ship
    shipX += 0.8 * shipDir;
    if (shipX > 90 || shipX < 10) shipDir *= -1;
    
    ctx.fillStyle = '#39ff14';
    ctx.fillRect(shipX, 115, 12, 6);
    ctx.fillRect(shipX + 4, 110, 4, 5);

    // Auto shoot
    if (!bullet && Math.random() < 0.05) {
      bullet = {x: shipX + 6, y: 110};
    }

    // Move & Draw Bullet
    if (bullet) {
      bullet.y -= 3;
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(bullet.x, bullet.y, 2, 4);

      // Hit detection
      aliens.forEach(a => {
        if (a.alive && bullet &&
            bullet.x >= invaderX + a.x && bullet.x <= invaderX + a.x + 8 &&
            bullet.y >= a.y && bullet.y <= a.y + 6) {
          a.alive = false;
          bullet = null;
          score += 10;
        }
      });

      if (bullet && bullet.y < 20) bullet = null;
    }

    // Respawn all if dead
    if (aliens.every(a => !a.alive)) {
      aliens.forEach(a => {
        a.alive = true;
        a.y = a.y > 60 ? a.y - 20 : a.y;
      });
    }

    demoAnimationIds.invaders = requestAnimationFrame(loop);
  }
  loop();
}

// 2. Tetris Demo
function initTetrisDemo(canvas) {
  const ctx = canvas.getContext('2d');
  let grid = Array(15).fill().map(() => Array(10).fill(0));
  
  // Prefill some rows at bottom
  for (let c = 0; c < 10; c++) {
    if (c !== 4) grid[14][c] = '#bd00ff';
    if (c !== 4 && c !== 5) grid[13][c] = '#00f3ff';
  }

  let blockY = 0;
  let blockX = 4;
  let score = 1240;
  let cycle = 0;

  function loop() {
    cycle++;
    
    // Draw Grid
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Sidebar
    ctx.fillStyle = '#111';
    ctx.fillRect(100, 0, canvas.width - 100, canvas.height);
    drawPixelText(ctx, "NEXT", 108, 20, '#00f3ff');
    drawPixelText(ctx, "SCORE", 108, 65, '#ffe600');
    drawPixelText(ctx, `${score}`, 108, 80, '#fff');

    // Draw Next Block
    ctx.fillStyle = '#ffe600';
    ctx.fillRect(115, 35, 16, 16);

    // Grid Boundaries
    ctx.strokeStyle = '#222';
    ctx.strokeRect(10, 10, 80, 120);

    // Draw Stationary blocks
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 10; c++) {
        if (grid[r][c]) {
          ctx.fillStyle = grid[r][c];
          ctx.fillRect(10 + c*8, 10 + r*8, 7, 7);
        }
      }
    }

    // Draw falling Block (2x2 yellow block)
    ctx.fillStyle = '#ff007f';
    ctx.fillRect(10 + blockX*8, 10 + blockY*8, 15, 15);

    // Fall logic
    if (cycle % 12 === 0) {
      blockY++;
      if (blockY > 11) { // Hit bottom blocks
        // Lock blocks
        grid[12][blockX] = '#ff007f';
        grid[12][blockX+1] = '#ff007f';
        
        // Flash clear line animation mock
        score += 100;
        
        // Reset
        blockY = 0;
        blockX = Math.floor(Math.random() * 8);
      }
    }

    demoAnimationIds.tetris = requestAnimationFrame(loop);
  }
  loop();
}

// 3. Head-On Demo
function initHeadonDemo(canvas) {
  const ctx = canvas.getContext('2d');
  
  // Track layout parameters
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 + 10;
  
  // Cars positions
  let player = { lane: 0, angle: 0, speed: 0.05, color: '#00f3ff' };
  let enemy = { lane: 1, angle: Math.PI, speed: 0.045, color: '#ff007f' };
  let score = 42;
  let dots = [];
  
  // Init dots in lanes
  function resetDots() {
    dots = [];
    for (let l = 0; l < 2; l++) {
      const radiusX = 45 - l * 15;
      const radiusY = 30 - l * 10;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        dots.push({
          x: centerX + Math.cos(a) * radiusX,
          y: centerY + Math.sin(a) * radiusY,
          active: true
        });
      }
    }
  }
  resetDots();

  function loop() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // HUD
    drawPixelText(ctx, `DOTS: ${dots.filter(d => d.active).length}`, 5, 15, '#ffe600');
    drawPixelText(ctx, `HI: 9990`, 90, 15, '#fff');

    // Draw Lanes
    ctx.strokeStyle = '#222';
    ctx.strokeRect(centerX - 45, centerY - 30, 90, 60);
    ctx.strokeRect(centerX - 30, centerY - 20, 60, 40);

    // Draw Dots
    ctx.fillStyle = '#ffe600';
    dots.forEach(dot => {
      if (dot.active) {
        ctx.fillRect(dot.x - 2, dot.y - 2, 4, 4);
      }
    });

    // Move Player (Lanes: 0=Outer, 1=Inner)
    player.angle += player.speed;
    const pRadiusX = 45 - player.lane * 15;
    const pRadiusY = 30 - player.lane * 10;
    const px = centerX + Math.cos(player.angle) * pRadiusX;
    const py = centerY + Math.sin(player.angle) * pRadiusY;

    // Move Enemy
    enemy.angle += enemy.speed;
    const eRadiusX = 45 - enemy.lane * 15;
    const eRadiusY = 30 - enemy.lane * 10;
    const ex = centerX + Math.cos(enemy.angle) * eRadiusX;
    const ey = centerY + Math.sin(enemy.angle) * eRadiusY;

    // Draw Player
    ctx.fillStyle = player.color;
    ctx.fillRect(px - 4, py - 4, 8, 8);
    // Draw Enemy
    ctx.fillStyle = enemy.color;
    ctx.fillRect(ex - 4, ey - 4, 8, 8);

    // Collision detection with dots
    dots.forEach(dot => {
      if (dot.active && Math.abs(px - dot.x) < 8 && Math.abs(py - dot.y) < 8) {
        dot.active = false;
        score += 10;
      }
    });

    // Lane switches mock
    if (Math.random() < 0.015) {
      player.lane = 1 - player.lane;
    }
    if (Math.random() < 0.01) {
      enemy.lane = 1 - enemy.lane;
    }

    if (dots.every(d => !d.active)) {
      resetDots();
    }

    demoAnimationIds.headon = requestAnimationFrame(loop);
  }
  loop();
}

// 4. Pacman Demo
function initPacmanDemo(canvas) {
  const ctx = canvas.getContext('2d');
  let pacX = 15;
  let pacDir = 1;
  let pacOpen = 0;
  let ghostX = 75;
  let isScared = false;
  let scaredTimer = 0;
  let score = 2560;

  function loop() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw HUD
    drawPixelText(ctx, `1UP:${score}`, 5, 15, '#ff007f');
    
    // Draw simple corridor walls
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, 50); ctx.lineTo(130, 50);
    ctx.moveTo(10, 90); ctx.lineTo(130, 90);
    ctx.stroke();

    // Draw regular food dots
    ctx.fillStyle = '#ffe600';
    for (let x = 25; x < 130; x += 15) {
      if (pacDir === 1 && x > pacX) {
        ctx.fillRect(x, 68, 3, 3);
      } else if (pacDir === -1 && x < pacX) {
        ctx.fillRect(x, 68, 3, 3);
      }
    }

    // Update Pacman
    pacX += 1.2 * pacDir;
    pacOpen = (pacOpen + 0.15) % Math.PI;

    if (pacX > 115) {
      pacDir = -1;
    } else if (pacX < 25) {
      pacDir = 1;
    }

    // Ghost behavior
    let gColor = '#ff007f'; // Blink/red ghost
    if (isScared) {
      gColor = '#00f3ff'; // Blue scared ghost
      scaredTimer--;
      if (scaredTimer <= 0) isScared = false;
      // Enemy runs away
      ghostX += 0.8 * pacDir;
    } else {
      // Enemy chases
      ghostX += 0.95 * (pacX > ghostX ? 1 : -1);
    }

    // Intersection overlap / capture mock
    if (Math.abs(pacX - ghostX) < 10) {
      if (isScared) {
        // Pacman eats ghost
        score += 200;
        ghostX = 15; // Respawn at start
        isScared = false;
      } else {
        // Power Pellet triggered
        isScared = true;
        scaredTimer = 180;
        ghostX += 30 * -pacDir; // push back
      }
    }

    // Limit ghost boundary
    if (ghostX < 15) ghostX = 15;
    if (ghostX > 125) ghostX = 125;

    // Draw Pacman
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    // Simple pie chart shape Pacman
    const startAngle = pacDir === 1 ? pacOpen : Math.PI + pacOpen;
    const endAngle = pacDir === 1 ? Math.PI*2 - pacOpen : Math.PI - pacOpen;
    ctx.arc(pacX, 70, 9, startAngle, endAngle);
    ctx.lineTo(pacX, 70);
    ctx.fill();

    // Draw Ghost
    ctx.fillStyle = gColor;
    ctx.beginPath();
    ctx.arc(ghostX, 70, 8, Math.PI, 0); // Head
    ctx.lineTo(ghostX + 8, 78);
    // Skirt wave
    ctx.lineTo(ghostX + 4, 76);
    ctx.lineTo(ghostX, 78);
    ctx.lineTo(ghostX - 4, 76);
    ctx.lineTo(ghostX - 8, 78);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(ghostX - 4, 66, 3, 3);
    ctx.fillRect(ghostX + 1, 66, 3, 3);

    demoAnimationIds.pacman = requestAnimationFrame(loop);
  }
  loop();
}

// 5. Mahjong Demo
function initMahjongDemo(canvas) {
  const ctx = canvas.getContext('2d');
  let score = 25000;
  let tiles = ['🀄', '🀅', '🀆', '🀀', '🀁', '🀂', '🀃', '🀇', '🀏', '🀐', '🀘', '🀙', '🀡'];
  let curTile = '🀄';
  let frame = 0;
  let isTsumo = false;

  function loop() {
    frame++;
    ctx.fillStyle = '#0a3d24'; // 深い緑の麻雀卓
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // HUD
    drawPixelText(ctx, `SCORE:${score}`, 5, 15, '#ffe600');
    drawPixelText(ctx, `EAST 1`, 90, 15, '#fff');

    // 麻雀牌（手牌風に並べる）
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#333';
    
    // 12枚の手牌を描画
    for (let i = 0; i < 11; i++) {
      const px = 10 + i * 9;
      const py = 95;
      ctx.fillRect(px, py, 8, 14);
      ctx.strokeRect(px, py, 8, 14);
      // 底面（黄色い背）
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(px, py + 14, 8, 2);
      ctx.fillStyle = '#fff';
    }

    // ツモ牌
    const tx = 112;
    const ty = 95;
    ctx.fillRect(tx, ty, 8, 14);
    ctx.strokeRect(tx, ty, 8, 14);
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(tx, ty + 14, 8, 2);
    ctx.fillStyle = '#fff';

    // 中央にアガリ牌を大きく描画
    ctx.fillStyle = '#f5f5f0';
    ctx.fillRect(45, 35, 40, 52);
    ctx.strokeRect(45, 35, 40, 52);
    ctx.fillStyle = '#b3aa00'; // 黄色い背面
    ctx.fillRect(45, 87, 40, 4);

    // 牌の模様（漢字/マーク）
    ctx.fillStyle = '#ff003c'; // 赤（中）
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(curTile, 65, 61);

    // ツモ/ロンの点滅表示
    if (isTsumo) {
      if (Math.floor(frame / 15) % 2 === 0) {
        drawPixelText(ctx, "TSUMO!!", 40, 110, '#39ff14');
      }
    }

    // 状態遷移
    if (frame % 90 === 0) {
      isTsumo = !isTsumo;
      if (!isTsumo) {
        // 新しい牌を引く
        curTile = tiles[Math.floor(Math.random() * tiles.length)];
        score += 1000;
        if (score > 40000) score = 25000;
      }
    }

    demoAnimationIds.mahjong = requestAnimationFrame(loop);
  }
  loop();
}

// 6. Gomoku Demo
function initGomokuDemo(canvas) {
  const ctx = canvas.getContext('2d');
  let boardSize = 9;
  let cell = 12;
  let offsetX = (canvas.width - boardSize * cell) / 2 + 5;
  let offsetY = 25;
  let moves = [];
  let turn = 'black';
  let frame = 0;
  let win = false;

  const winPattern = [
    {r: 3, c: 3}, {r: 3, c: 4}, {r: 3, c: 5}, {r: 3, c: 6}, {r: 3, c: 7}
  ];
  const allMoves = [
    {r: 3, c: 3, t: 'black'},
    {r: 4, c: 4, t: 'white'},
    {r: 3, c: 4, t: 'black'},
    {r: 2, c: 2, t: 'white'},
    {r: 3, c: 5, t: 'black'},
    {r: 5, c: 5, t: 'white'},
    {r: 3, c: 6, t: 'black'},
    {r: 1, c: 7, t: 'white'},
    {r: 3, c: 7, t: 'black'}
  ];
  let moveIdx = 0;

  function loop() {
    frame++;
    ctx.fillStyle = '#d4a373'; // 木目の碁盤風
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // HUD
    drawPixelText(ctx, `GOMOKU`, 5, 15, '#bd00ff');
    drawPixelText(ctx, win ? "WIN!" : `${turn.toUpperCase()}`, 65, 15, win ? '#39ff14' : '#fff');

    // 碁盤の線を描画
    ctx.strokeStyle = '#332211';
    ctx.lineWidth = 1;
    for (let i = 0; i < boardSize; i++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + i * cell);
      ctx.lineTo(offsetX + (boardSize - 1) * cell, offsetY + i * cell);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(offsetX + i * cell, offsetY);
      ctx.lineTo(offsetX + i * cell, offsetY + (boardSize - 1) * cell);
      ctx.stroke();
    }

    // 碁石を描画
    moves.forEach(m => {
      ctx.fillStyle = m.t === 'black' ? '#111' : '#fff';
      ctx.strokeStyle = m.t === 'black' ? '#000' : '#ccc';
      ctx.beginPath();
      ctx.arc(offsetX + m.c * cell, offsetY + m.r * cell, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    if (win) {
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(offsetX + winPattern[0].c * cell, offsetY + winPattern[0].r * cell);
      ctx.lineTo(offsetX + winPattern[4].c * cell, offsetY + winPattern[4].r * cell);
      ctx.stroke();
      
      if (Math.floor(frame / 15) % 2 === 0) {
        drawPixelText(ctx, "5 IN A ROW!", 25, 135, '#39ff14');
      }
    }

    // 手の追加
    if (frame % 45 === 0 && !win) {
      if (moveIdx < allMoves.length) {
        moves.push(allMoves[moveIdx]);
        turn = allMoves[moveIdx].t === 'black' ? 'white' : 'black';
        moveIdx++;
        if (moveIdx === allMoves.length) {
          win = true;
        }
      } else {
        moves = [];
        moveIdx = 0;
        win = false;
        turn = 'black';
      }
    } else if (win && frame % 120 === 0) {
      moves = [];
      moveIdx = 0;
      win = false;
      turn = 'black';
    }

    demoAnimationIds.gomoku = requestAnimationFrame(loop);
  }
  loop();
}

// 7. Reversi Demo
function initReversiDemo(canvas) {
  const ctx = canvas.getContext('2d');
  let boardSize = 8;
  let cell = 12;
  let offsetX = (canvas.width - boardSize * cell) / 2;
  let offsetY = 25;
  let board = Array(8).fill().map(() => Array(8).fill(null));
  
  board[3][3] = 'white';
  board[3][4] = 'black';
  board[4][3] = 'black';
  board[4][4] = 'white';

  let frame = 0;
  let moves = [
    {r: 2, c: 4, player: 'black', flips: [{r: 3, c: 4}]},
    {r: 2, c: 3, player: 'white', flips: [{r: 3, c: 3}]},
    {r: 4, c: 2, player: 'black', flips: [{r: 4, c: 3}]},
    {r: 5, c: 2, player: 'white', flips: [{r: 4, c: 3}]}
  ];
  let moveIdx = 0;
  let flipAnimation = null;

  function loop() {
    frame++;
    ctx.fillStyle = '#0a5c36'; // 緑のオセロ盤
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // HUD
    drawPixelText(ctx, `REVERSI`, 5, 15, '#ff6c00');
    
    let blackCount = 0, whiteCount = 0;
    for (let r=0; r<8; r++) {
      for (let c=0; c<8; c++) {
        if (board[r][c] === 'black') blackCount++;
        if (board[r][c] === 'white') whiteCount++;
      }
    }
    drawPixelText(ctx, `B:${blackCount} W:${whiteCount}`, 75, 15, '#fff');

    // グリッド線
    ctx.strokeStyle = '#05301b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= boardSize; i++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + i * cell);
      ctx.lineTo(offsetX + boardSize * cell, offsetY + i * cell);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(offsetX + i * cell, offsetY);
      ctx.lineTo(offsetX + i * cell, offsetY + boardSize * cell);
      ctx.stroke();
    }

    // 石を描画
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        if (board[r][c]) {
          ctx.fillStyle = board[r][c] === 'black' ? '#111' : '#fff';
          ctx.strokeStyle = board[r][c] === 'black' ? '#000' : '#ccc';
          
          let scaleX = 1;
          if (flipAnimation && flipAnimation.flips.some(f => f.r === r && f.c === c)) {
            let p = flipAnimation.progress;
            if (p < 5) {
              scaleX = (5 - p) / 5;
              ctx.fillStyle = flipAnimation.targetColor === 'black' ? '#fff' : '#111';
            } else {
              scaleX = (p - 5) / 5;
              ctx.fillStyle = flipAnimation.targetColor === 'black' ? '#111' : '#fff';
            }
          }

          ctx.beginPath();
          ctx.ellipse(
            offsetX + c * cell + cell/2, 
            offsetY + r * cell + cell/2, 
            5 * scaleX, 5, 0, 0, Math.PI * 2
          );
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    if (flipAnimation) {
      flipAnimation.progress += 0.5;
      if (flipAnimation.progress >= 10) {
        flipAnimation.flips.forEach(f => {
          board[f.r][f.c] = flipAnimation.targetColor;
        });
        flipAnimation = null;
      }
    }

    if (frame % 60 === 0 && !flipAnimation) {
      if (moveIdx < moves.length) {
        let m = moves[moveIdx];
        board[m.r][m.c] = m.player;
        flipAnimation = { flips: m.flips, targetColor: m.player, progress: 0 };
        moveIdx++;
      } else {
        board = Array(8).fill().map(() => Array(8).fill(null));
        board[3][3] = 'white';
        board[3][4] = 'black';
        board[4][3] = 'black';
        board[4][4] = 'white';
        moveIdx = 0;
      }
    }

    demoAnimationIds.reversi = requestAnimationFrame(loop);
  }
  loop();
}

// 8. Blokus Demo
function initBlokusDemo(canvas) {
  const ctx = canvas.getContext('2d');
  const boardSize = 10;
  const cell = 10;
  const offsetX = (canvas.width - boardSize * cell) / 2;
  const offsetY = 20;
  
  let board = Array(boardSize).fill().map(() => Array(boardSize).fill(0));
  
  // 初期状態
  board[0][0] = 1; board[0][1] = 1; board[1][0] = 1; // 青
  board[9][9] = 2; board[9][8] = 2; board[8][9] = 2; // 黄
  board[0][9] = 3; board[1][9] = 3; board[0][8] = 3; // 赤
  board[9][0] = 4; board[9][1] = 4; board[8][0] = 4; // 緑
  
  let frame = 0;
  let step = 0;
  
  const moves = [
    { r: 2, c: 1, color: 1 }, // 青
    { r: 7, c: 8, color: 2 }, // 黄
    { r: 1, c: 7, color: 3 }, // 赤
    { r: 8, c: 2, color: 4 }, // 緑
    { r: 2, c: 2, color: 1 }, // 青
    { r: 7, c: 7, color: 2 }  // 黄
  ];

  function loop() {
    frame++;
    ctx.fillStyle = '#0f111a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // HUD
    drawPixelText(ctx, `BLOKUS`, 5, 12, '#0077ff');
    
    // グリッド線
    ctx.strokeStyle = '#222533';
    ctx.lineWidth = 1;
    for (let i = 0; i <= boardSize; i++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + i * cell);
      ctx.lineTo(offsetX + boardSize * cell, offsetY + i * cell);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(offsetX + i * cell, offsetY);
      ctx.lineTo(offsetX + i * cell, offsetY + boardSize * cell);
      ctx.stroke();
    }

    // 描画
    const colors = {
      1: '#0077ff', // 青
      2: '#ffe600', // 黄
      3: '#ff007f', // 赤
      4: '#39ff14'  // 緑
    };

    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        if (board[r][c] > 0) {
          ctx.fillStyle = colors[board[r][c]];
          ctx.fillRect(offsetX + c * cell + 1, offsetY + r * cell + 1, cell - 2, cell - 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.strokeRect(offsetX + c * cell + 2, offsetY + r * cell + 2, cell - 4, cell - 4);
        }
      }
    }

    if (frame % 60 === 0) {
      if (step < moves.length) {
        const move = moves[step];
        board[move.r][move.c] = move.color;
        step++;
      } else {
        board = Array(boardSize).fill().map(() => Array(boardSize).fill(0));
        board[0][0] = 1; board[0][1] = 1; board[1][0] = 1;
        board[9][9] = 2; board[9][8] = 2; board[8][9] = 2;
        board[0][9] = 3; board[1][9] = 3; board[0][8] = 3;
        board[9][0] = 4; board[9][1] = 4; board[8][0] = 4;
        step = 0;
      }
    }

    demoAnimationIds.blokus = requestAnimationFrame(loop);
  }
  loop();
}

// 9. Shogi Demo
function initShogiDemo(canvas) {
  const ctx = canvas.getContext('2d');
  const boardSize = 9;
  const cell = 11;
  const offsetX = (canvas.width - boardSize * cell) / 2;
  const offsetY = 20;
  
  let frame = 0;
  let phase = 0; // 0: initial, 1: black move, 2: white move, 3: win
  
  // Draw pentagon piece on canvas
  function drawPiece(cx, cy, label, isWhite, isPromoted) {
    ctx.save();
    ctx.translate(cx, cy);
    if (isWhite) {
      ctx.rotate(Math.PI);
    }
    
    // Draw pentagon base
    ctx.fillStyle = '#1e1f29';
    ctx.strokeStyle = isWhite ? '#00f2fe' : '#ffd700';
    if (isPromoted) ctx.strokeStyle = '#ff4500';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, -4);
    ctx.lineTo(3.5, 5);
    ctx.lineTo(-3.5, 5);
    ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Text
    ctx.fillStyle = isWhite ? '#00f2fe' : '#ffd700';
    if (isPromoted) ctx.fillStyle = '#ff4500';
    ctx.font = '6px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, isWhite ? -1 : 1);
    
    ctx.restore();
  }

  function loop() {
    frame++;
    ctx.fillStyle = '#07070d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // HUD
    drawPixelText(ctx, `SHOGI`, 5, 12, '#ffd700');
    
    // Grid Lines (Shogi board)
    ctx.strokeStyle = '#141426';
    ctx.lineWidth = 1;
    for (let i = 0; i <= boardSize; i++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + i * cell);
      ctx.lineTo(offsetX + boardSize * cell, offsetY + i * cell);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(offsetX + i * cell, offsetY);
      ctx.lineTo(offsetX + i * cell, offsetY + boardSize * cell);
      ctx.stroke();
    }
    
    // Star markers
    ctx.fillStyle = '#141426';
    const markers = [3, 6];
    markers.forEach(r => {
      markers.forEach(c => {
        ctx.beginPath();
        ctx.arc(offsetX + c * cell, offsetY + r * cell, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // Draw static board state
    drawPiece(offsetX + 4 * cell + cell/2, offsetY + 8 * cell + cell/2, '王', false);
    drawPiece(offsetX + 4 * cell + cell/2, offsetY + 0 * cell + cell/2, '玉', true);
    
    if (phase === 0) {
      drawPiece(offsetX + 1 * cell + cell/2, offsetY + 7 * cell + cell/2, '角', false);
      drawPiece(offsetX + 7 * cell + cell/2, offsetY + 7 * cell + cell/2, '飛', false);
      drawPiece(offsetX + 7 * cell + cell/2, offsetY + 1 * cell + cell/2, '飛', true);
      drawPiece(offsetX + 3 * cell + cell/2, offsetY + 2 * cell + cell/2, '銀', true);
    } else if (phase === 1) {
      drawPiece(offsetX + 1 * cell + cell/2, offsetY + 7 * cell + cell/2, '角', false);
      drawPiece(offsetX + 7 * cell + cell/2, offsetY + 4 * cell + cell/2, '飛', false);
      drawPiece(offsetX + 7 * cell + cell/2, offsetY + 1 * cell + cell/2, '飛', true);
      drawPiece(offsetX + 3 * cell + cell/2, offsetY + 2 * cell + cell/2, '銀', true);
    } else if (phase === 2) {
      drawPiece(offsetX + 1 * cell + cell/2, offsetY + 7 * cell + cell/2, '角', false);
      drawPiece(offsetX + 7 * cell + cell/2, offsetY + 4 * cell + cell/2, '飛', false);
      drawPiece(offsetX + 7 * cell + cell/2, offsetY + 1 * cell + cell/2, '飛', true);
      drawPiece(offsetX + 3 * cell + cell/2, offsetY + 3 * cell + cell/2, '銀', true);
    } else {
      drawPiece(offsetX + 4 * cell + cell/2, offsetY + 4 * cell + cell/2, '馬', false, true);
      drawPiece(offsetX + 7 * cell + cell/2, offsetY + 4 * cell + cell/2, '飛', false);
      drawPiece(offsetX + 7 * cell + cell/2, offsetY + 1 * cell + cell/2, '飛', true);
      drawPiece(offsetX + 3 * cell + cell/2, offsetY + 3 * cell + cell/2, '銀', true);
      
      if (Math.floor(frame / 15) % 2 === 0) {
        drawPixelText(ctx, "PROMOTE!", 30, 135, '#ff4500');
      }
    }

    if (frame % 70 === 0) {
      phase = (phase + 1) % 4;
    }

    demoAnimationIds.shogi = requestAnimationFrame(loop);
  }
  loop();
}

// 10. Military Shogi Demo
function initGunjinDemo(canvas) {
  const ctx = canvas.getContext('2d');
  const boardR = 8;
  const boardC = 6;
  const cell = 12;
  const offsetX = (canvas.width - boardC * cell) / 2;
  const offsetY = 20;
  
  let frame = 0;
  let animState = 0; // 0: setup, 1: move, 2: battle/explosion, 3: result
  let redPos = { r: 5, c: 2 };
  let bluePos = { r: 4, c: 2 };
  let showExplosion = false;
  let explosionTimer = 0;
  
  function loop() {
    frame++;
    ctx.fillStyle = '#0b0c10'; // 暗いミリタリー色の背景
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawPixelText(ctx, "GUNJIN", 5, 12, '#39ff14');
    
    // 盤面の線を描画
    ctx.strokeStyle = '#1f2833';
    ctx.lineWidth = 1;
    for (let i = 0; i <= boardR; i++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + i * cell);
      ctx.lineTo(offsetX + boardC * cell, offsetY + i * cell);
      ctx.stroke();
    }
    for (let i = 0; i <= boardC; i++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + i * cell, offsetY);
      ctx.lineTo(offsetX + i * cell, offsetY + boardR * cell);
      ctx.stroke();
    }
    
    // 川を描画（行3と4の間）
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY + 4 * cell);
    ctx.lineTo(offsetX + boardC * cell, offsetY + 4 * cell);
    ctx.stroke();
    
    // キャンプを描画
    ctx.fillStyle = '#141c1f';
    const campPositions = [{r:2, c:1}, {r:2, c:4}, {r:5, c:1}, {r:5, c:4}];
    campPositions.forEach(p => {
      ctx.beginPath();
      ctx.arc(offsetX + p.c * cell + cell/2, offsetY + p.r * cell + cell/2, 4, 0, Math.PI*2);
      ctx.fill();
    });
    
    // 司令部
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX + 1 * cell + 2, offsetY + 7 * cell + 2, cell - 4, cell - 4);
    ctx.strokeRect(offsetX + 4 * cell + 2, offsetY + 7 * cell + 2, cell - 4, cell - 4);
    
    // 自軍の駒を描画 (大将)
    ctx.fillStyle = '#80302b';
    ctx.fillRect(offsetX + redPos.c * cell + 2, offsetY + redPos.r * cell + 2, cell - 4, cell - 4);
    ctx.fillStyle = '#ffd5d1';
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("将", offsetX + redPos.c * cell + cell/2, offsetY + redPos.r * cell + cell/2);
    
    // 敵軍の駒を描画 (裏向き)
    if (animState < 3) {
      ctx.fillStyle = '#2c4a63';
      ctx.fillRect(offsetX + bluePos.c * cell + 2, offsetY + bluePos.r * cell + 2, cell - 4, cell - 4);
      ctx.fillStyle = '#d5eaff';
      ctx.fillText("?", offsetX + bluePos.c * cell + cell/2, offsetY + bluePos.r * cell + cell/2);
    }
    
    // アニメーション状態遷移
    if (frame % 80 === 0) {
      animState = (animState + 1) % 4;
      if (animState === 0) {
        redPos = { r: 5, c: 2 };
        bluePos = { r: 4, c: 2 };
        showExplosion = false;
      } else if (animState === 1) {
        redPos = { r: 4, c: 2 };
      } else if (animState === 2) {
        showExplosion = true;
        explosionTimer = 20;
      }
    }
    
    // 爆発エフェクトの描画
    if (showExplosion && explosionTimer > 0) {
      explosionTimer--;
      ctx.fillStyle = '#ffe600';
      ctx.beginPath();
      ctx.arc(offsetX + 2 * cell + cell/2, offsetY + 4 * cell + cell/2, 10 - (explosionTimer/2), 0, Math.PI*2);
      ctx.fill();
      
      ctx.fillStyle = '#ff3300';
      ctx.beginPath();
      ctx.arc(offsetX + 2 * cell + cell/2, offsetY + 4 * cell + cell/2, 6 - (explosionTimer/3), 0, Math.PI*2);
      ctx.fill();
      
      if (Math.floor(frame / 5) % 2 === 0) {
        drawPixelText(ctx, "BATTLE!", 28, 115, '#ff3333');
      }
    } else if (animState === 3) {
      drawPixelText(ctx, "WINNER: RED", 14, 115, '#39ff14');
    }
    
    demoAnimationIds.gunjin = requestAnimationFrame(loop);
  }
  loop();
}

function initDemos() {
  const cInvaders = document.getElementById("canvas-invaders");
  const cTetris = document.getElementById("canvas-tetris");
  const cHeadon = document.getElementById("canvas-headon");
  const cPacman = document.getElementById("canvas-pacman");
  const cMahjong = document.getElementById("canvas-mahjong");
  const cGomoku = document.getElementById("canvas-gomoku");
  const cReversi = document.getElementById("canvas-reversi");
  const cBlokus = document.getElementById("canvas-blokus");
  const cShogi = document.getElementById("canvas-shogi");
  const cGunjin = document.getElementById("canvas-gunjin");

  if (cInvaders) initInvadersDemo(cInvaders);
  if (cTetris) initTetrisDemo(cTetris);
  if (cHeadon) initHeadonDemo(cHeadon);
  if (cPacman) initPacmanDemo(cPacman);
  if (cMahjong) initMahjongDemo(cMahjong);
  if (cGomoku) initGomokuDemo(cGomoku);
  if (cReversi) initReversiDemo(cReversi);
  if (cBlokus) initBlokusDemo(cBlokus);
  if (cShogi) initShogiDemo(cShogi);
  if (cGunjin) initGunjinDemo(cGunjin);
}

// --- HUD & INTERACTION LOGIC ---

function updateCreditsUI() {
  const display = document.getElementById("credit-count");
  if (!display) return;
  
  const displayVal = credits < 10 ? "0" + credits : credits;
  display.innerText = displayVal;
  
  const indicators = document.querySelectorAll(".ready-indicator");
  
  if (credits > 0) {
    display.classList.add("has-credits");
    indicators.forEach(ind => ind.classList.add("active"));
  } else {
    display.classList.remove("has-credits");
    indicators.forEach(ind => ind.classList.remove("active"));
  }
}

function insertCoin() {
  credits++;
  updateCreditsUI();
  playCoinSE();

  // Visual flash on slot button
  const btn = document.getElementById("insert-coin-btn");
  if (btn) {
    btn.style.transform = "scale(0.95)";
    setTimeout(() => { btn.style.transform = "scale(1)"; }, 100);
  }
}

function showCreditWarning(element) {
  playErrorSE();
  
  const rect = element.getBoundingClientRect();
  const bubble = document.createElement("div");
  bubble.className = "credit-warning-bubble";
  bubble.innerText = "INSERT COIN!";
  bubble.style.left = `${rect.left + window.scrollX + rect.width/2 - 60}px`;
  bubble.style.top = `${rect.top + window.scrollY - 35}px`;
  
  document.body.appendChild(bubble);
  
  const crCount = document.getElementById("credit-count");
  if (crCount) {
    crCount.style.color = "#ffffff";
    crCount.style.textShadow = "0 0 15px #ffffff";
    setTimeout(() => { crCount.style.color = ""; crCount.style.textShadow = ""; }, 300);
  }

  const coinBtn = document.getElementById("insert-coin-btn");
  if (coinBtn) {
    coinBtn.style.animation = "none";
    coinBtn.offsetHeight;
    coinBtn.style.animation = "pulseButton 0.15s 4";
    setTimeout(() => {
      coinBtn.style.animation = "pulseButton 1.5s infinite";
    }, 600);
  }
  
  setTimeout(() => { bubble.remove(); }, 1500);
}

// Full CRT glitch load transition to link
function launchGame(gameKey, element) {
  if (credits <= 0) {
    showCreditWarning(element);
    return;
  }

  credits--;
  updateCreditsUI();
  
  // Stop background music
  stopBGM();
  const bgmToggle = document.getElementById("bgm-toggle");
  if (bgmToggle) bgmToggle.checked = false;

  // Show analog CRT static overlay screen
  const loadingOverlay = document.getElementById("loading-overlay");
  const loadingProgress = document.getElementById("loading-progress");
  const loadingSubText = document.getElementById("loading-sub-text");
  
  if (!loadingOverlay) {
    // Fallback if overlay element missing
    playStartSE(() => {
      window.location.href = GAMES[gameKey].playUrl;
    });
    return;
  }

  loadingOverlay.classList.add("active");
  loadingProgress.style.width = "0%";
  
  // Start TV static audio hum (Web Audio buffer noise)
  const staticNoiseNode = playStaticNoiseSE(2.8);

  const steps = [
    { progress: 20, text: "CONNECTING CABINET..." },
    { progress: 50, text: "INSERTING CREDIT & BOOTING ROM..." },
    { progress: 80, text: "DECIPHERING CONTROLS..." },
    { progress: 100, text: "BOOT OK. READY TO PLAY!" }
  ];

  steps.forEach(step => {
    setTimeout(() => {
      if (loadingSubText) loadingSubText.innerText = step.text;
      if (loadingProgress) loadingProgress.style.width = `${step.progress}%`;
      playHoverSE();
    }, step.progress * 22); // complete in 2.2 seconds
  });

  setTimeout(() => {
    // End static noise
    if (staticNoiseNode) {
      try { staticNoiseNode.stop(); } catch(e) {}
    }
    
    // Play Game start fanfare
    playStartSE(() => {
      window.location.href = GAMES[gameKey].playUrl;
    });
  }, 2600);
}

// Initialize everything on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  // Setup Background Star Canvas
  setupStarfield();
  
  // Setup Interactive Game Demos inside Screens
  initDemos();

  // Setup toggle switches
  const crtToggle = document.getElementById("crt-toggle");
  const bgmToggle = document.getElementById("bgm-toggle");
  
  if (crtToggle) {
    const isCrt = localStorage.getItem("crt-effect") !== "disabled";
    crtToggle.checked = isCrt;
    if (isCrt) document.body.classList.add("crt-active");

    crtToggle.addEventListener("change", () => {
      if (crtToggle.checked) {
        document.body.classList.add("crt-active");
        localStorage.setItem("crt-effect", "enabled");
      } else {
        document.body.classList.remove("crt-active");
        localStorage.setItem("crt-effect", "disabled");
      }
      playHoverSE();
    });
  }

  if (bgmToggle) {
    bgmToggle.addEventListener("change", () => {
      if (bgmToggle.checked) {
        startBGM();
      } else {
        stopBGM();
      }
      playHoverSE();
    });
  }

  // Volume slider control
  const volumeSlider = document.getElementById("volume-slider");
  if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
      initAudio();
      const val = parseFloat(e.target.value);
      if (val === 0) {
        isMuted = true;
      } else {
        isMuted = false;
        masterGain.gain.setValueAtTime(val * 0.3, audioContext.currentTime);
      }
    });
  }

  // Wire Insert Coin Button & Coin Slots
  const insertCoinBtn = document.getElementById("insert-coin-btn");
  if (insertCoinBtn) {
    insertCoinBtn.addEventListener("click", insertCoin);
  }

  document.querySelectorAll(".coin-return").forEach(returnDoor => {
    returnDoor.addEventListener("click", insertCoin);
  });

  // Wire Game actions
  document.querySelectorAll(".btn-play").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const gameKey = btn.getAttribute("data-game");
      launchGame(gameKey, btn);
    });
  });

  document.querySelectorAll(".btn-code").forEach(btn => {
    btn.addEventListener("click", (e) => {
      playHoverSE();
      const gameKey = btn.getAttribute("data-game");
      setTimeout(() => {
        window.open(GAMES[gameKey].codeUrl, '_blank');
      }, 150);
    });
  });

  // Sound triggers on hovering cabinet cards to make room feel alive
  document.querySelectorAll(".cabinet").forEach(cab => {
    cab.addEventListener("mouseenter", () => {
      playHoverSE();
    });
  });
});
