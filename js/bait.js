/* ===== 饵料系统：耐久 / 吸引 / 咬钩 / 用光 / 饵料盒 ===== */
(() => {
  const G = Game;

  // 饵在水底：按饵料种类吸引远处的小龙虾闻味爬过来（吸引半径/力度不同）
  G.attractCrays = function () {
    if (G.baitY < CFG.WATER_BOTTOM - 90) return;   // 饵没沉到底就不吸引
    const b = G.baitInfo();
    if (!b) return;                                // 钩上没有饵，不吸引
    for (const c of G.crays) {
      if (c.hooked || c.state !== 'walk') continue;   // 洞里/回洞途中不被吸引
      const d = Math.hypot(c.x - G.baitX, c.y - G.baitY);
      if (d < b.attract && d > 12) {
        const ang = Math.atan2(G.baitY - c.y, G.baitX - c.x);   // 朝饵的方向
        const pull = b.pull * (1 - d / b.attract);
        c.vx += Math.cos(ang) * pull;
        c.vy += Math.sin(ang) * pull * 0.4;
      }
    }
  };

  // 尝试让虾咬钩：强力饵（bite>=2）可两只同时上钩
  G.tryBite = function () {
    const b = G.baitInfo();
    if (!b) return;                                // 钩上没有饵，不会咬钩
    const hookedNow = G.crays.filter(c => c.hooked).length;
    if (hookedNow >= b.bite) return;
    for (const c of G.crays) {
      if (c.hooked || c.state !== 'walk') continue;
      const d = Math.hypot(c.x - G.baitX, c.y - G.baitY);
      if (d < 60 && Math.random() < 0.012) { G.bite(c); return; }   // 一帧最多咬一只
    }
  };

  // 咬钩：挂钩 + 按虾大小损耗饵料耐久（消耗较慢，可能被吃到负值 = 饵被吃光）
  G.bite = function (c) {
    c.hooked = true;
    if (G.line.phase !== 'bite') { G.line.phase = 'bite'; G.line.biteTimer = 0; }
    G.ripples.push({ x: G.baitX, y: G.baitY, r: 5, max: 40, life: 30 });
    G.spawnBubbles(G.baitX, G.baitY, 10);
    if (G.castBait) {
      G.baitDura[G.castBait] -= (c.size / 26) * 0.5;
    }
  };

  // 每帧检查：饵被咬到负值才算吃光 → 钩上无饵（不提示，模拟现实）
  G.checkBaitExhausted = function () {
    if (G.rod.baitInWater && G.castBait && G.baitDura[G.castBait] < 0) {
      for (const c of G.crays.filter(c => c.hooked)) {   // 大虾把饵吃光，脱钩
        c.hooked = false;
        c.state = 'toHome';
      }
      G.castBait = null;                                 // 钩上无饵
      if (G.line.phase === 'bite') G.line.phase = 'waiting';   // 线仍垂着，只是没饵了
    }
  };

  // 点击饵料盒：换下一种饵并显示剩余量
  G.clickBaitBox = function () {
    if (G.rod.baitInWater) { G.showBaitInfo(G.activeBait); return; }   // 饵在水中不能换，只看剩余
    const keys = Object.keys(CFG.BAITS);
    G.activeBait = keys[(keys.indexOf(G.activeBait) + 1) % keys.length];   // 循环换下一种
    if (G.baitDura[G.activeBait] <= 0) G.baitDura[G.activeBait] = CFG.BAITS[G.activeBait].dur;   // 空饵补上新饵
    G.showBaitInfo(G.activeBait);
  };
})();
