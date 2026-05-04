/* js/ui.js — Gestion des écrans, HUD, overlays */

const UI = (() => {
  let currentScreen = 'menu';
  const screens = {};

  const TIPS = [
    "Touchez le bord du paddle pour créer des angles !", 
    "Collectez les power-ups qui tombent des blocs !",
    "Multi-Ball est ultra puissant — visez les coins !",
    "Bombe : détruit tous les blocs voisins !",
    "Les blocs acier résistent à 2 impacts.",
    "Les blocs cristal sont indestructibles — contournez-les !",
    "Un combo x10 triple votre score !",
    "Large Paddle dure 15 secondes, profitez-en !",
  ];

  function init() {
    // Cache screens
    document.querySelectorAll('.screen').forEach(s => screens[s.id] = s);

    // Generate stars
    generateStars();

    // Wire up basic buttons
    _on('btn-play', 'click', () => { Audio.play('menuClick'); Game.startFromMenu(); });
    _on('btn-scores', 'click', () => { Audio.play('menuClick'); showScores(); });
    _on('btn-settings', 'click', () => { Audio.play('menuClick'); showSettings(); });
    _on('btn-back-scores', 'click', () => { Audio.play('menuClick'); showScreen('menu'); });
    _on('btn-back-settings', 'click', () => { Audio.play('menuClick'); showScreen('menu'); });
    _on('btn-resume', 'click', () => { Audio.play('menuClick'); Game.resume(); });
    _on('btn-restart-level', 'click', () => { Audio.play('menuClick'); Game.restartLevel(); });
    _on('btn-to-menu-pause', 'click', () => { Audio.play('menuClick'); Game.toMenu(); });
    _on('btn-to-menu-go', 'click', () => { Audio.play('menuClick'); Game.toMenu(); });
    _on('btn-to-menu-lc', 'click', () => { Audio.play('menuClick'); Game.toMenu(); });
    _on('btn-to-menu-win', 'click', () => { Audio.play('menuClick'); Game.toMenu(); });
    _on('btn-next-level', 'click', () => { Audio.play('menuClick'); Game.nextLevel(); });
    _on('btn-retry', 'click', () => { Audio.play('menuClick'); Game.retry(); });
    _on('btn-play-again', 'click', () => { Audio.play('menuClick'); Game.retry(); });
    _on('btn-pause', 'click', () => Game.togglePause());
    _on('btn-mute', 'click', toggleMute);
    _on('btn-close-tutorial', 'click', () => { Audio.play('menuClick'); hideTutorial(); });
    _on('btn-clear-scores', 'click', clearScores);

    // Difficulty buttons
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Audio.play('menuClick');
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Game.setDifficulty(btn.dataset.diff);
        saveSettings();
      });
    });

    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Audio.play('menuClick');
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyTheme(btn.dataset.theme);
        saveSettings();
      });
    });

    // Settings controls
    const volSlider = document.getElementById('vol-slider');
    if (volSlider) {
      volSlider.addEventListener('input', e => {
        const v = parseInt(e.target.value);
        document.getElementById('vol-value').textContent = v + '%';
        Audio.setVolume(v);
      });
    }
    _toggleBtn('toggle-music', v => Audio.setMusicEnabled(v));
    _toggleBtn('toggle-vibration', v => { /* vibration flag set */ });
    _toggleBtn('toggle-particles', v => Particles.setEnabled(v));

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.code === 'Space') {
        e.preventDefault();
        Game.onSpacePress();
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        Game.togglePause();
      }
    });

    loadSettings();
    updateBestScore();
  }

  function _on(id, ev, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(ev, fn);
  }

  function _toggleBtn(id, onChange) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isOn = btn.dataset.state === 'on';
      btn.dataset.state = isOn ? 'off' : 'on';
      btn.textContent = isOn ? 'OFF' : 'ON';
      btn.classList.toggle('active', !isOn);
      onChange(!isOn);
    });
  }

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + name);
    if (target) target.classList.add('active');
    currentScreen = name;
  }

  function generateStars() {
    const container = document.getElementById('stars');
    if (!container) return;
    for (let i = 0; i < 80; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      const size = Math.random() * 2.5 + 0.5;
      star.style.cssText = `
        left:${Math.random()*100}%;
        top:${Math.random()*100}%;
        width:${size}px;
        height:${size}px;
        --dur:${2 + Math.random()*3}s;
        --delay:${Math.random()*3}s;
      `;
      container.appendChild(star);
    }
  }

  function applyTheme(name) {
    document.body.className = document.body.className.replace(/theme-\w+/, '');
    if (name !== 'neon') document.body.classList.add('theme-' + name);
  }

  function toggleMute() {
    const muted = !Audio.isMuted();
    Audio.setMuted(muted);
    const btn = document.getElementById('btn-mute');
    if (btn) btn.textContent = muted ? '🔇' : '🔊';
  }

  // ---- HUD Updates ----
  function updateScore(score) {
    const el = document.getElementById('hud-score');
    if (el) el.textContent = score.toLocaleString();
  }

  function updateLevel(current, total) {
    const el = document.getElementById('hud-level');
    if (el) el.textContent = `${current} / ${total}`;
  }

  function updateLives(lives, maxLives) {
    const el = document.getElementById('hud-lives');
    if (el) el.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, maxLives - lives));
  }

  function updateCombo(combo) {
    const el = document.getElementById('hud-combo');
    if (!el) return;
    el.textContent = `x${combo}`;
    el.classList.toggle('hot', combo >= 5);
  }

  function updatePowerupBar(actives) {
    const bar = document.getElementById('powerup-bar');
    const info = document.getElementById('pb-info');
    const fill = document.getElementById('pb-timer-fill');
    if (!bar || !info || !fill) return;

    if (actives.length === 0) {
      info.textContent = '—';
      fill.style.width = '0%';
      return;
    }
    const a = actives[0]; // Show first active
    const def = a.def;
    info.textContent = `${def.icon} ${def.label}`;
    if (def.duration > 0 && a.timer) {
      const pct = (a.timer / def.duration) * 100;
      fill.style.width = pct + '%';
    } else {
      fill.style.width = '100%';
    }
  }

  function showOverlayStart(visible) {
    const el = document.getElementById('overlay-start');
    if (el) el.classList.toggle('hidden', !visible);
  }

  // ---- Modals ----
  function showLevelComplete(score, combo, powerups, levelIndex) {
    document.getElementById('lc-score').textContent = score.toLocaleString();
    document.getElementById('lc-combo').textContent = `x${combo}`;
    document.getElementById('lc-powerups').textContent = powerups;
    // Stars
    let stars = '⭐';
    if (combo >= 5) stars = '⭐⭐';
    if (combo >= 10) stars = '⭐⭐⭐';
    document.getElementById('level-stars').textContent = stars;
    // Tip
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    document.getElementById('tip-box').textContent = '💡 ' + tip;
    showScreen('level-complete');
    Audio.play('levelComplete');
    flash('green');
  }

  function showGameOver(score, level, best) {
    document.getElementById('go-score').textContent = score.toLocaleString();
    document.getElementById('go-level').textContent = level;
    document.getElementById('go-best').textContent = best.toLocaleString();
    showScreen('gameover');
    Audio.play('gameOver');
    flash('red');
    triggerVibration(500);
  }

  function showWin(score, best) {
    document.getElementById('win-score').textContent = score.toLocaleString();
    document.getElementById('win-best').textContent = best.toLocaleString();
    showScreen('win');
    Audio.play('levelComplete');
    flash('green');
  }

  // ---- Flash ----
  function flash(color) {
    const el = document.getElementById('flash-overlay');
    if (!el) return;
    el.className = 'flash-overlay ' + color;
    setTimeout(() => el.className = 'flash-overlay hidden', 400);
  }

  // ---- Combo popup ----
  let comboTimer = null;
  function showComboPopup(combo) {
    if (combo < 3) return;
    const el = document.getElementById('combo-popup');
    if (!el) return;
    el.textContent = `COMBO x${combo} 🔥`;
    el.classList.remove('hidden');
    clearTimeout(comboTimer);
    comboTimer = setTimeout(() => el.classList.add('hidden'), 1200);
  }

  // ---- Tutorial ----
  function showTutorial(onClose) {
    const el = document.getElementById('tutorial-overlay');
    if (el) el.classList.remove('hidden');
  }
  function hideTutorial() {
    const el = document.getElementById('tutorial-overlay');
    if (el) el.classList.add('hidden');
    Game.onTutorialClosed();
  }

  // ---- Vibration ----
  function triggerVibration(ms) {
    const btn = document.getElementById('toggle-vibration');
    if (btn && btn.dataset.state === 'on' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }

  // ---- Scores ----
  function updateBestScore() {
    const best = getBestScore();
    const el = document.getElementById('menu-best-score');
    if (el) el.textContent = best > 0 ? `Meilleur score : ${best.toLocaleString()}` : 'Aucun score enregistré';
  }

  function saveScore(score, level) {
    const scores = getScores();
    scores.push({ score, level, date: new Date().toLocaleDateString('fr-FR') });
    scores.sort((a, b) => b.score - a.score);
    scores.splice(10);
    localStorage.setItem('bb_scores', JSON.stringify(scores));
    updateBestScore();
  }

  function getBestScore() {
    const scores = getScores();
    return scores.length > 0 ? scores[0].score : 0;
  }

  function getScores() {
    try { return JSON.parse(localStorage.getItem('bb_scores')) || []; }
    catch { return []; }
  }

  function showScores() {
    const scores = getScores();
    const list = document.getElementById('scores-list');
    if (!list) return;
    if (scores.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--text-dim);font-family:var(--font-mono);font-size:0.75rem;padding:20px">Aucun score enregistré</div>';
    } else {
      list.innerHTML = scores.map((s, i) => `
        <div class="score-entry">
          <span class="score-rank">#${i+1}</span>
          <span class="score-val">${s.score.toLocaleString()}</span>
          <span>Niveau ${s.level}</span>
          <span class="score-date">${s.date}</span>
        </div>`).join('');
    }
    showScreen('scores');
  }

  function showSettings() {
    showScreen('settings');
  }

  function clearScores() {
    localStorage.removeItem('bb_scores');
    showScores();
    updateBestScore();
  }

  // ---- Settings persistence ----
  function saveSettings() {
    const diff = document.querySelector('.diff-btn.active')?.dataset.diff || 'normal';
    const theme = document.querySelector('.theme-btn.active')?.dataset.theme || 'neon';
    localStorage.setItem('bb_settings', JSON.stringify({ diff, theme }));
  }

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('bb_settings'));
      if (!s) return;
      if (s.diff) {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('active', b.dataset.diff === s.diff));
        Game.setDifficulty(s.diff);
      }
      if (s.theme) {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === s.theme));
        applyTheme(s.theme);
      }
    } catch {}
  }

  return {
    init, showScreen, flash, showLevelComplete, showGameOver, showWin,
    updateScore, updateLevel, updateLives, updateCombo, updatePowerupBar,
    showOverlayStart, showComboPopup, showTutorial, hideTutorial,
    triggerVibration, saveScore, getBestScore,
    applyTheme, updateBestScore
  };
})();
