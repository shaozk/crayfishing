/* ===== 入口：组装各模块 / 编排 update / draw / 主循环 ===== */
(() => {
  const G = Game;

  // ---- 画布 ----
  G.canvas = document.getElementById('game');
  G.canvas.width = CFG.W;
  G.canvas.height = CFG.H;
  G.ctx = G.canvas.getContext('2d');
  G.overlay = document.getElementById('overlay');
  G.startBtn = document.getElementById('startBtn');

  // ---- 游戏流程 ----
  G.startGame = function () {
    G.score = 0;
    G.overlay.classList.add('hidden');
    G.state = 'playing';
    G.rod.baitInWater = false; G.line.phase = 'idle';
    G.rod.x = 150; G.rod.y = CFG.WATER_Y - 30;
    G.resetCrays();
    G.ripples = []; G.bubbles = []; G.particles = [];
    G.bucketCrays = []; G.dropReady = false;
    G.castBait = null; G.activeBait = 'snail_s';
    for (const k in G.caughtCounts) G.caughtCounts[k] = 0;
    for (const k of Object.keys(CFG.BAITS)) G.baitDura[k] = CFG.BAITS[k].dur;
  };
  G.startBtn.addEventListener('click', () => G.startGame());

  // ---- 每帧更新：饵料检查 → 线状态机 → 龙虾 → 特效 ----
  function update() {
    const t = performance.now() / 1000;
    G.checkBaitExhausted();
    G.updatePhase(t);
    G.updateCrays();
    G.updateEffects();
  }

  // ---- 绘制（调用素材库，直接传入共享状态 Game） ----
  function draw() {
    const ctx = G.ctx;
    ctx.clearRect(0, 0, CFG.W, CFG.H);
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

  // ---- 主循环 ----
  function loop() {
    if (G.state === 'playing') update();
    draw();
    requestAnimationFrame(loop);
  }
  loop();

  // ---- 调试钩子：浏览器控制台可用 __game 查看内部状态 ----
  globalThis.__game = {
    get phase() { return G.line.phase; },
    get score() { return G.score; },
    get crays() { return G.crays; },
    get baitX() { return G.baitX; },
    get baitY() { return G.baitY; },
    get dropReady() { return G.dropReady; },
    get bucketCrays() { return G.bucketCrays; },
    get time() { return G.getDayT(); },
    get counts() { return G.caughtCounts; },
    get bait() { return { active: G.activeBait, inWater: G.castBait, dur: G.baitDura }; },
  };
})();
