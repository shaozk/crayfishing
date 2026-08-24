/* ===== 入口：Phaser 配置 / 游戏流程 / 调试钩子 ===== */
(() => {
  const G = Game;

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

  // ---- 启动 Phaser（自动适配全屏，FIT 等比缩放） ----
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'stage',
    width: CFG.W,
    height: CFG.H,
    backgroundColor: '#0b1526',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: GameScene,
  });
})();
