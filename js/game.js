/* ===== 游戏主逻辑 ===== */
(() => {
  // ---- 画布 ----
  const canvas = document.getElementById('game');
  canvas.width = CFG.W;
  canvas.height = CFG.H;
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ovTitle');
  const ovText = document.getElementById('ovText');
  const startBtn = document.getElementById('startBtn');

  // ---- 状态 ----
  let state = 'menu';            // menu | playing | over
  let score = 0, level = 1;

  const { W, H, SHORE_X, WATER_Y, WATER_BOTTOM, ROD_LEN, LINE_LEN, HOOK_DROP, BAIT_DEPTH } = CFG;

  // 钓竿
  const rod = {
    x: 150, y: WATER_Y - 30,                // 竿尖（由底座 + 竿长推算）
    baseX: 150, baseY: WATER_Y - 80,        // 竿柄（握在手里，可沿岸边走动）
    baitInWater: false
  };
  let baitX = rod.x, baitY = WATER_Y;       // 饵料实际位置（线尾，受重力下垂）
  const line = {
    phase: 'idle',              // idle | sinking | waiting | bite | reeling | hooked | dropping
    sinkP: 0, reelT: 0, dropT: 0,
    reelStartX: 0, reelStartY: 0,            // 收杆起点（虾的位置）
    biteTimer: 0,
    shake: 0, wiggle: 0
  };
  let dropStartX = 0, dropStartY = 0;        // 投放进桶的起点
  let dropReady = false;                     // 虾是否可以在桶上方投放
  let bucketCrays = [];                      // 桶里的小龙虾（探头展示）

  // 小龙虾 & 特效
  let crays = [];
  let ripples = [];   // 波纹
  let bubbles = [];   // 气泡
  let particles = []; // 得分飘字/星星

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  const curLevel = () => LEVELS[Math.min(level - 1, LEVELS.length - 1)];

  // ---- 小龙虾生成（只生活在水底） ----
  function makeCray() {
    const c = curLevel();
    return {
      x: rand(SHORE_X + 40, W - 40),
      y: rand(WATER_BOTTOM - 55, WATER_BOTTOM - 24),   // 只在水底活动
      size: rand(10, 26),                       // 大小差异明显
      vx: (Math.random() < 0.5 ? -1 : 1) * rand(0.2, c.speed),
      vy: (Math.random() < 0.5 ? -1 : 1) * rand(0.15, 0.6),
      dir: Math.random() < 0.5 ? -1 : 1,
      wiggle: rand(0, Math.PI * 2),
      hooked: false
    };
  }

  function resetCrays() {
    const c = curLevel();
    crays = [];
    for (let i = 0; i < c.cray; i++) crays.push(makeCray());
  }

  // ---- 游戏流程 ----
  function startGame() {
    score = 0; level = 1;
    overlay.classList.add('hidden');
    state = 'playing';
    rod.baitInWater = false; line.phase = 'idle';
    rod.x = 150; rod.y = WATER_Y - 30;
    resetCrays();
    ripples = []; bubbles = []; particles = [];
    bucketCrays = []; dropReady = false;
    updateHUD();
  }

  function levelUp() {
    level++;
    if (level > LEVELS.length) {
      state = 'over';
      ovTitle.textContent = '🏆 通关啦！';
      ovText.innerHTML = `你征服了所有水域，共钓到 <b style="color:#ffd966">${score}</b> 只小龙虾！`;
      startBtn.textContent = '再玩一次';
      overlay.classList.remove('hidden');
      return;
    }
    const c = LEVELS[level - 1];
    resetCrays();
    particles.push({ type: 'text', x: W / 2, y: H / 2, text: `🎉 进入 ${c.name}！`, life: 180, color: '#ffd966' });
    updateHUD();
  }

  // ---- 点击交互：放饵/收杆/投放进桶 ----
  function onCanvasClick(e) {
    if (state !== 'playing') return;

    // 咬钩 → 收杆（把虾拉出水面）
    if (line.phase === 'bite') {
      line.phase = 'reeling';
      line.reelT = 0;
      line.reelStartX = baitX;
      line.reelStartY = baitY;
      spawnBubbles(baitX, baitY, 12);
      return;
    }
    if (line.phase === 'reeling' || line.phase === 'dropping') return;

    // 虾挂在钩上 → 对准桶投放
    if (line.phase === 'hooked') {
      const h = crays.find(c => c.hooked);
      if (h && h.y < WATER_Y && Math.abs(h.x - CFG.BUCKET.x) < 70) {
        line.phase = 'dropping';
        line.dropT = 0;
        dropStartX = h.x; dropStartY = h.y;
        dropReady = false;
        spawnBubbles(h.x, h.y, 6);
      }
      return;
    }

    if (!rod.baitInWater) {
      // 竿尖必须伸到水面上方才能放饵
      if (rod.x < SHORE_X + 15) return;
      rod.baitInWater = true;
      baitX = rod.x;
      baitY = WATER_Y + 4;      // 饵料从水面开始下沉
      line.phase = 'sinking';
      line.sinkP = 0;
      ripples.push({ x: rod.x, y: WATER_Y + 8, r: 4, max: 34, life: 40 });
      bubbles.push({ x: rod.x + rand(-4, 4), y: WATER_Y + 10, r: 3, vy: -rand(1, 2), life: 40 });
    } else {
      rod.baitInWater = false;
      line.phase = 'idle';
      spawnBubbles(baitX, baitY, 6);
    }
  }

  // ---- 更新逻辑 ----
  function update() {
    const t = performance.now() / 1000;

    // 钓竿物理：固定长度，底座沿岸边走动，竿尖指向鼠标方向
    rod.baseX = clamp(pointer.x, 60, SHORE_X - 26);
    rod.baseY = WATER_Y - 80;
    const theta = clamp(Math.atan2(pointer.y - rod.baseY, 55), -0.7, 0.84);
    rod.x = rod.baseX + ROD_LEN * Math.cos(theta);
    rod.y = rod.baseY + ROD_LEN * Math.sin(theta);
    // 饵的目标悬挂深度：固定线长 + 重力，线不够长就停在水中/水底
    const targetY = clamp(rod.y + LINE_LEN, WATER_Y + 5, BAIT_DEPTH);

    // 线状态机
    if (line.phase === 'sinking') {
      line.sinkP += 0.03;
      line.wiggle += 0.15;
      const p = Math.min(1, line.sinkP);
      const e = 1 - Math.pow(1 - p, 3);           // ease-out：受重力加速下沉
      baitX = rod.x + Math.sin(line.wiggle) * 2;
      baitY = WATER_Y + 4 + (targetY - WATER_Y - 4) * e;
      if (p >= 1) {
        line.phase = 'waiting';
        ripples.push({ x: baitX, y: WATER_Y + 8, r: 4, max: 30, life: 36 });
        scareNearbyCrays();                       // 落水声吓跑附近的虾
      }
    } else if (line.phase === 'waiting') {
      line.shake *= 0.95;
      baitX = rod.x + Math.sin(t * 0.8) * 3;
      baitY = targetY;
      attractCrays();                             // 饵在水底吸引虾爬过来
      for (const c of crays) {
        if (c.hooked) continue;
        const d = Math.hypot(c.x - baitX, c.y - baitY);
        if (d < 60 && Math.random() < 0.01) { bite(c); break; }
      }
    } else if (line.phase === 'bite') {
      line.biteTimer++;
      line.shake = Math.sin(line.biteTimer * 0.7) * (3 + Math.min(12, line.biteTimer * 0.4));
      baitX = rod.x + line.shake;
      baitY = targetY;
      spawnBubbles(baitX, baitY, 1);
      if (line.biteTimer > 120) loseBait();
    } else if (line.phase === 'reeling') {
      // 收杆：虾被拉向水面、拖出水面（竿尖下方）
      line.reelT += 0.03;
      const p = Math.min(1, line.reelT);
      line.shake *= 0.9;
      const prevY = baitY;
      const targetX = rod.x + Math.sin(t * 2.5) * 2;
      const targetY2 = rod.y + HOOK_DROP;
      baitX = line.reelStartX + (targetX - line.reelStartX) * p;
      baitY = line.reelStartY + (targetY2 - line.reelStartY) * p;
      const h = crays.find(c => c.hooked);
      if (h) { h.x = baitX; h.y = baitY; h.wiggle += 0.25; }
      if (prevY >= WATER_Y && baitY < WATER_Y) splashAt(baitX);   // 出水水花
      if (p >= 1) line.phase = 'hooked';   // 已拖出水面，进入投放阶段
    } else if (line.phase === 'hooked') {
      // 虾挂在钩上挣扎：跟随竿尖，抬竿可拖出水面
      line.shake *= 0.95;
      const h = crays.find(c => c.hooked);
      if (h) {
        const sway = Math.sin(t * 2.2 + Math.sin(t * 0.7) * 1.5) * 5;
        h.x = rod.x + sway;
        h.y = rod.y + HOOK_DROP;
        h.wiggle += 0.2;
        baitX = h.x; baitY = h.y;
        if (h.y >= WATER_Y && Math.random() < 0.25) spawnBubbles(h.x, h.y - 6, 1);  // 还在水里挣扎
      }
      // 拖出水面 + 对准桶 → 可投放（桶会发光）
      dropReady = !!(h && h.y < WATER_Y && Math.abs(h.x - CFG.BUCKET.x) < 70);
    } else if (line.phase === 'dropping') {
      // 松钩：虾掉进桶里
      line.dropT += 0.045;
      const p = Math.min(1, line.dropT);
      const h = crays.find(c => c.hooked);
      if (h) {
        h.x = dropStartX + (CFG.BUCKET.x - dropStartX) * p;
        h.y = dropStartY + (CFG.BUCKET.y - 16 - dropStartY) * p * p;   // 加速下落
        h.wiggle += 0.3;
        baitX = h.x; baitY = h.y;
        if (p >= 1) catchCray();
      } else {
        line.phase = 'idle';
        rod.baitInWater = false;
      }
    }

    // 小龙虾移动（只在水底爬行）
    const c = curLevel();
    for (const cray of crays) {
      if (cray.hooked) {
        if (Math.random() < 0.15) spawnBubbles(cray.x, cray.y, 1);  // 挣扎吐泡
        continue;
      }
      if (Math.random() < 0.01) {
        cray.vx += rand(-0.8, 0.8);
        cray.vy += rand(-0.25, 0.25);
      }
      cray.vx = clamp(cray.vx, -c.speed * 2, c.speed * 2);
      cray.vy = clamp(cray.vy, -0.35, 0.35);   // 只在水底爬行，几乎不上下游
      cray.x += cray.vx;
      cray.y += cray.vy;
      if (cray.x < SHORE_X + 35) { cray.x = SHORE_X + 35; cray.vx = Math.abs(cray.vx); cray.dir = 1; }
      if (cray.x > W - 25) { cray.x = W - 25; cray.vx = -Math.abs(cray.vx); cray.dir = -1; }
      if (cray.y < WATER_BOTTOM - 58) { cray.y = WATER_BOTTOM - 58; cray.vy = Math.abs(cray.vy); }
      if (cray.y > WATER_BOTTOM - 24) { cray.y = WATER_BOTTOM - 24; cray.vy = -Math.abs(cray.vy); }
      cray.dir = cray.vx > 0.05 ? 1 : cray.vx < -0.05 ? -1 : cray.dir;
      cray.wiggle += 0.06 * c.speed;
    }

    ripples = ripples.filter(r => { r.r += 0.8; r.life--; return r.life > 0; });
    bubbles = bubbles.filter(b => { b.y += b.vy; b.vy *= 0.98; b.life--; return b.life > 0; });
    particles = particles.filter(p => {
      if (p.type === 'star') { p.x += p.vx; p.y += p.vy; p.vy += 0.08; }
      p.life--;
      p.y -= 0.6;
      return p.life > 0;
    });
    for (const b of bucketCrays) b.t++;
  }

  // 出水/落水水花
  function splashAt(x) {
    ripples.push({ x, y: WATER_Y + 8, r: 5, max: 42, life: 34 });
    for (let i = 0; i < 10; i++) {
      bubbles.push({ x: x + rand(-14, 14), y: WATER_Y + rand(0, 14), r: rand(1.5, 4), vy: -rand(0.8, 2.2), life: rand(30, 60) });
    }
  }

  // 饵落水：吓跑附近的小龙虾
  function scareNearbyCrays() {
    for (const c of crays) {
      if (c.hooked) continue;
      const d = Math.hypot(c.x - baitX, c.y - baitY);
      if (d < 90) {
        const ang = Math.atan2(c.y - baitY, c.x - baitX);
        c.vx += Math.cos(ang) * 3.2;
        c.vy += Math.sin(ang) * 1.2;
      }
    }
  }

  // 饵在水底：吸引远处的小龙虾闻味爬过来
  function attractCrays() {
    if (baitY < WATER_BOTTOM - 90) return;   // 饵没沉到底就不吸引
    for (const c of crays) {
      if (c.hooked) continue;
      const d = Math.hypot(c.x - baitX, c.y - baitY);
      if (d < 340 && d > 12) {
        const ang = Math.atan2(baitY - c.y, baitX - c.x);   // 朝饵的方向
        const pull = 0.2 * (1 - d / 340);
        c.vx += Math.cos(ang) * pull;
        c.vy += Math.sin(ang) * pull * 0.4;
      }
    }
  }

  function bite(c) {
    c.hooked = true;
    line.phase = 'bite';
    line.biteTimer = 0;
    ripples.push({ x: baitX, y: baitY, r: 5, max: 40, life: 30 });
    spawnBubbles(baitX, baitY, 10);
  }

  function loseBait() {
    line.phase = 'idle';
    rod.baitInWater = false;
    spawnBubbles(baitX, baitY, 8);
  }

  function catchCray() {
    line.phase = 'idle';
    rod.baitInWater = false;
    dropReady = false;
    const h = crays.find(c => c.hooked);
    if (h) {
      const bonus = h.size > 21 ? 3 : h.size > 15 ? 2 : 1;   // 大/中/小
      score += bonus;
      bucketCrays.push({ size: h.size, t: 0 });
      if (bucketCrays.length > 5) bucketCrays.shift();
      particles.push({ type: 'text', x: CFG.BUCKET.x, y: CFG.BUCKET.y - 34, text: `+${bonus} 🦞`, life: 60, color: '#ffd966' });
      for (let i = 0; i < 8; i++) {
        particles.push({
          type: 'star', x: CFG.BUCKET.x, y: CFG.BUCKET.y - 10,
          vx: rand(-2, 2), vy: rand(-3, 0.5),
          life: 40, color: i % 2 ? '#ffd966' : '#fff'
        });
      }
      crays = crays.filter(c => !c.hooked);
      crays.push(makeCray());
      updateHUD();
      const need = 6 + (level - 1) * 4;
      if (score >= need) levelUp();
    }
  }

  function spawnBubbles(x, y, n) {
    for (let i = 0; i < n; i++) {
      bubbles.push({
        x: x + rand(-10, 10), y: y + rand(0, 12),
        r: rand(1.5, 4), vy: -rand(0.6, 1.8), life: rand(30, 60)
      });
    }
  }

  function updateHUD() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
  }

  // ---- 绘制（调用素材库） ----
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const G = { rod, line, baitX, baitY, state, crays, ripples, bubbles, particles, dropReady, bucketCrays };
    Sprites.drawSky(ctx, G);
    Sprites.drawShoreAndWater(ctx, G);
    Sprites.drawPondDetails(ctx, G);
    Sprites.drawPlayer(ctx, G);
    Sprites.drawBucket(ctx, G);
    Sprites.drawWaterSurface(ctx, G);
    Sprites.drawRipples(ctx, G);
    Sprites.drawLine(ctx, G);
    Sprites.drawCrays(ctx, G);
    Sprites.drawBubbles(ctx, G);
    Sprites.drawParticles(ctx, G);
  }

  // ---- 指针控制（钓竿限定在岸边） ----
  const pointer = { x: 150, y: WATER_Y - 30 };
  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top) * (H / rect.height);
    pointer.x = clamp(mx, 60, SHORE_X - 26);
    pointer.y = clamp(my, 120, 255);
  }
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    onMove(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    onMove(e.touches[0]);
    onCanvasClick(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener('click', onCanvasClick);

  startBtn.addEventListener('click', () => {
    if (state === 'over' && level > LEVELS.length) { level = 1; }
    startGame();
  });

  // ---- 主循环 ----
  function loop() {
    if (state === 'playing') update();
    draw();
    requestAnimationFrame(loop);
  }
  loop();

  // 调试钩子：浏览器控制台可用 __game 查看内部状态
  globalThis.__game = {
    get phase() { return line.phase; },
    get score() { return score; },
    get level() { return level; },
    get crays() { return crays; },
    get baitX() { return baitX; },
    get baitY() { return baitY; },
    get dropReady() { return dropReady; },
    get bucketCrays() { return bucketCrays; },
  };
})();
