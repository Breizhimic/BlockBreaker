/* js/powerups.js — Système de power-ups */

const POWERUP_DEFS = {
  multiball:   { icon: '⚽', label: 'MULTI-BALL',    color: '#ff006e', duration: 0,   weight: 15 },
  largePaddle: { icon: '↔',  label: 'LARGE PADDLE',  color: '#10b981', duration: 15,  weight: 20 },
  fastBall:    { icon: '⚡',  label: 'FAST BALL',     color: '#ffd700', duration: 10,  weight: 12 },
  slowBall:    { icon: '🐢',  label: 'SLOW BALL',     color: '#00d4ff', duration: 10,  weight: 15 },
  penetrating: { icon: '💎',  label: 'PENETRATING',   color: '#c840e9', duration: 5,   weight: 8  },
  sticky:      { icon: '🪝',  label: 'STICKY',        color: '#ff9500', duration: 0,   weight: 12 },
  extraLife:   { icon: '❤️',  label: 'EXTRA VIE',     color: '#ff006e', duration: 0,   weight: 10 },
  bomb:        { icon: '💣',  label: 'BOMBE',         color: '#ff4400', duration: 0,   weight: 8  },
};

const Powerups = (() => {
  let falling = [];      // items falling on canvas
  let active = {};       // currently active effects
  let timers = {};       // countdowns for timed effects
  const SPAWN_CHANCE = 0.3;
  const FALL_SPEED = 2;
  const SIZE = 22;

  // Weighted random selection
  function randomType() {
    const keys = Object.keys(POWERUP_DEFS);
    const totalWeight = keys.reduce((s, k) => s + POWERUP_DEFS[k].weight, 0);
    let rand = Math.random() * totalWeight;
    for (const k of keys) {
      rand -= POWERUP_DEFS[k].weight;
      if (rand <= 0) return k;
    }
    return keys[0];
  }

  function rRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
  }

  function spawnFromBlock(bx, by, bw, bh) {
    if (Math.random() > SPAWN_CHANCE) return;
    const type = randomType();
    const def = POWERUP_DEFS[type];
    falling.push({
      x: bx + bw / 2 - SIZE / 2,
      y: by + bh / 2,
      type, def,
      vy: FALL_SPEED,
      age: 0
    });
  }

  function update(dt, canvasH) {
    // Update falling items
    for (let i = falling.length - 1; i >= 0; i--) {
      const p = falling[i];
      p.y += p.vy;
      p.age += dt;
      if (p.y > canvasH + SIZE) falling.splice(i, 1);
    }
    // Update timers
    for (const key of Object.keys(timers)) {
      timers[key] -= dt;
      if (timers[key] <= 0) {
        deactivate(key);
      }
    }
  }

  function checkCollect(paddleX, paddleY, paddleW, paddleH, callbacks) {
    for (let i = falling.length - 1; i >= 0; i--) {
      const p = falling[i];
      const px = p.x + SIZE / 2;
      const py = p.y + SIZE / 2;
      if (
        px > paddleX && px < paddleX + paddleW &&
        py > paddleY && py < paddleY + paddleH
      ) {
        falling.splice(i, 1);
        activate(p.type, callbacks);
        return p;
      }
    }
    return null;
  }

  function activate(type, callbacks) {
    const def = POWERUP_DEFS[type];
    Audio.play('powerupCollect');
    active[type] = true;

    if (def.duration > 0) {
      timers[type] = def.duration;
    }

    if (callbacks && callbacks[type]) callbacks[type](def);
  }

  function deactivate(type) {
    delete active[type];
    delete timers[type];
  }

  function draw(ctx) {
    falling.forEach(p => {
      const x = p.x, y = p.y;
      const pulse = 0.85 + Math.sin(p.age * 6) * 0.15;

      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = p.def.color;

      // Background pill
      ctx.fillStyle = 'rgba(10,10,20,0.85)';
      rRect(ctx, x, y, SIZE, SIZE, 6);
      ctx.fill();

      // Colored border
      ctx.strokeStyle = p.def.color;
      ctx.lineWidth = 1.5 * pulse;
      rRect(ctx, x, y, SIZE, SIZE, 6);
      ctx.stroke();

      // Icon
      ctx.font = `${SIZE * 0.55}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      ctx.fillText(p.def.icon, x + SIZE / 2, y + SIZE / 2);

      ctx.restore();
    });
  }

  function isActive(type) { return !!active[type]; }
  function getTimer(type) { return timers[type] || 0; }
  function getDuration(type) { return POWERUP_DEFS[type]?.duration || 0; }
  function getActiveList() { return Object.keys(active).map(k => ({ type: k, def: POWERUP_DEFS[k], timer: timers[k] })); }

  function reset() {
    falling = [];
    active = {};
    timers = {};
  }

  return {
    spawnFromBlock, update, checkCollect, draw,
    isActive, getTimer, getDuration, getActiveList,
    deactivate, reset,
    getDefs() { return POWERUP_DEFS; }
  };
})();
