/* js/ball.js — Logique balle + collisions */

const Ball = (() => {
  const balls = [];
  const BASE_SPEED = 5;
  const BALL_RADIUS = 7;
  let speedMult = 1.0;
  let stuck = false;   // sticky power-up
  let stickOffsetX = 0;

  function create(x, y, vx, vy) {
    balls.push({ x, y, vx, vy, trail: [] });
  }

  function reset(canvasW, canvasH, paddleX, paddleW) {
    balls.length = 0;
    stuck = true;
    stickOffsetX = 0;
    const spd = BASE_SPEED * speedMult;
    const bx = paddleX + paddleW / 2;
    const by = canvasH - 60;
    balls.push({ x: bx, y: by, vx: 0, vy: -spd, trail: [] });
  }

  function launch(paddleX, paddleW) {
    if (!stuck) return;
    stuck = false;
    const spd = BASE_SPEED * speedMult;
    balls.forEach(b => {
      b.vx = (Math.random() - 0.5) * spd * 0.6;
      b.vy = -spd;
      normalizeSpeed(b);
    });
    // Deactivate sticky after launching so the ball doesn't re-stick on next paddle hit
    if (typeof Powerups !== 'undefined' && Powerups.isActive('sticky')) {
      Powerups.deactivate('sticky');
    }
  }

  function normalizeSpeed(b) {
    const spd = BASE_SPEED * speedMult;
    const cur = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (cur > 0) {
      b.vx = (b.vx / cur) * spd;
      b.vy = (b.vy / cur) * spd;
    }
  }

  function update(dt, canvasW, canvasH, paddleX, paddleY, paddleW, paddleH, penetrating) {
    let lostCount = 0;

    if (stuck) {
      balls.forEach(b => {
        b.x = paddleX + paddleW / 2 + stickOffsetX;
        b.y = paddleY - BALL_RADIUS - 1;
        b.trail = [];
      });
      return { lostCount: 0, collisions: [] };
    }

    const collisions = [];

    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];

      // Trail
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 8) b.trail.shift();

      // Move
      b.x += b.vx;
      b.y += b.vy;

      // Wall collisions
      if (b.x - BALL_RADIUS < 0) {
        b.x = BALL_RADIUS;
        b.vx = Math.abs(b.vx);
        Audio.play('wallHit');
      }
      if (b.x + BALL_RADIUS > canvasW) {
        b.x = canvasW - BALL_RADIUS;
        b.vx = -Math.abs(b.vx);
        Audio.play('wallHit');
      }
      if (b.y - BALL_RADIUS < 0) {
        b.y = BALL_RADIUS;
        b.vy = Math.abs(b.vy);
        Audio.play('wallHit');
      }

      // Paddle collision
      if (
        b.vy > 0 &&
        b.y + BALL_RADIUS >= paddleY &&
        b.y + BALL_RADIUS <= paddleY + paddleH + 6 &&
        b.x >= paddleX - BALL_RADIUS &&
        b.x <= paddleX + paddleW + BALL_RADIUS
      ) {
        b.y = paddleY - BALL_RADIUS;
        const rel = (b.x - paddleX) / paddleW; // 0 = left, 1 = right
        const angle = (rel - 0.5) * Math.PI * 0.7; // -63° to +63°
        const spd = BASE_SPEED * speedMult;
        b.vx = Math.sin(angle) * spd;
        b.vy = -Math.cos(angle) * spd;

        // Sticky
        if (Powerups.isActive('sticky')) {
          stuck = true;
          stickOffsetX = b.x - (paddleX + paddleW / 2);
        }

        Audio.play('paddleHit');
        collisions.push({ type: 'paddle' });
      }

      // Block collisions
      const blockList = Blocks.list();
      for (const block of blockList) {
        if (block.dead) continue;

        const closestX = clamp(b.x, block.x, block.x + block.w);
        const closestY = clamp(b.y, block.y, block.y + block.h);
        const dx = b.x - closestX;
        const dy = b.y - closestY;

        if (dx * dx + dy * dy < BALL_RADIUS * BALL_RADIUS) {
          const destroyed = Blocks.hitBlock(block);
          const bx = block.x + block.w / 2;
          const by = block.y + block.h / 2;

          if (destroyed) {
            Particles.blockBreak(block.x, block.y, block.w, block.h, block.color);
            Powerups.spawnFromBlock(block.x, block.y, block.w, block.h);
            collisions.push({ type: 'block', block, bx, by });
          } else {
            collisions.push({ type: 'blockHit', block });
          }

          if (!penetrating) {
            // Determine bounce side
            const overlapX = BALL_RADIUS - Math.abs(dx);
            const overlapY = BALL_RADIUS - Math.abs(dy);
            if (overlapX < overlapY) {
              b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
            } else {
              b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
            }
            // Push out
            if (overlapX < overlapY) b.x += dx > 0 ? overlapX : -overlapX;
            else b.y += dy > 0 ? overlapY : -overlapY;
          }
          break; // one block per frame per ball
        }
      }

      // Ball lost
      if (b.y - BALL_RADIUS > canvasH) {
        balls.splice(i, 1);
        lostCount++;
      }
    }

    return { lostCount, collisions };
  }

  function draw(ctx, color) {
    balls.forEach(b => {
      // Trail
      b.trail.forEach((t, i) => {
        const alpha = (i / b.trail.length) * 0.4;
        const r = BALL_RADIUS * (i / b.trail.length) * 0.7;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Ball glow
      ctx.save();
      ctx.shadowBlur = 16;
      ctx.shadowColor = color;
      const grad = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, BALL_RADIUS);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.3, color);
      grad.addColorStop(1, shadeColor(color, -40));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Trail particles
      Particles.ballTrail(b.x, b.y, color);
    });
  }

  function spawnMultiBall() {
    const ref = balls[0];
    if (!ref) return;
    const spd = BASE_SPEED * speedMult;
    for (let i = 0; i < 2; i++) {
      const angle = (Math.PI * 2 / 3) * (i + 1) - Math.PI / 2;
      balls.push({
        x: ref.x, y: ref.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        trail: []
      });
    }
  }

  function setSpeedMult(m) {
    speedMult = m;
    balls.forEach(normalizeSpeed);
  }

  function count() { return balls.length; }
  function getRadius() { return BALL_RADIUS; }
  function isStuck() { return stuck; }
  function setStuck(v) { stuck = v; }

  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  function shadeColor(hex, pct) {
    try {
      const num = parseInt(hex.replace('#',''), 16);
      const r = Math.min(255, Math.max(0, (num >> 16) + pct));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + pct));
      const b = Math.min(255, Math.max(0, (num & 0xff) + pct));
      return `rgb(${r},${g},${b})`;
    } catch { return hex; }
  }

  function reset2() {
    balls.length = 0;
    stuck = false;
    speedMult = 1.0;
    stickOffsetX = 0;
  }

  return {
    create, reset, launch, update, draw,
    spawnMultiBall, setSpeedMult, count,
    getRadius, isStuck, setStuck,
    getSpeedMult() { return speedMult; },
    getBaseSpeed() { return BASE_SPEED; },
    resetAll: reset2
  };
})();