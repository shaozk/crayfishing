/* ===== Phaser 场景：驱动游戏逻辑、桥接渲染与输入 =====
 * 渲染采用「画布纹理桥接」：把既有 sprites.js 的过程式绘制画进一个
 * Phaser CanvasTexture，每帧 refresh() 后由 Phaser 全屏显示。
 * 这样做既完整保留现有美术，又能获得 Phaser 的游戏循环 / 输入 / 缩放 / 相机效果。
 */
class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    // 素材改为 scene.create() 里 <img> 手动加载（见 Assets.load），
    // 不依赖 Phaser Loader 的 XHR（file:// 下会失败导致素材缺失）。
  }

  create() {
    const W = CFG.W, H = CFG.H;

    // ---- 素材：<img> 异步加载（file:// 与 http 皆可用；未就绪时绘制回退程序化） ----
    Assets.load();

    // ---- 画布纹理：场景全部绘制到这张离屏画布，再作为纹理显示 ----
    this.sceneTex = this.textures.createCanvas('scene', W, H);
    this.sceneImg = this.add.image(W / 2, H / 2, 'scene');
    this.sceneImg.setOrigin(0.5, 0.5);

    // ---- DOM / 流程接入 ----
    Game.canvas = this.sys.game.canvas;          // 供 ui.js 定位提示（含缩放换算）
    Game.overlay = document.getElementById('overlay');
    Game.startBtn = document.getElementById('startBtn');
    Game.startBtn.addEventListener('click', () => Game.startGame());

    // ---- 全屏按钮（移动端沉浸；不支持全屏 API 的设备隐藏，如 iOS Safari） ----
    const fsBtn = document.getElementById('fsBtn');
    if (fsBtn) {
      if (document.documentElement.requestFullscreen) {
        fsBtn.addEventListener('click', () => {
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
        });
      } else {
        fsBtn.classList.add('hidden');
      }
    }

    // ---- 输入（Phaser 原生，自动处理鼠标与触摸，坐标为画布坐标） ----
    this.input.on('pointermove', p => Game.handleMove(p.worldX, p.worldY));
    this.input.on('pointerdown', p => Game.handleDown(p.worldX, p.worldY));
    this.input.on('pointerup', () => Game.handleUp());
    // 滚轮调节线长（上滚放长、下滚缩短）
    this.input.on('wheel', (p, over, dx, dy) => Game.handleWheel(dy));

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
    // 线长滑块每帧同步（桌面滚轮改线长时也跟随）
    Game.updateLineSlider();
    this.drawFrame();
  }

  // 把场景全部绘制进画布纹理（剪影·留白：仅保留元素预算内的绘制层）
  drawFrame() {
    const ctx = this.sceneTex.getContext();
    ctx.clearRect(0, 0, CFG.W, CFG.H);
    Sprites.drawSky(ctx, Game);              // 纸底 + 日/月方块（含可选水下轻底）
    Sprites.drawShoreAndWater(ctx, Game);    // 结构线：水位线/岸台/岸缘
    Sprites.drawLeaves(ctx, Game);
    Sprites.drawHoles(ctx, Game);
    Sprites.drawPlayer(ctx, Game);
    Sprites.drawBucket(ctx, Game);
    Sprites.drawBaitBox(ctx, Game);
    Sprites.drawRipples(ctx, Game);
    Sprites.drawLine(ctx, Game);             // 竿/线/饵/咬钩信号
    Sprites.drawCrays(ctx, Game);
    Sprites.drawParticles(ctx, Game);        // 捕获圆环
    Sprites.drawHUD(ctx, Game);
    this.sceneTex.refresh();
  }
}
