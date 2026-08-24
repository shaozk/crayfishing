/* ===== 输入：指针移动 / 点击交互 ===== */
(() => {
  const G = Game;
  const canvas = document.getElementById('game');

  // 事件坐标 → 画布坐标（含 object-fit 缩放换算）
  G.toCanvas = function (e) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / CFG.W, rect.height / CFG.H);
    const ox = (rect.width - CFG.W * scale) / 2;
    const oy = (rect.height - CFG.H * scale) / 2;
    return { x: (e.clientX - rect.left - ox) / scale, y: (e.clientY - rect.top - oy) / scale };
  };

  // 指针移动：钓竿限定在岸边
  function onMove(e) {
    const p = G.toCanvas(e);
    G.pointer.x = G.clamp(p.x, 60, CFG.SHORE_X - 26);
    G.pointer.y = G.clamp(p.y, 120, 255);
  }

  // 点击交互：放饵 / 收杆 / 投放进桶 / 水桶 / 饵料盒
  G.onCanvasClick = function (e) {
    if (G.state !== 'playing') return;

    // 咬钩 → 收杆（把虾拉出水面）
    if (G.line.phase === 'bite') {
      G.line.phase = 'reeling';
      G.line.reelT = 0;
      G.line.reelRate = CFG.REEL_RATE;
      G.line.reelStartX = G.baitX;
      G.line.reelStartY = G.baitY;
      G.spawnBubbles(G.baitX, G.baitY, 12);
      return;
    }
    // 连点加速收杆：收得越快，虾越容易挣脱
    if (G.line.phase === 'reeling') {
      G.line.reelRate = Math.min(CFG.REEL_RATE * 3, G.line.reelRate + CFG.REEL_RATE * 0.8);
      return;
    }
    if (G.line.phase === 'dropping') return;

    // 虾挂在钩上 → 对准桶投放（可多只同时投放）
    if (G.line.phase === 'hooked') {
      const hs = G.crays.filter(c => c.hooked);
      if (hs.length && hs.every(h => h.y < CFG.WATER_Y && Math.abs(h.x - CFG.BUCKET.x) < 70)) {
        G.line.phase = 'dropping';
        G.line.dropT = 0;
        G.dropStartX = hs[0].x; G.dropStartY = hs[0].y;
        G.dropReady = false;
        G.spawnBubbles(hs[0].x, hs[0].y, 6);
      }
      return;
    }

    // 点击水桶：查看当前捕获统计（按种类计数）
    if (Math.hypot(G.toCanvas(e).x - CFG.BUCKET.x, G.toCanvas(e).y - CFG.BUCKET.y) < 46) {
      G.toggleBucketPanel();
      return;
    }
    // 点击饵料盒：换下一种饵并显示剩余量
    if (Math.hypot(G.toCanvas(e).x - CFG.BAITBOX.x, G.toCanvas(e).y - CFG.BAITBOX.y) < 36) {
      G.clickBaitBox();
      return;
    }

    if (!G.rod.baitInWater) {
      // 竿尖必须伸到水面上方才能放饵
      if (G.rod.x < CFG.SHORE_X + 15) return;
      // 有饵就带上钩，没饵则空钩下水（钩上无饵即唯一信号，不提示）
      G.castBait = G.baitDura[G.activeBait] > 0 ? G.activeBait : null;
      if (G.castBait) {
        G.baitDura[G.castBait] = Math.max(0, G.baitDura[G.castBait] - 1);   // 每放一次饵损耗 1
      }
      G.rod.baitInWater = true;
      G.baitX = G.rod.x;
      G.baitY = CFG.WATER_Y + 4;      // 饵料从水面开始下沉
      G.line.phase = 'sinking';
      G.line.sinkP = 0;
      G.ripples.push({ x: G.rod.x, y: CFG.WATER_Y + 8, r: 4, max: 34, life: 40 });
      G.bubbles.push({ x: G.rod.x + G.rand(-4, 4), y: CFG.WATER_Y + 10, r: 3, vy: -G.rand(1, 2), life: 40 });
    } else {
      G.rod.baitInWater = false;
      G.line.phase = 'idle';
      G.castBait = null;
      G.spawnBubbles(G.baitX, G.baitY, 6);
    }
  };

  // 事件绑定
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    onMove(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    onMove(e.touches[0]);
    G.onCanvasClick(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener('click', G.onCanvasClick);
})();
