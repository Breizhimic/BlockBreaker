/* js/particles.js — Système de particules */

const Particles = (() => {
  const pool = [];
  let enabled = true;

  function create({ x, y, color = '#fff', count = 8, speed = 3, life = 0.6, size = 3, type = 'spark' }) {
    if (!enabled) return;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const spd = speed * (0.5 + Math.random());
      pool.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life, maxLife: life,
        size: size * (0.5 + Math.random()),
        color,
        type,
        gravity: type === 'confetti' ? 0.08 : 0.02
      });
    }
  }

  function update(dt) {
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.96;
      p.life -= dt;
      if (p.life <= 0) pool.splice(i, 1);
    }
  }

  function draw(ctx) {
    pool.forEach(p => {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.type === 'confetti') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 1.5);
      } else {
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function blockBreak(x, y, w, h, color) {
    create({ x: x + w / 2, y: y + h / 2, color, count: 10, speed: 3.5, life: 0.5, size: 3 });
    // Ring burst
    create({ x: x + w / 2, y: y + h / 2, color: '#fff', count: 4, speed: 5, life: 0.3, size: 1.5 });
  }

  function confetti(x, y) {
    const colors = ['#ff006e','#00d4ff','#ffd700','#10b981','#a855f7'];
    colors.forEach(c => create({ x, y, color: c, count: 6, speed: 5, life: 1, size: 4, type: 'confetti' }));
  }

  function powerupCollect(x, y, color) {
    create({ x, y, color, count: 16, speed: 4, life: 0.6, size: 4 });
    create({ x, y, color: '#fff', count: 6, speed: 7, life: 0.4, size: 2 });
  }

  function ballTrail(x, y, color) {
    if (!enabled) return;
    pool.push({
      x, y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      life: 0.12, maxLife: 0.12,
      size: 3,
      color,
      type: 'spark',
      gravity: 0
    });
  }

  return {
    update, draw, blockBreak, confetti, powerupCollect, ballTrail,
    setEnabled(v) { enabled = v; },
    clear() { pool.length = 0; }
  };
})();
