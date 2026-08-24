/* ===== 游戏主逻辑 ===== */
(() => {
  // ---- 画布 ----
  const canvas = document.getElementById('game');
  canvas.width = CFG.W;
  canvas.height = CFG.H;
  const ctx = canvas.getContext('2d');

  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');

  // ---- 状态 ----
  let state = 'menu';            // menu | playing
  let score = 0;

  // 昼夜时间（0~1）跟随真实时钟：0=0:00 午夜，0.25=6:00 日出，0.5=12:00 正午，0.75=18:00 日落
  function getDayT() {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600 + now.getMilliseconds() / 3600000;
    return (((h + CFG.TIME_OFFSET_HOURS) % 24) + 24) % 24 / 24;
  }

  const { W, H, SHORE_X, WATER_Y, WATER_BOTTOM, ROD_LEN, LINE_LEN, HOOK_DROP, BAIT_DEPTH, CRAY_COUNT, CRAY_SPEED } = CFG;
  const REEL_RATE = 0.03;                    // 基础收杆速度（每帧推进量，连点可加速）

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
    reelRate: REEL_RATE,                     // 当前收杆速度（连点加速）
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
  let caughtCounts = {};                 // 按种类统计的捕获数
  for (const k of Object.keys(CFG.CRAY_SPECIES)) caughtCounts[k] = 0;
  let activeBait = 'snail_s';            // 当前选中的饵料
  let castBait = null;                   // 已投入水中的饵料种类
  const baitDura = {};                   // 各饵料的剩余耐久
  for (const k of Object.keys(CFG.BAITS)) baitDura[k] = CFG.BAITS[k].dur;
  const baitInfo = () => castBait ? CFG.BAITS[castBait] : null;   // 水中饵料（钩上没饵则为 null，不上钩）

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---- 小龙虾生成（只贴地爬行，各有归属的洞穴与种类） ----
  function pickHole(x) {
    let best = CFG.HOLES[0], bd = Infinity;
    for (const h of CFG.HOLES) {
      const d = Math.abs(h.x - x);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }

  // 按权重随机选一种龙虾
  function pickSpeciesKey() {
    const entries = Object.entries(CFG.CRAY_SPECIES);
    let total = 0;
    for (const [, s] of entries) total += s.w;
    let r = Math.random() * total;
    for (const [k, s] of entries) { r -= s.w; if (r < 0) return k; }
    return entries[0][0];
  }

  function makeCray() {
    const x = rand(SHORE_X + 40, W - 40);
    const spKey = pickSpeciesKey();
    const sp = CFG.CRAY_SPECIES[spKey];
    return {
      x,
      y: rand(WATER_BOTTOM - 26, WATER_BOTTOM - 14),   // 贴着地面爬行
      size: rand(10, 26),                       // 大小差异明显
      species: spKey,                           // 种类（决定外观与速度）
      spd: sp.spd || 1,                         // 爬行速度倍率
      vx: (Math.random() < 0.5 ? -1 : 1) * rand(0.15, CRAY_SPEED) * (sp.spd || 1),
      vy: (Math.random() < 0.5 ? -1 : 1) * rand(0.05, 0.12),   // 几乎不离开地面
      dir: Math.random() < 0.5 ? -1 : 1,
      wiggle: rand(0, Math.PI * 2),
      hooked: false,
      home: pickHole(x),                        // 归属的洞穴
      state: 'walk',                            // walk | toHome | inHole | falling | sinking
      hideT: 0                                  // 在洞里的剩余帧数
    };
  }

  function resetCrays() {
    crays = [];
    for (let i = 0; i < CRAY_COUNT; i++) crays.push(makeCray());
  }

  // ---- 游戏流程 ----
  function startGame() {
    score = 0;
    overlay.classList.add('hidden');
    state = 'playing';
    rod.baitInWater = false; line.phase = 'idle';
    rod.x = 150; rod.y = WATER_Y - 30;
    resetCrays();
    ripples = []; bubbles = []; particles = [];
    bucketCrays = []; dropReady = false;
    castBait = null; activeBait = 'snail_s';
    for (const k in caughtCounts) caughtCounts[k] = 0;
    for (const k of Object.keys(CFG.BAITS)) baitDura[k] = CFG.BAITS[k].dur;
  }

  // ---- 点击交互：放饵/收杆/投放进桶 ----
  function onCanvasClick(e) {
    if (state !== 'playing') return;

    // 咬钩 → 收杆（把虾拉出水面）
    if (line.phase === 'bite') {
      line.phase = 'reeling';
      line.reelT = 0;
      line.reelRate = REEL_RATE;
      line.reelStartX = baitX;
      line.reelStartY = baitY;
      spawnBubbles(baitX, baitY, 12);
      return;
    }
    if (line.phase === 'reeling') {
      // 连点加速收杆：收得越快，虾越容易挣脱
      line.reelRate = Math.min(REEL_RATE * 3, line.reelRate + REEL_RATE * 0.8);
      return;
    }
    if (line.phase === 'dropping') return;

    // 虾挂在钩上 → 对准桶投放（可多只同时投放）
    if (line.phase === 'hooked') {
      const hs = crays.filter(c => c.hooked);
      if (hs.length && hs.every(h => h.y < WATER_Y && Math.abs(h.x - CFG.BUCKET.x) < 70)) {
        line.phase = 'dropping';
        line.dropT = 0;
        dropStartX = hs[0].x; dropStartY = hs[0].y;
        dropReady = false;
        spawnBubbles(hs[0].x, hs[0].y, 6);
      }
      return;
    }

    // 点击水桶：查看当前捕获统计（按种类计数）
    if (Math.hypot(toCanvas(e).x - CFG.BUCKET.x, toCanvas(e).y - CFG.BUCKET.y) < 46) {
      toggleBucketPanel();
      return;
    }
    // 点击饵料盒：换下一种饵并显示剩余量
    if (Math.hypot(toCanvas(e).x - CFG.BAITBOX.x, toCanvas(e).y - CFG.BAITBOX.y) < 36) {
      clickBaitBox();
      return;
    }

    if (!rod.baitInWater) {
      // 竿尖必须伸到水面上方才能放饵
      if (rod.x < SHORE_X + 15) return;
      // 有饵就带上钩，没饵则空钩下水（钩上无饵即唯一信号，不提示）
      castBait = baitDura[activeBait] > 0 ? activeBait : null;
      if (castBait) {
        baitDura[castBait] = Math.max(0, baitDura[castBait] - 1);   // 每放一次饵损耗 1
      }
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
      castBait = null;
      spawnBubbles(baitX, baitY, 6);
    }
  }

  // ---- 更新逻辑 ----
  function update() {
    const t = performance.now() / 1000;
    // 饵被咬到负值才算吃光：不提示，钩上不再有饵（模拟现实）
    if (rod.baitInWater && castBait && baitDura[castBait] < 0) baitUsedUp();

    // 钓竿物理：固定长度，底座沿岸边走动，竿尖指向鼠标方向
    rod.baseX = clamp(pointer.x, 60, SHORE_X - 26);
    rod.baseY = WATER_Y - 80;
    const theta = clamp(Math.atan2(pointer.y - rod.baseY, 55), -0.7, 0.84);
    rod.x = rod.baseX + ROD_LEN * Math.cos(theta);
    rod.y = rod.baseY + ROD_LEN * Math.sin(theta);
    // 竹竿负载下垂：钓到虾时竿梢在重力方向额外下垂，虾越重垂得越多，随挣扎抖动
    if (line.phase === 'bite' || line.phase === 'reeling' || line.phase === 'hooked') {
      const hookedCray = crays.find(c => c.hooked);
      const weight = hookedCray ? Math.min(1, hookedCray.size / 26) : 0.7;
      rod.y += 7 + weight * 12 + Math.abs(line.shake || 0) * 0.3;
    }
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
      tryBite();                                  // 第一只虾咬钩
    } else if (line.phase === 'bite') {
      line.biteTimer++;
      line.shake = Math.sin(line.biteTimer * 0.7) * (3 + Math.min(12, line.biteTimer * 0.4));
      baitX = rod.x + line.shake;
      baitY = targetY;
      spawnBubbles(baitX, baitY, 1);
      tryBite();                                  // 强力饵可让第二只虾也咬上来
      if (line.biteTimer > 120) loseBait();
    } else if (line.phase === 'reeling') {
      // 收杆：虾被拉向水面、拖出水面（竿尖下方）；连点可加速，但收得越快越易挣脱
      line.reelRate = Math.max(REEL_RATE, line.reelRate * 0.94);
      line.reelT += line.reelRate;
      const p = Math.min(1, line.reelT);
      line.shake *= 0.9;
      const prevY = baitY;
      const targetX = rod.x + Math.sin(t * 2.5) * 2;
      const targetY2 = rod.y + HOOK_DROP;
      baitX = line.reelStartX + (targetX - line.reelStartX) * p;
      baitY = line.reelStartY + (targetY2 - line.reelStartY) * p;
      const hs = crays.filter(c => c.hooked);       // 可能同时钓着两只
      for (const h of hs) { h.x = baitX; h.y = baitY; h.wiggle += 0.25; }
      if (prevY >= WATER_Y && baitY < WATER_Y) splashAt(baitX);   // 出水水花
      if (p >= 1) line.phase = 'hooked';   // 已拖出水面，进入投放阶段
      // 挣脱判定：收得越快、离水面越近，越容易挣脱（逐只判断）
      for (const h of hs) {
        if (h.hooked && Math.random() < reelEscapeP()) escapeCray(h);
      }
      // 荷叶碰撞：触碰到水面浮叶大概率直接掉落
      for (const h of hs) if (h.hooked) leafDropCheck(h);
    } else if (line.phase === 'hooked') {
      // 虾挂在钩上挣扎：跟随竿尖，抬竿可拖出水面
      line.shake *= 0.95;
      const hs = crays.filter(c => c.hooked);
      if (hs.length) {
        const sway = Math.sin(t * 2.2 + Math.sin(t * 0.7) * 1.5) * 5;
        for (const h of hs) {
          h.x = rod.x + sway;
          h.y = rod.y + HOOK_DROP;
          h.wiggle += 0.2;
          if (h.y >= WATER_Y && Math.random() < 0.25) spawnBubbles(h.x, h.y - 6, 1);  // 还在水里挣扎
        }
        const last = hs[hs.length - 1];
        baitX = last.x; baitY = last.y;
      }
      // 全部出水 + 对准桶 → 可投放（桶会发光）
      dropReady = !!(hs.length && hs.every(h => h.y < WATER_Y && Math.abs(h.x - CFG.BUCKET.x) < 70));
      // 挣脱判定：出水面高度越高越容易挣脱（逐只判断）
      for (const h of hs) {
        if (h.hooked && Math.random() < hookedEscapeP(h.y)) escapeCray(h);
      }
      // 荷叶碰撞：贴着水面经过浮叶也可能被碰掉
      for (const h of hs) if (h.hooked) leafDropCheck(h);
    } else if (line.phase === 'dropping') {
      // 松钩：虾（可多只）一起掉进桶里
      line.dropT += 0.045;
      const p = Math.min(1, line.dropT);
      const hs = crays.filter(c => c.hooked);
      for (const h of hs) {
        h.x = dropStartX + (CFG.BUCKET.x - dropStartX) * p;
        h.y = dropStartY + (CFG.BUCKET.y - 16 - dropStartY) * p * p;   // 加速下落
        h.wiggle += 0.3;
      }
      if (hs.length) { baitX = hs[0].x; baitY = hs[0].y; }
      if (p >= 1) catchCray();
      else if (!hs.length) {
        line.phase = 'idle';
        rod.baitInWater = false;
        castBait = null;
      }
    }

    // 小龙虾移动（贴地爬行，可回洞躲藏、钻出）
    for (const cray of crays) {
      if (cray.hooked) {
        if (Math.random() < 0.15) spawnBubbles(cray.x, cray.y, 1);  // 挣扎吐泡
        continue;
      }
      // 挣脱后坠落：空中加速下落 → 入水溅水花 → 继续下沉到水底（可看到沉下去）
      if (cray.state === 'falling') {
        cray.vy += 0.4;                       // 空气重力加速度
        cray.wiggle += 0.3;                   // 坠落中扑腾
        cray.x += cray.vx * 0.9;
        cray.y += cray.vy;
        if (cray.y >= WATER_Y + 8) {          // 入水
          cray.y = WATER_Y + 8;
          cray.state = 'sinking';             // 转为水中下沉
          cray.vy = 0.5;                      // 入水初速
          if (cray.x < SHORE_X + 30) cray.x = SHORE_X + rand(30, 60);   // 落在岸边的回到水里
          if (cray.fellFromAir) { splashAt(cray.x); spawnBubbles(cray.x, cray.y, 8); }
        }
        continue;
      }
      // 入水后继续下沉到水底：慢速加速、冒气泡，沉到底再爬回洞里
      if (cray.state === 'sinking') {
        cray.vy += 0.12;                      // 水中重力较缓
        cray.vy = Math.min(cray.vy, 2);       // 终速度
        cray.vx *= 0.96;
        cray.x += cray.vx;
        cray.y += cray.vy;
        cray.wiggle += 0.2;
        if (Math.random() < 0.25) spawnBubbles(cray.x, cray.y, 1);   // 下沉带气泡
        if (cray.y >= WATER_BOTTOM - 26) {    // 沉到水底
          cray.y = WATER_BOTTOM - 26;
          cray.state = 'toHome';
          cray.vy = 0;
          spawnBubbles(cray.x, cray.y, 5);    // 落底扬起泥沙气泡
        }
        continue;
      }
      // 在洞里躲藏：计时结束后钻出来
      if (cray.state === 'inHole') {
        cray.hideT--;
        if (cray.hideT <= 0) {
          cray.state = 'walk';
          cray.vx = (Math.random() < 0.5 ? -1 : 1) * rand(0.3, CRAY_SPEED) * (cray.spd || 1);
          spawnBubbles(cray.x, cray.y - 4, 4);      // 出洞带出气泡
        }
        continue;
      }
      // 回洞途中：径直爬向自己的洞，到洞口就钻进去
      if (cray.state === 'toHome') {
        const h = cray.home;
        const dx = h.x - cray.x, dy = h.y - 6 - cray.y;
        const d = Math.hypot(dx, dy);
        if (d < 5) {
          cray.state = 'inHole';
          cray.hideT = rand(180, 420);              // 躲 3~7 秒
          cray.x = h.x; cray.y = h.y - 6;
          continue;
        }
        cray.vx = clamp((dx / d) * 1.1, -1.2, 1.2);
        cray.vy = clamp((dy / d) * 0.7, -0.5, 0.5);
      } else if (Math.random() < 0.0015 && Math.hypot(cray.x - baitX, cray.y - baitY) > 130) {
        cray.state = 'toHome';                      // 离饵远时随机回洞躲藏
      }
      // 常规爬行（贴着地面，几乎不上下游）
      if (Math.random() < 0.01) cray.vx += rand(-0.4, 0.4);
      cray.vx = clamp(cray.vx, -CRAY_SPEED * 1.6 * (cray.spd || 1), CRAY_SPEED * 1.6 * (cray.spd || 1));
      cray.vy = clamp(cray.vy, -0.12, 0.12);
      cray.x += cray.vx;
      cray.y += cray.vy;
      if (cray.x < SHORE_X + 35) { cray.x = SHORE_X + 35; cray.vx = Math.abs(cray.vx); cray.dir = 1; }
      if (cray.x > W - 25) { cray.x = W - 25; cray.vx = -Math.abs(cray.vx); cray.dir = -1; }
      if (cray.y < WATER_BOTTOM - 30) { cray.y = WATER_BOTTOM - 30; cray.vy = Math.abs(cray.vy); }
      if (cray.y > WATER_BOTTOM - 12) { cray.y = WATER_BOTTOM - 12; cray.vy = -Math.abs(cray.vy); }
      cray.dir = cray.vx > 0.05 ? 1 : cray.vx < -0.05 ? -1 : cray.dir;
      cray.wiggle += 0.06 * CRAY_SPEED;
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

  // 饵落水：吓跑附近的小龙虾（受惊后逃回洞里躲藏）
  function scareNearbyCrays() {
    for (const c of crays) {
      if (c.hooked || c.state === 'inHole') continue;
      const d = Math.hypot(c.x - baitX, c.y - baitY);
      if (d < 90) {
        const ang = Math.atan2(c.y - baitY, c.x - baitX);
        c.vx += Math.cos(ang) * 3.2;
        c.vy += Math.sin(ang) * 1.2;
        c.state = 'toHome';
      }
    }
  }

  // 饵在水底：按饵料种类吸引远处的小龙虾闻味爬过来（吸引半径/力度不同）
  function attractCrays() {
    if (baitY < WATER_BOTTOM - 90) return;   // 饵没沉到底就不吸引
    const b = baitInfo();
    if (!b) return;                          // 钩上没有饵，不吸引
    for (const c of crays) {
      if (c.hooked || c.state !== 'walk') continue;   // 洞里/回洞途中不被吸引
      const d = Math.hypot(c.x - baitX, c.y - baitY);
      if (d < b.attract && d > 12) {
        const ang = Math.atan2(baitY - c.y, baitX - c.x);   // 朝饵的方向
        const pull = b.pull * (1 - d / b.attract);
        c.vx += Math.cos(ang) * pull;
        c.vy += Math.sin(ang) * pull * 0.4;
      }
    }
  }

  // 尝试让虾咬钩：强力饵（bite>=2）可两只同时上钩
  function tryBite() {
    const b = baitInfo();
    if (!b) return;                          // 钩上没有饵，不会咬钩
    const hookedNow = crays.filter(c => c.hooked).length;
    if (hookedNow >= b.bite) return;
    for (const c of crays) {
      if (c.hooked || c.state !== 'walk') continue;
      const d = Math.hypot(c.x - baitX, c.y - baitY);
      if (d < 60 && Math.random() < 0.012) { bite(c); return; }   // 一帧最多咬一只
    }
  }

  function bite(c) {
    c.hooked = true;
    if (line.phase !== 'bite') { line.phase = 'bite'; line.biteTimer = 0; }
    ripples.push({ x: baitX, y: baitY, r: 5, max: 40, life: 30 });
    spawnBubbles(baitX, baitY, 10);
    // 大虾吃得快：按大小损耗饵料耐久（消耗已调慢），可能被吃到负值（饵被吃光）
    if (castBait) {
      baitDura[castBait] -= (c.size / 26) * 0.5;
    }
  }

  function loseBait() {
    for (const c of crays.filter(c => c.hooked)) {   // 释放所有挂着的虾
      c.hooked = false;
      c.state = 'toHome';
    }
    line.phase = 'idle';
    rod.baitInWater = false;
    castBait = null;
    spawnBubbles(baitX, baitY, 8);
  }

  // ---- 挣脱判定 ----
  // 收杆中（每帧概率）：收得越快、离水面越近，越容易挣脱
  function reelEscapeP() {
    const total = Math.max(1, line.reelStartY - WATER_Y);          // 收杆起点到水面的距离
    const progress = clamp(1 - (baitY - WATER_Y) / total, 0, 1);   // 0=深在水底 1=已到水面
    const speedK = line.reelRate / REEL_RATE;                      // 收杆倍率（连点加速）
    return 0.0015 + speedK * 0.003 + progress * 0.008;
  }
  // 挂竿后（每帧概率）：出水面高度越高越容易挣脱
  function hookedEscapeP(crayY) {
    const above = crayY < WATER_Y ? clamp((WATER_Y - crayY) / 80, 0, 1) : 0;
    return 0.0008 + above * 0.0025;
  }

  // 荷叶：水面浮叶，钓起的虾在穿过水面时碰到叶子大概率直接掉落
  function leafDropCheck(h) {
    if (Math.abs(h.y - WATER_Y) > 34) return;      // 只在穿过水面附近判定
    for (const leaf of CFG.LEAVES) {
      const d = Math.hypot(h.x - leaf.x, h.y - leaf.y);
      if (d < leaf.r + h.size * 0.5 && Math.random() < 0.45) {
        escapeCray(h);                             // 碰叶掉落回水里
        return;
      }
    }
  }

  // 某只虾挣脱：物理坠落回水里；若没有别的虾挂着，线复位
  function escapeCray(h) {
    if (!h) return;
    h.fellFromAir = h.y < WATER_Y;               // 是否从空中坠回水里（决定落水水花）
    h.hooked = false;
    h.state = 'falling';                         // 进入坠落状态，由重力带着落回水里
    h.vy = 0;                                    // 从静止开始下落
    h.vx = (Math.random() < 0.5 ? -1 : 1) * rand(0.8, 2);   // 略带水平甩出
    if (!crays.some(c => c.hooked)) {            // 没有别的虾挂着 → 线复位
      line.phase = 'idle';
      rod.baitInWater = false;
      dropReady = false;
      castBait = null;
    }
  }

  // 饵被吃光：不提示，钩上不再有饵（模拟现实）；虾若正咬着则脱钩
  function baitUsedUp() {
    for (const c of crays.filter(c => c.hooked)) {   // 大虾把饵吃光，脱钩
      c.hooked = false;
      c.state = 'toHome';
    }
    castBait = null;                                 // 钩上无饵
    if (line.phase === 'bite') line.phase = 'waiting';   // 线仍垂着，只是没饵了
  }

  function catchCray() {
    line.phase = 'idle';
    rod.baitInWater = false;
    dropReady = false;
    castBait = null;
    const hs = crays.filter(c => c.hooked);
    if (hs.length) {
      score += hs.length;                // 按数量计分：每钓到一只 +1
      for (const h of hs) {
        caughtCounts[h.species]++;       // 按种类累计（中央统计/水桶面板）
        bucketCrays.push({ size: h.size, species: h.species, t: 0 });
      }
      while (bucketCrays.length > 5) bucketCrays.shift();
      particles.push({ type: 'text', x: CFG.BUCKET.x, y: CFG.BUCKET.y - 34, text: `+${hs.length} 🦞`, life: 60, color: '#ffd966' });
      for (let i = 0; i < 8; i++) {
        particles.push({
          type: 'star', x: CFG.BUCKET.x, y: CFG.BUCKET.y - 10,
          vx: rand(-2, 2), vy: rand(-3, 0.5),
          life: 40, color: i % 2 ? '#ffd966' : '#fff'
        });
      }
      crays = crays.filter(c => !c.hooked);
      for (let i = 0; i < hs.length; i++) crays.push(makeCray());
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

  // ---- 饵料盒（水桶旁的小木盒：点击换下一种饵并查看剩余） ----
  const baitInfoEl = document.getElementById('baitInfo');
  let baitInfoTimer = 0;
  function clickBaitBox() {
    if (rod.baitInWater) { showBaitInfo(activeBait); return; }   // 饵在水中不能换，只看剩余
    const keys = Object.keys(CFG.BAITS);
    activeBait = keys[(keys.indexOf(activeBait) + 1) % keys.length];   // 循环换下一种
    if (baitDura[activeBait] <= 0) baitDura[activeBait] = CFG.BAITS[activeBait].dur;   // 空饵补上新饵
    showBaitInfo(activeBait);
  }
  // 点击时在盒子旁短暂显示剩余量（2.5 秒后自动隐藏，不常驻）
  function showBaitInfo(key) {
    const b = CFG.BAITS[key];
    const left = Math.max(0, Math.round(baitDura[key]));
    baitInfoEl.innerHTML = `${b.icon} ${b.name}：剩余 ${left}/${b.dur}`;
    // 定位在饵料盒旁边（画布坐标 → 屏幕坐标）
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H);
    const ox = (rect.width - W * scale) / 2;
    const oy = (rect.height - H * scale) / 2;
    baitInfoEl.style.left = (rect.left + ox + CFG.BAITBOX.x * scale) + 'px';
    baitInfoEl.style.top = (rect.top + oy + CFG.BAITBOX.y * scale - 34) + 'px';
    baitInfoEl.style.transform = 'translateX(-50%)';
    baitInfoEl.classList.remove('hidden');
    clearTimeout(baitInfoTimer);
    baitInfoTimer = setTimeout(() => baitInfoEl.classList.add('hidden'), 2500);
  }

  // ---- 水桶统计面板（按种类计数） ----
  const bucketPanel = document.getElementById('bucketPanel');
  const speciesListEl = document.getElementById('speciesList');
  const totalCountEl = document.getElementById('totalCount');
  document.getElementById('bpClose').addEventListener('click', () => bucketPanel.classList.add('hidden'));

  function renderBucketPanel() {
    let html = '';
    let total = 0;
    for (const [key, sp] of Object.entries(CFG.CRAY_SPECIES)) {
      const n = caughtCounts[key] || 0;
      total += n;
      const c = Sprites.rgb(Sprites.mix3(Sprites.hex(sp.body[0][1]), Sprites.hex(sp.body[1][1]), 0.4));
      html += `<div class="row${n ? '' : ' zero'}"><span class="dot" style="background:${c}"></span><span class="name">${sp.name}</span><span class="num">×${n}</span></div>`;
    }
    speciesListEl.innerHTML = html;
    totalCountEl.textContent = total;
  }

  function toggleBucketPanel() {
    renderBucketPanel();
    bucketPanel.classList.toggle('hidden');
  }

  // ---- 绘制（调用素材库） ----
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const G = { rod, line, baitX, baitY, state, crays, ripples, bubbles, particles, dropReady, bucketCrays, time: getDayT(), baitKey: castBait, activeBait };
    Sprites.drawSky(ctx, G);
    Sprites.drawCelestial(ctx, G);   // 日月星辰为背景层（画在最底层，不遮挡角色）
    Sprites.drawShoreAndWater(ctx, G);
    Sprites.drawPondDetails(ctx, G);
    Sprites.drawHoles(ctx, G);
    Sprites.drawPlayer(ctx, G);
    Sprites.drawBucket(ctx, G);
    Sprites.drawBaitBox(ctx, G);
    Sprites.drawWaterSurface(ctx, G);
    Sprites.drawLeaves(ctx, G);
    Sprites.drawRipples(ctx, G);
    Sprites.drawLine(ctx, G);
    Sprites.drawCrays(ctx, G);
    Sprites.drawBubbles(ctx, G);
    Sprites.drawParticles(ctx, G);
    Sprites.drawLighting(ctx, G);    // 全局光照（evenodd 抠掉天体区域，保持其明亮）
  }

  // ---- 指针控制（钓竿限定在岸边） ----
  const pointer = { x: 150, y: WATER_Y - 30 };
  // 事件坐标 → 画布坐标（含 object-fit 缩放换算）
  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H);
    const ox = (rect.width - W * scale) / 2;
    const oy = (rect.height - H * scale) / 2;
    return { x: (e.clientX - rect.left - ox) / scale, y: (e.clientY - rect.top - oy) / scale };
  }
  function onMove(e) {
    const p = toCanvas(e);
    pointer.x = clamp(p.x, 60, SHORE_X - 26);
    pointer.y = clamp(p.y, 120, 255);
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
    get crays() { return crays; },
    get baitX() { return baitX; },
    get baitY() { return baitY; },
    get dropReady() { return dropReady; },
    get bucketCrays() { return bucketCrays; },
    get time() { return getDayT(); },
    get counts() { return caughtCounts; },
    get bait() { return { active: activeBait, inWater: castBait, dur: baitDura }; },
  };
})();
