/* ===== Phaser 场景：驱动游戏逻辑、桥接渲染与输入 =====
 * 渲染采用「画布纹理桥接」：把既有 sprites.js 的过程式绘制画进一个
 * Phaser CanvasTexture，每帧 refresh() 后由 Phaser 全屏显示。
 * 这样做既完整保留现有美术，又能获得 Phaser 的游戏循环 / 输入 / 缩放 / 相机效果。
 */
class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const W = CFG.W, H = CFG.H;

    // ---- 画布纹理：场景全部绘制到这张离屏画布，再作为纹理显示 ----
    this.sceneTex = this.textures.createCanvas('scene', W, H);
    this.sceneImg = this.add.image(W / 2, H / 2, 'scene');
    this.sceneImg.setOrigin(0.5, 0.5);

    // ---- DOM / 流程接入 ----
    Game.canvas = this.sys.game.canvas;          // 供 ui.js 定位提示（含缩放换算）
    Game.overlay = document.getElementById('overlay');
    Game.startBtn = document.getElementById('startBtn');
    Game.startBtn.addEventListener('click', () => Game.startGame());

    // ---- 输入（Phaser 原生，自动处理鼠标与触摸，坐标为画布坐标） ----
    this.input.on('pointermove', p => Game.handleMove(p.worldX, p.worldY));
    this.input.on('pointerdown', p => Game.handleClick(p.worldX, p.worldY));

    // ---- 捕获成功时轻微震屏（Phaser 相机效果） ----
    this.lastScore = Game.score;

    this.drawFrame();
  }

  update() {
    if (Game.state === 'playing') {
      const t = this.time.now / 1000;
      Game.checkBaitExhausted();
      Game.updatePhase(t);
      Game.updateCrays();
      Game.updateEffects();
      // 钓到虾 → 轻微震屏反馈
      if (Game.score > this.lastScore) {
        this.cameras.main.shake(140, 0.0035);
        this.lastScore = Game.score;
      }
    }
    this.drawFrame();
  }

  // 把场景全部绘制进画布纹理
  drawFrame() {
    const ctx = this.sceneTex.getContext();
    ctx.clearRect(0, 0, CFG.W, CFG.H);
    Sprites.drawSky(ctx, Game);
    Sprites.drawCelestial(ctx, Game);   // 日月星辰为背景层（画在最底层，不遮挡角色）
    Sprites.drawShoreAndWater(ctx, Game);
    Sprites.drawPondDetails(ctx, Game);
    Sprites.drawHoles(ctx, Game);
    Sprites.drawPlayer(ctx, Game);
    Sprites.drawBucket(ctx, Game);
    Sprites.drawBaitBox(ctx, Game);
    Sprites.drawWaterSurface(ctx, Game);
    Sprites.drawLeaves(ctx, Game);
    Sprites.drawRipples(ctx, Game);
    Sprites.drawLine(ctx, Game);
    Sprites.drawCrays(ctx, Game);
    Sprites.drawBubbles(ctx, Game);
    Sprites.drawParticles(ctx, Game);
    Sprites.drawLighting(ctx, Game);    // 全局光照 + 暗角（evenodd 抠掉天体区域）
    this.sceneTex.refresh();
  }
}
