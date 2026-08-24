/* ===== 钓竿物理 + 鱼线状态机（各阶段更新）+ 挣脱概率 ===== */
(() => {
  const G = Game;
  const { clamp } = G;

  // 收杆中挣脱概率（每帧）：收得越快、离水面越近越易挣脱
  function reelEscapeP() {
    const total = Math.max(1, G.line.reelStartY - CFG.WATER_Y);       // 收杆起点到水面的距离
    const progress = clamp(1 - (G.baitY - CFG.WATER_Y) / total, 0, 1); // 0=深在水底 1=已到水面
    const speedK = G.line.reelRate / CFG.REEL_RATE;                   // 收杆倍率（连点加速）
    return 0.0015 + speedK * 0.003 + progress * 0.008;
  }
  // 挂竿后挣脱概率（每帧）：出水面高度越高越易挣脱
  function hookedEscapeP(crayY) {
    const above = crayY < CFG.WATER_Y ? clamp((CFG.WATER_Y - crayY) / 80, 0, 1) : 0;
    return 0.0008 + above * 0.0025;
  }

  // 钓竿物理 + 线状态机（每帧调用一次）
  G.updatePhase = function (t) {
    const { W, SHORE_X, WATER_Y, ROD_LEN, LINE_LEN, HOOK_DROP, BAIT_DEPTH, BUCKET } = CFG;
    const { rod, line, pointer } = G;

    // 钓竿物理：固定长度，底座沿岸边走动，竿尖指向鼠标方向
    rod.baseX = clamp(pointer.x, 60, SHORE_X - 26);
    rod.baseY = WATER_Y - 80;
    const theta = clamp(Math.atan2(pointer.y - rod.baseY, 55), -0.7, 0.84);
    rod.x = rod.baseX + ROD_LEN * Math.cos(theta);
    rod.y = rod.baseY + ROD_LEN * Math.sin(theta);
    // 竹竿负载下垂：钓到虾时竿梢在重力方向额外下垂，虾越重垂得越多，随挣扎抖动
    if (line.phase === 'bite' || line.phase === 'reeling' || line.phase === 'hooked') {
      const hookedCray = G.crays.find(c => c.hooked);
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
      G.baitX = rod.x + Math.sin(line.wiggle) * 2;
      G.baitY = WATER_Y + 4 + (targetY - WATER_Y - 4) * e;
      if (p >= 1) {
        line.phase = 'waiting';
        G.ripples.push({ x: G.baitX, y: WATER_Y + 8, r: 4, max: 30, life: 36 });
        G.scareNearbyCrays();                     // 落水声吓跑附近的虾
      }
    } else if (line.phase === 'waiting') {
      line.shake *= 0.95;
      G.baitX = rod.x + Math.sin(t * 0.8) * 3;
      G.baitY = targetY;
      G.attractCrays();                           // 饵在水底吸引虾爬过来
      G.tryBite();                                // 第一只虾咬钩
    } else if (line.phase === 'bite') {
      line.biteTimer++;
      line.shake = Math.sin(line.biteTimer * 0.7) * (3 + Math.min(12, line.biteTimer * 0.4));
      G.baitX = rod.x + line.shake;
      G.baitY = targetY;
      G.spawnBubbles(G.baitX, G.baitY, 1);
      G.tryBite();                                // 强力饵可让第二只虾也咬上来
      if (line.biteTimer > 120) G.loseBait();
    } else if (line.phase === 'reeling') {
      // 收杆：虾被拉向水面、拖出水面（竿尖下方）；连点可加速，但收得越快越易挣脱
      line.reelRate = Math.max(CFG.REEL_RATE, line.reelRate * 0.94);
      line.reelT += line.reelRate;
      const p = Math.min(1, line.reelT);
      line.shake *= 0.9;
      const prevY = G.baitY;
      const targetX = rod.x + Math.sin(t * 2.5) * 2;
      const targetY2 = rod.y + HOOK_DROP;
      G.baitX = line.reelStartX + (targetX - line.reelStartX) * p;
      G.baitY = line.reelStartY + (targetY2 - line.reelStartY) * p;
      const hs = G.crays.filter(c => c.hooked);   // 可能同时钓着两只
      for (const h of hs) { h.x = G.baitX; h.y = G.baitY; h.wiggle += 0.25; }
      if (prevY >= WATER_Y && G.baitY < WATER_Y) G.splashAt(G.baitX);   // 出水水花
      if (p >= 1) line.phase = 'hooked';          // 已拖出水面，进入投放阶段
      // 挣脱判定：收得越快、离水面越近，越容易挣脱（逐只判断）
      for (const h of hs) {
        if (h.hooked && Math.random() < reelEscapeP()) G.escapeCray(h);
      }
      // 荷叶碰撞：触碰到水面浮叶大概率直接掉落
      for (const h of hs) if (h.hooked) G.leafDropCheck(h);
    } else if (line.phase === 'hooked') {
      // 虾挂在钩上挣扎：跟随竿尖，抬竿可拖出水面
      line.shake *= 0.95;
      const hs = G.crays.filter(c => c.hooked);
      if (hs.length) {
        const sway = Math.sin(t * 2.2 + Math.sin(t * 0.7) * 1.5) * 5;
        for (const h of hs) {
          h.x = rod.x + sway;
          h.y = rod.y + HOOK_DROP;
          h.wiggle += 0.2;
          if (h.y >= WATER_Y && Math.random() < 0.25) G.spawnBubbles(h.x, h.y - 6, 1);  // 还在水里挣扎
        }
        const last = hs[hs.length - 1];
        G.baitX = last.x; G.baitY = last.y;
      }
      // 全部出水 + 对准桶 → 可投放（桶会发光）
      G.dropReady = !!(hs.length && hs.every(h => h.y < WATER_Y && Math.abs(h.x - BUCKET.x) < 70));
      // 挣脱判定：出水面高度越高越容易挣脱（逐只判断）
      for (const h of hs) {
        if (h.hooked && Math.random() < hookedEscapeP(h.y)) G.escapeCray(h);
      }
      // 荷叶碰撞：贴着水面经过浮叶也可能被碰掉
      for (const h of hs) if (h.hooked) G.leafDropCheck(h);
    } else if (line.phase === 'dropping') {
      // 松钩：虾（可多只）一起掉进桶里
      line.dropT += 0.045;
      const p = Math.min(1, line.dropT);
      const hs = G.crays.filter(c => c.hooked);
      for (const h of hs) {
        h.x = G.dropStartX + (BUCKET.x - G.dropStartX) * p;
        h.y = G.dropStartY + (BUCKET.y - 16 - G.dropStartY) * p * p;   // 加速下落
        h.wiggle += 0.3;
      }
      if (hs.length) { G.baitX = hs[0].x; G.baitY = hs[0].y; }
      if (p >= 1) G.catchCray();
      else if (!hs.length) {
        line.phase = 'idle';
        rod.baitInWater = false;
        G.castBait = null;
      }
    }
  };
})();
