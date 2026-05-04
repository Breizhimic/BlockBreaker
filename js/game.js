/* js/game.js — Logique principale du jeu */

const Game = (() => {
  // ---- State ----
  const STATE = { MENU:'menu', WAITING:'waiting', PLAYING:'playing', PAUSED:'paused',
                  LEVEL_COMPLETE:'level_complete', GAME_OVER:'game_over', WIN:'win' };
  let state = STATE.MENU;

  let score = 0;
  let level = 0;  // 0-indexed
  let lives = 3;
  let maxLives = 3;
  let combo = 0;
  let maxCombo = 0;
  let powerupsCollected = 0;
  let difficulty = 'normal';
  let firstPlay = true;

  const DIFF_CONFIG = {
    easy:    { lives: 5, speedMult: 0.85 },
    normal:  { lives: 3, speedMult: 1.0  },
    hard:    { lives: 2, speedMult: 1.2  },
    ironman: { lives: 1, speedMult: 1.1  },
  };

  // ---- Canvas ----
  let canvas, ctx;
  let lastTime = 0;
  let rafId = null;

  // ---- Camera shake ----
  let cameraShake = 0;

  // ---- Theme colors ----
  function getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      bg:     style.getPropertyValue('--bg-deep').trim()     || '#0a0a12',
      bg2:    style.getPropertyValue('--bg-surface').trim()  || '#141428',
      paddle: style.getPropertyValue('--paddle').trim()      || '#10b981',
      ball:   style.getPropertyValue('--ball').trim()        || '#ff006e',
      accent: style.getPropertyValue('--accent').trim()      || '#00d4ff',
      border: style.getPropertyValue('--border').trim()      || '#1e1e3a',
      text:   style.getPropertyValue('--text').trim()        || '#e0e0ff',
    };
  }

  // ---- Init ----
  function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    Paddle.attachInputs(canvas);

    // Click/tap to launch
    canvas.addEventListener('click', () => {
      if (state === STATE.WAITING || (state === STATE.PLAYING && Ball.isStuck())) launchBall();
    });
    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (state === STATE.WAITING || (state === STATE.PLAYING && Ball.isStuck())) launchBall();
    });

    UI.init();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    const wrapper = canvas.parentElement;
    const rect = wrapper.getBoundingClientRect();
    const maxW = Math.min(700, rect.width);
    const maxH = rect.height;
    const ratio = 3 / 4; // aspect ratio
    let w = maxW, h = Math.round(maxW * ratio);
    if (h > maxH) { h = maxH; w = Math.round(h / ratio); }
    canvas.width  = w;
    canvas.height = h;
    if (state !== STATE.MENU) Paddle.init(w, h, difficulty);
  }

  // ---- Game flow ----
  function startFromMenu() {
    level = 0;
    score = 0;
    const cfg = DIFF_CONFIG[difficulty] || DIFF_CONFIG.normal;
    lives = cfg.lives;
    maxLives = cfg.lives;
    combo = 0; maxCombo = 0; powerupsCollected = 0;

    if (firstPlay) {
      firstPlay = false;
      UI.showTutorial();
      return;
    }
    startLevel();
  }

  function onTutorialClosed() {
    startLevel();
  }

  function startLevel() {
    UI.showScreen('game');
    Audio.startMusic();

    // Resize canvas AFTER showing the screen so getBoundingClientRect works
    resizeCanvas();

    Powerups.reset();
    Particles.clear();
    Ball.resetAll();

    const w = canvas.width, h = canvas.height;
    Paddle.init(w, h, difficulty);
    const lvlDef = Blocks.build(canvas, level);
    const cfg = DIFF_CONFIG[difficulty] || DIFF_CONFIG.normal;
    const speedMult = lvlDef.speedMult * cfg.speedMult;
    Ball.setSpeedMult(speedMult);
    Ball.reset(w, h, Paddle.getX(), Paddle.getW());

    combo = 0;
    updateHUD();
    state = STATE.WAITING;
    UI.showOverlayStart(true);

    if (rafId) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function launchBall() {
    // Allow launch in WAITING state, OR in PLAYING when ball is stuck (sticky powerup)
    if (state === STATE.WAITING) {
      Ball.launch(Paddle.getX(), Paddle.getW());
      state = STATE.PLAYING;
      UI.showOverlayStart(false);
    } else if (state === STATE.PLAYING && Ball.isStuck()) {
      Ball.launch(Paddle.getX(), Paddle.getW());
    }
  }

  function onSpacePress() {
    if (state === STATE.WAITING) { launchBall(); return; }
    if (state === STATE.PLAYING && Ball.isStuck()) { launchBall(); return; }
    if (state === STATE.PLAYING || state === STATE.PAUSED) togglePause();
  }

  function togglePause() {
    if (state === STATE.PLAYING) {
      state = STATE.PAUSED;
      UI.showScreen('pause');
      Audio.stopMusic();
    } else if (state === STATE.PAUSED) {
      resume();
    }
  }

  function resume() {
    UI.showScreen('game');
    state = STATE.PLAYING;
    lastTime = performance.now();
    Audio.startMusic();
    rafId = requestAnimationFrame(loop);
  }

  function restartLevel() {
    state = STATE.MENU; // prevent loop conflict
    startLevel();
  }

  function nextLevel() {
    level++;
    if (level >= Blocks.getLevelCount()) {
      state = STATE.WIN;
      const best = UI.getBestScore();
      UI.saveScore(score, level);
      UI.showWin(score, Math.max(score, best));
      Audio.stopMusic();
      return;
    }
    startLevel();
  }

  function retry() {
    level = 0;
    score = 0;
    const cfg = DIFF_CONFIG[difficulty] || DIFF_CONFIG.normal;
    lives = cfg.lives;
    maxLives = cfg.lives;
    combo = 0; maxCombo = 0; powerupsCollected = 0;
    startLevel();
  }

  function toMenu() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    Audio.stopMusic();
    state = STATE.MENU;
    UI.showScreen('menu');
    Powerups.reset();
    Particles.clear();
    Ball.resetAll();
    UI.updateBestScore?.();
  }

  function setDifficulty(d) {
    difficulty = d;
  }

  // ---- Main loop ----
  function loop(timestamp) {
    if (state === STATE.PAUSED) return;

    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    update(dt);
    render();

    if (state === STATE.PLAYING || state === STATE.WAITING) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function update(dt) {
    Paddle.update();
    Particles.update(dt);
    Powerups.update(dt, canvas.height);

    // In WAITING state, keep the ball stuck to the paddle
    if (state === STATE.WAITING) {
      const pBox = Paddle.getHitbox();
      Ball.update(dt, canvas.width, canvas.height, pBox.x, pBox.y, pBox.w, pBox.h, false);
      return;
    }

    if (state !== STATE.PLAYING) return;

    // Show launch hint when ball is stuck (sticky powerup)
    UI.showOverlayStart(Ball.isStuck());

    const pBox = Paddle.getHitbox();
    const penetrating = Powerups.isActive('penetrating');

    const { lostCount, collisions } = Ball.update(
      dt, canvas.width, canvas.height,
      pBox.x, pBox.y, pBox.w, pBox.h,
      penetrating
    );

    // Process collisions
    let gotCombo = false;
    collisions.forEach(c => {
      if (c.type === 'block') {
        const pts = Math.round(c.block.pts * (1 + combo * 0.1));
        score += pts;
        combo++;
        if (combo > maxCombo) maxCombo = combo;
        gotCombo = true;
        Audio.play('blockBreak', c.block.row);
        UI.showComboPopup(combo);
        cameraShake = Math.min(cameraShake + 2, 6);
      } else if (c.type === 'blockHit') {
        Audio.play('blockBreak', c.block.row);
      } else if (c.type === 'paddle') {
        Paddle.shake();
        cameraShake = Math.min(cameraShake + 1, 3);
      }
    });
    if (!gotCombo && collisions.some(c => c.type === 'paddle')) {
      combo = 0;
    }

    // Check power-up collection
    const collected = Powerups.checkCollect(pBox.x, pBox.y, pBox.w, pBox.h, {
      multiball: () => { Ball.spawnMultiBall(); powerupsCollected++; },
      largePaddle: () => { Paddle.setLarge(true); powerupsCollected++; setTimeout(() => Paddle.setLarge(false), 15000); },
      fastBall: () => { const m = Ball.getSpeedMult(); Ball.setSpeedMult(m * 2); powerupsCollected++; },
      slowBall: () => { const m = Ball.getSpeedMult(); Ball.setSpeedMult(m * 0.5); powerupsCollected++; },
      penetrating: () => { powerupsCollected++; },
      sticky: () => { Ball.setStuck(true); powerupsCollected++; },
      extraLife: () => { lives = Math.min(lives + 1, maxLives + 2); UI.triggerVibration(100); powerupsCollected++; },
      bomb: () => {
        // Destroy nearby blocks
        const bList = Blocks.list();
        let killed = 0;
        bList.forEach(b => {
          if (!b.dead && b.type !== 'crystal') {
            if (killed < 9) { b.dead = true; score += b.pts; killed++; Particles.blockBreak(b.x, b.y, b.w, b.h, b.color); }
          }
        });
        powerupsCollected++;
      }
    });

    // Revert timed powerup effects when deactivated
    if (!Powerups.isActive('fastBall') && !Powerups.isActive('slowBall')) {
      const cfg = DIFF_CONFIG[difficulty] || DIFF_CONFIG.normal;
      Ball.setSpeedMult(Blocks.getLevelSpeedMult(level) * cfg.speedMult);
    }

    // Handle ball loss
    if (lostCount > 0 && Ball.count() === 0) {
      lives -= lostCount;
      Audio.play('lifeLost');
      cameraShake = 8;
      UI.triggerVibration(200);
      combo = 0;

      if (lives <= 0) {
        lives = 0;
        updateHUD();
        endGame();
        return;
      }

      // Reset & wait
      const cfg = DIFF_CONFIG[difficulty] || DIFF_CONFIG.normal;
      Ball.setSpeedMult(Blocks.getLevelSpeedMult(level) * cfg.speedMult);
      Ball.reset(canvas.width, canvas.height, Paddle.getX(), Paddle.getW());
      Powerups.reset();
      state = STATE.WAITING;
      UI.showOverlayStart(true);
    }

    // Level complete
    if (Blocks.allDestroyed()) {
      state = STATE.LEVEL_COMPLETE;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      UI.saveScore(score, level + 1);
      UI.showLevelComplete(score, maxCombo, powerupsCollected, level);
      Audio.stopMusic();
      // Confetti
      for (let i = 0; i < 8; i++) {
        setTimeout(() => Particles.confetti(
          Math.random() * canvas.width, Math.random() * canvas.height * 0.5
        ), i * 120);
      }
      return;
    }

    // Camera shake decay
    cameraShake *= 0.8;
    if (cameraShake < 0.1) cameraShake = 0;

    updateHUD();
  }

  function endGame() {
    state = STATE.GAME_OVER;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    Audio.stopMusic();
    const best = UI.getBestScore();
    UI.saveScore(score, level + 1);
    UI.showGameOver(score, level + 1, Math.max(score, best));
  }

  // ---- Render ----
  function render() {
    const colors = getThemeColors();
    ctx.save();

    // Camera shake
    if (cameraShake > 0.1) {
      ctx.translate(
        (Math.random() - 0.5) * cameraShake,
        (Math.random() - 0.5) * cameraShake
      );
    }

    // Background
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines (subtle)
    drawGrid(colors);

    // Render game objects
    Blocks.draw(ctx);
    Powerups.draw(ctx);
    Particles.draw(ctx);
    Ball.draw(ctx, colors.ball);
    Paddle.draw(ctx, colors.paddle);

    ctx.restore();
  }

  function drawGrid(colors) {
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 0.5;
    const spacing = 30;
    for (let x = 0; x < canvas.width; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    ctx.restore();
  }

  function updateHUD() {
    UI.updateScore(score);
    UI.updateLevel(level + 1, Blocks.getLevelCount());
    UI.updateLives(lives, maxLives);
    UI.updateCombo(combo);
    UI.updatePowerupBar(Powerups.getActiveList());
  }

  // ---- Ready ----
  window.addEventListener('DOMContentLoaded', init);

  return {
    startFromMenu, onTutorialClosed, startLevel, launchBall, onSpacePress,
    togglePause, resume, restartLevel, nextLevel, retry, toMenu,
    setDifficulty,
  };
})();