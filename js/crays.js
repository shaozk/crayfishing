/* ===== 小龙虾系统：生成 / 贴地移动 / 洞 / 坠落 / 挣脱 / 荷叶 / 捕获 ===== */
(() => {
  const G = Game;
  const { rand, clamp } = G;

  // 分配最近的洞
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
    const { SHORE_X, W, WATER_BOTTOM, CRAY_SPEED } = CFG;
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

  G.resetCrays = function () {
    G.crays = [];
    for (let i = 0; i < CFG.CRAY_COUNT; i++) G.crays.push(makeCray());
  };

  // 释放所有挂着的虾
  function releaseHooked() {
    for (const c of G.crays.filter(c => c.hooked)) {
      c.hooked = false;
      c.state = 'toHome';
    }
  }

  // 咬钩超时：虾跑了，线复位
  G.loseBait = function () {
    releaseHooked();
    G.line.phase = 'idle';
    G.rod.baitInWater = false;
    G.castBait = null;
    G.spawnBubbles(G.baitX, G.baitY, 8);
  };

  // 某只虾挣脱：物理坠落回水里；若没有别的虾挂着，线复位
  G.escapeCray = function (h) {
    if (!h) return;
    h.fellFromAir = h.y < CFG.WATER_Y;               // 是否从空中坠回水里（决定落水水花）
    h.hooked = false;
    h.state = 'falling';                             // 进入坠落状态，由重力带着落回水里
    h.vy = 0;                                        // 从静止开始下落
    h.vx = (Math.random() < 0.5 ? -1 : 1) * rand(0.8, 2);   // 略带水平甩出
    if (!G.crays.some(c => c.hooked)) {              // 没有别的虾挂着 → 线复位
      G.line.phase = 'idle';
      G.rod.baitInWater = false;
      G.dropReady = false;
      G.castBait = null;
    }
  };

  // 荷叶：水面浮叶，钓起的虾穿过水面碰到叶子大概率直接掉落
  G.leafDropCheck = function (h) {
    if (Math.abs(h.y - CFG.WATER_Y) > 34) return;    // 只在穿过水面附近判定
    for (const leaf of CFG.LEAVES) {
      const d = Math.hypot(h.x - leaf.x, h.y - leaf.y);
      if (d < leaf.r + h.size * 0.5 && Math.random() < 0.45) {
        G.escapeCray(h);                             // 碰叶掉落回水里
        return;
      }
    }
  };

  // 饵落水：吓跑附近的小龙虾（受惊后逃回洞里躲藏）
  G.scareNearbyCrays = function () {
    for (const c of G.crays) {
      if (c.hooked || c.state === 'inHole') continue;
      const d = Math.hypot(c.x - G.baitX, c.y - G.baitY);
      if (d < 90) {
        const ang = Math.atan2(c.y - G.baitY, c.x - G.baitX);
        c.vx += Math.cos(ang) * 3.2;
        c.vy += Math.sin(ang) * 1.2;
        c.state = 'toHome';
      }
    }
  };

  // 小龙虾移动：贴地爬行 / 回洞躲藏 / 坠落下沉
  G.updateCrays = function () {
    const { SHORE_X, W, WATER_Y, WATER_BOTTOM, CRAY_SPEED } = CFG;
    for (const cray of G.crays) {
      if (cray.hooked) {
        if (Math.random() < 0.15) G.spawnBubbles(cray.x, cray.y, 1);  // 挣扎吐泡
        continue;
      }
      // 挣脱后坠落：空中加速下落 → 入水 → 继续下沉到水底（可看到沉下去）
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
          if (cray.fellFromAir) { G.splashAt(cray.x); G.spawnBubbles(cray.x, cray.y, 8); }
        }
        continue;
      }
      // 入水后继续下沉到水底：慢速加速、冒气泡
      if (cray.state === 'sinking') {
        cray.vy += 0.12;                      // 水中重力较缓
        cray.vy = Math.min(cray.vy, 2);       // 终速度
        cray.vx *= 0.96;
        cray.x += cray.vx;
        cray.y += cray.vy;
        cray.wiggle += 0.2;
        if (Math.random() < 0.25) G.spawnBubbles(cray.x, cray.y, 1);
        if (cray.y >= WATER_BOTTOM - 26) {    // 沉到水底
          cray.y = WATER_BOTTOM - 26;
          cray.state = 'toHome';
          cray.vy = 0;
          G.spawnBubbles(cray.x, cray.y, 5);  // 落底扬起泥沙气泡
        }
        continue;
      }
      // 在洞里躲藏：计时结束后钻出来
      if (cray.state === 'inHole') {
        cray.hideT--;
        if (cray.hideT <= 0) {
          cray.state = 'walk';
          cray.vx = (Math.random() < 0.5 ? -1 : 1) * rand(0.3, CRAY_SPEED) * (cray.spd || 1);
          G.spawnBubbles(cray.x, cray.y - 4, 4);      // 出洞带出气泡
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
      } else if (Math.random() < 0.0015 && Math.hypot(cray.x - G.baitX, cray.y - G.baitY) > 130) {
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
  };

  // 捕获入桶：计分 + 种类统计 + 补新虾
  G.catchCray = function () {
    G.line.phase = 'idle';
    G.rod.baitInWater = false;
    G.dropReady = false;
    G.castBait = null;
    const hs = G.crays.filter(c => c.hooked);
    if (hs.length) {
      G.score += hs.length;                // 按数量计分：每钓到一只 +1
      for (const h of hs) {
        G.caughtCounts[h.species]++;       // 按种类累计（水桶面板展示）
        G.bucketCrays.push({ size: h.size, species: h.species, t: 0 });
      }
      while (G.bucketCrays.length > 5) G.bucketCrays.shift();
      G.particles.push({ type: 'text', x: CFG.BUCKET.x, y: CFG.BUCKET.y - 34, text: `+${hs.length} 🦞`, life: 60, color: '#ffd966' });
      for (let i = 0; i < 8; i++) {
        G.particles.push({
          type: 'star', x: CFG.BUCKET.x, y: CFG.BUCKET.y - 10,
          vx: rand(-2, 2), vy: rand(-3, 0.5),
          life: 40, color: i % 2 ? '#ffd966' : '#fff'
        });
      }
      G.crays = G.crays.filter(c => !c.hooked);
      for (let i = 0; i < hs.length; i++) G.crays.push(makeCray());
    }
  };
})();
