/* js/paddle.js — Contrôle du paddle */

const Paddle = (() => {
  const BASE_W_RATIO = 0.18; // % de la largeur du canvas
  let x = 0, y = 0, w = 0, h = 14;
  let canvasW = 0, canvasH = 0;
  let targetX = 0;
  let widthMult = 1;
  let glowing = false;
  let shakeX = 0;

  function init(cW, cH, diff) {
    canvasW = cW; canvasH = cH;
    // Adjust paddle size by difficulty
    const diffMult = { easy: 1.3, normal: 1.0, hard: 0.7, ironman: 0.55 }[diff] || 1;
    widthMult = diffMult;
    recalc();
    x = (canvasW - w) / 2;
    targetX = x;
    y = canvasH - 28;
  }

  function recalc() {
    w = Math.round(canvasW * BASE_W_RATIO * widthMult);
    w = Math.max(40, Math.min(canvasW * 0.5, w));
  }

  function setLarge(isLarge) {
    widthMult = isLarge ? widthMult * 2 : widthMult / 2;
    recalc();
    // Keep in bounds
    x = Math.max(0, Math.min(canvasW - w, x));
  }

  function moveToX(mx) {
    targetX = mx - w / 2;
  }

  function update() {
    // Keyboard movement
    if (keys.left)  targetX -= KEYBOARD_SPEED;
    if (keys.right) targetX += KEYBOARD_SPEED;

    // Smoother lerp when using keyboard
    const lerpFactor = (keys.left || keys.right) ? 0.12 : 0.25;
    x += (targetX - x) * lerpFactor;
    // Boundaries
    x = Math.max(0, Math.min(canvasW - w, x));
    // Shake decay
    if (shakeX > 0.1) { shakeX *= 0.7; } else { shakeX = 0; }
  }

  function draw(ctx, color) {
    ctx.save();
    const drawX = x + (shakeX * (Math.random() > 0.5 ? 1 : -1));
    const drawY = y;

    // Glow effect
    ctx.shadowBlur = glowing ? 24 : 12;
    ctx.shadowColor = color;

    // Main paddle body
    const grad = ctx.createLinearGradient(drawX, drawY, drawX, drawY + h);
    grad.addColorStop(0, lightenColor(color, 40));
    grad.addColorStop(0.4, color);
    grad.addColorStop(1, shadeColor(color, -30));
    ctx.fillStyle = grad;

    roundRect(ctx, drawX, drawY, w, h, 5);
    ctx.fill();

    // Shine stripe
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(drawX + 4, drawY + 2, w - 8, 3);

    // Edge highlights
    ctx.strokeStyle = lightenColor(color, 60);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(drawX + 5, drawY);
    ctx.lineTo(drawX + w - 5, drawY);
    ctx.stroke();

    ctx.restore();
  }

  function getHitbox() { return { x, y, w, h }; }
  function getX() { return x; }
  function getY() { return y; }
  function getW() { return w; }
  function getH() { return h; }
  function setGlowing(v) { glowing = v; }
  function shake() { shakeX = 5; }
  function resetWidth(diff) {
    const diffMult = { easy: 1.3, normal: 1.0, hard: 0.7, ironman: 0.55 }[diff] || 1;
    widthMult = diffMult;
    recalc();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function lightenColor(hex, amt) { return shadeColor(hex, amt); }
  function shadeColor(hex, pct) {
    try {
      const num = parseInt(hex.replace('#',''), 16);
      const r = Math.min(255, Math.max(0, (num >> 16) + pct));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + pct));
      const b = Math.min(255, Math.max(0, (num & 0xff) + pct));
      return `rgb(${r},${g},${b})`;
    } catch { return hex; }
  }

  // ---- Input handlers ----
  let canvas = null;
  const keys = { left: false, right: false };
  const KEYBOARD_SPEED = 3;

  function attachInputs(cvs) {
    canvas = cvs;
    // Mouse
    cvs.addEventListener('mousemove', onMouseMove);
    // Touch
    cvs.addEventListener('touchstart', onTouch, { passive: false });
    cvs.addEventListener('touchmove', onTouch, { passive: false });
    // Keyboard
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  function onKeyDown(e) {
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') { keys.left  = true; e.preventDefault(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.right = true; e.preventDefault(); }
  }

  function onKeyUp(e) {
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') keys.left  = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    moveToX((e.clientX - rect.left) * scaleX);
  }

  function onTouch(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const touch = e.touches[0];
    if (touch) moveToX((touch.clientX - rect.left) * scaleX);
  }

  return {
    init, update, draw, getHitbox,
    getX, getY, getW, getH,
    setLarge, resetWidth, setGlowing, shake,
    attachInputs, moveToX
  };
})();