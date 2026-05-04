/* js/blocks.js — Gestion des blocs et niveaux */

const BLOCK_COLORS = {
  1: { fill: '#ff2055', pts: 10 },
  2: { fill: '#ff6600', pts: 20 },
  3: { fill: '#ffd700', pts: 30 },
  4: { fill: '#00e676', pts: 40 },
  5: { fill: '#00d4ff', pts: 50 },
  6: { fill: '#c840e9', pts: 60 },
};

const BLOCK_TYPES = {
  normal:   { hits: 1, label: null },
  steel:    { hits: 2, label: '⬡' },
  gold:     { hits: 1, label: '★', multiplier: 2 },
  crystal:  { hits: Infinity, label: '◈' }
};

const Blocks = (() => {
  let blocks = [];
  const PADDING = 6;
  const TOP_OFFSET = 12;

  // Level definitions: [ [row of color ids] ]
  // 0 = empty, 7 = steel, 8 = gold, 9 = crystal
  const LEVELS = [
    // Level 1: Basic 6x5
    {
      cols: 6, rows: 5,
      grid: null, // auto-generated gradient
      speedMult: 1.0,
    },
    // Level 2: 7x6, slightly faster
    {
      cols: 7, rows: 6,
      grid: null,
      speedMult: 1.15,
    },
    // Level 3: Steel blocks appear
    {
      cols: 7, rows: 6,
      grid: [
        [1,1,7,1,1,7,1],
        [2,2,2,2,2,2,2],
        [3,7,3,3,3,7,3],
        [4,4,4,4,4,4,4],
        [5,7,5,5,5,7,5],
        [6,6,6,6,6,6,6],
      ],
      speedMult: 1.25,
    },
    // Level 4: Diamond pattern + gold
    {
      cols: 8, rows: 6,
      grid: [
        [0,0,0,8,8,0,0,0],
        [0,0,5,5,5,5,0,0],
        [0,4,4,4,4,4,4,0],
        [3,3,3,8,8,3,3,3],
        [2,2,7,2,2,7,2,2],
        [1,1,1,1,1,1,1,1],
      ],
      speedMult: 1.35,
    },
    // Level 5: Boss level with crystal obstacles
    {
      cols: 8, rows: 7,
      grid: [
        [9,1,1,1,1,1,1,9],
        [1,2,2,2,2,2,2,1],
        [1,2,7,8,8,7,2,1],
        [1,2,8,9,9,8,2,1],
        [1,2,7,8,8,7,2,1],
        [1,2,2,2,2,2,2,1],
        [9,1,1,1,1,1,1,9],
      ],
      speedMult: 1.5,
    },
  ];

  function buildBlocks(canvas, levelIndex) {
    blocks = [];
    const lvl = LEVELS[Math.min(levelIndex, LEVELS.length - 1)];
    const { cols, rows } = lvl;

    const canvasW = canvas.width;
    const usableW = canvasW - PADDING * 2;
    const blockW = Math.floor(usableW / cols) - PADDING;
    const blockH = Math.min(22, blockW * 0.45);
    const totalBlockH = (blockH + PADDING) * rows;
    const startX = PADDING;
    const startY = TOP_OFFSET;

    const grid = lvl.grid || generateGradientGrid(cols, rows);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const code = grid[r][c];
        if (code === 0) continue;

        let type = 'normal';
        let colorId = code;
        if (code === 7) { type = 'steel'; colorId = 5; }
        else if (code === 8) { type = 'gold'; colorId = 3; }
        else if (code === 9) { type = 'crystal'; colorId = 5; }

        const typeInfo = BLOCK_TYPES[type];
        const colorInfo = BLOCK_COLORS[Math.min(colorId, 6)] || BLOCK_COLORS[1];

        blocks.push({
          x: startX + c * (blockW + PADDING),
          y: startY + r * (blockH + PADDING),
          w: blockW,
          h: blockH,
          type,
          hitsLeft: typeInfo.hits,
          maxHits: typeInfo.hits,
          color: colorInfo.fill,
          pts: colorInfo.pts * (typeInfo.multiplier || 1),
          label: typeInfo.label,
          row: r,
          dead: false,
          shakeX: 0
        });
      }
    }
    return lvl;
  }

  function generateGradientGrid(cols, rows) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      const colorId = r + 1;
      for (let c = 0; c < cols; c++) row.push(colorId);
      grid.push(row);
    }
    return grid;
  }

  function hitBlock(block) {
    if (block.type === 'crystal') return false; // indestructible
    block.hitsLeft--;
    block.shakeX = 4;
    if (block.hitsLeft <= 0) {
      block.dead = true;
      return true; // destroyed
    }
    // Steel: change color on second hit
    if (block.type === 'steel') {
      block.color = '#556677';
    }
    return false;
  }

  function draw(ctx) {
    blocks.forEach(b => {
      if (b.dead) return;

      // Shake
      if (b.shakeX > 0) { b.shakeX *= 0.6; if (b.shakeX < 0.1) b.shakeX = 0; }

      const x = b.x + b.shakeX * (Math.random() > 0.5 ? 1 : -1);
      const y = b.y;

      // Shadow/glow
      ctx.save();
      ctx.shadowBlur = b.type === 'gold' ? 14 : (b.type === 'crystal' ? 20 : 8);
      ctx.shadowColor = b.type === 'crystal' ? '#aaddff' : b.color;

      // Background fill
      const pct = b.hitsLeft / b.maxHits;
      ctx.fillStyle = shadeColor(b.color, b.type === 'steel' ? -20 : 0);
      roundRect(ctx, x, y, b.w, b.h, 3);
      ctx.fill();

      // Shine overlay
      const grad = ctx.createLinearGradient(x, y, x, y + b.h);
      grad.addColorStop(0, 'rgba(255,255,255,0.25)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      grad.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, b.w, b.h, 3);
      ctx.fill();

      // Crystal shimmer
      if (b.type === 'crystal') {
        ctx.strokeStyle = 'rgba(180,220,255,0.7)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, x + 1, y + 1, b.w - 2, b.h - 2, 2);
        ctx.stroke();
      }

      // Damage indicator for steel
      if (b.type === 'steel' && b.hitsLeft < b.maxHits) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x + 2, y + b.h - 4, (b.w - 4) * pct, 2);
      }

      // Label
      if (b.label) {
        ctx.fillStyle = b.type === 'crystal' ? '#aaddff' : '#fff';
        ctx.font = `bold ${Math.min(b.h * 0.7, 14)}px Orbitron, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(b.label, x + b.w / 2, y + b.h / 2);
      }

      ctx.restore();
    });
  }

  function getDestroyable() {
    return blocks.filter(b => !b.dead && b.type !== 'crystal');
  }

  function allDestroyed() {
    return blocks.every(b => b.dead || b.type === 'crystal');
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

  function shadeColor(hex, pct) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + pct));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + pct));
    const b = Math.min(255, Math.max(0, (num & 0xff) + pct));
    return `rgb(${r},${g},${b})`;
  }

  return {
    build: buildBlocks,
    draw,
    list() { return blocks; },
    getDestroyable,
    allDestroyed,
    hitBlock,
    getLevelCount() { return LEVELS.length; },
    getLevelSpeedMult(i) { return LEVELS[Math.min(i, LEVELS.length-1)].speedMult; }
  };
})();
