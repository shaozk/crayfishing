/* ===== 素材库：黑白像素风绘制 =====
 * 每个函数都是纯绘制（不修改游戏状态）。
 * G = { rod, line, baitX, baitY, state, crays, ripples, bubbles, particles }
 *
 * 颜色纪律：
 *  - 只允许使用 CFG.PALETTE 灰阶 token，经 pal()/alphaTone() 出口（含昼夜反色）；
 *  - 原始两极色（CFG.PALETTE.WHITE / INK）仅用于闪烁信号，保证昼夜双背景可见；
 *  - 本文件不允许出现任何彩色/hex 字面量。
 */
const Sprites = {
  PX: 4,   // 逻辑像素边长：全场景共用 4px 网格

  clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; },

  // ---- 像素网格工具 ----
  snap(v) { return Math.round(v / this.PX) * this.PX; },
  // 网格对齐的实心矩形（像素风基本笔刷）
  px(ctx, x, y, w, h, style) {
    ctx.fillStyle = style;
    ctx.fillRect(this.snap(x), this.snap(y), this.snap(w) || this.PX, this.snap(h) || this.PX);
  },
  // 棋盘抖动：区域内按 4px 网格铺间隔方块（level 1=稀疏25% 2=标准50%）
  dither(ctx, x, y, w, h, style, level = 2, phase = 0) {
    const P = this.PX;
    const x0 = this.snap(x), y0 = this.snap(y);
    const x1 = this.snap(x + w), y1 = this.snap(y + h);
    const mod = level >= 2 ? 2 : 4;
    ctx.fillStyle = style;
    for (let yy = y0; yy < y1; yy += P) {
      for (let xx = x0; xx < x1; xx += P) {
        if ((xx / P + yy / P + phase) % mod === 0) ctx.fillRect(xx, yy, P, P);
      }
    }
  },

  // ---- 昼夜反色：夜晚亮度取反（白天浅底深线 / 夜晚深底浅线，仿恐龙游戏夜间） ----
  // 量化到 4 档（0, 1/3, 2/3, 1），避免过渡期抖动纹理逐帧闪变
  nightQ(G) {
    const t = G.time == null ? 0.5 : G.time;
    const p = ((t - 0.25 + 1) % 1) / 0.5 * Math.PI;
    const el = Math.sin(p);                          // 太阳高度 -1~1
    return Math.round(this.clamp01((0.22 - el) / 0.5) * 3) / 3;
  },
  // 灰阶反转：只接受 CFG.PALETTE 的 hex（R=G=B）
  tone(hexColor, q) {
    const g = parseInt(hexColor.slice(1, 3), 16);
    const v = Math.round(g + (255 - 2 * g) * q);
    return `rgb(${v},${v},${v})`;
  },
  pal(key, G) { return this.tone(CFG.PALETTE[key], this.nightQ(G)); },
  alphaTone(key, G, a) {
    const q = this.nightQ(G);
    const g = parseInt(CFG.PALETTE[key].slice(1, 3), 16);
    const v = Math.round(g + (255 - 2 * g) * q);
    return `rgba(${v},${v},${v},${a})`;
  },

  // 素材安全访问：Assets 未加载/未就绪时返回 null，绝不抛异常
  _crayTint(key, q) {
    return (typeof Assets !== 'undefined' && Assets.cray) ? Assets.cray(key, q || 0) : null;
  },

  // ---- 天空：平涂纸白 + 像素云 + 远山剪影（太阳/月亮见 drawCelestial） ----
  drawSky(ctx, G) {
    const { W, WATER_Y } = CFG;
    ctx.fillStyle = this.pal('PAPER', G);
    ctx.fillRect(0, 0, W, WATER_Y + 20);
    // 晨昏过渡带：地平线上方的抖动横带（昼夜切换时可感知）
    const q = this.nightQ(G);
    if (q > 0 && q < 1) this.dither(ctx, 0, WATER_Y - 56, W, 80, this.alphaTone('MID', G, .4), 1);
    // 远山剪影（平涂，无渐变）
    ctx.fillStyle = this.pal('LIGHT', G);
    ctx.beginPath();
    ctx.moveTo(0, WATER_Y + 15);
    ctx.lineTo(150, WATER_Y - 45);
    ctx.lineTo(320, WATER_Y + 5);
    ctx.lineTo(520, WATER_Y - 60);
    ctx.lineTo(720, WATER_Y);
    ctx.lineTo(900, WATER_Y - 35);
    ctx.lineTo(W, WATER_Y + 15);
    ctx.closePath();
    ctx.fill();
    // 像素云
    this.drawCloud(ctx, 120, 55, 1, G);
    this.drawCloud(ctx, 430, 90, 0.7, G);
    this.drawCloud(ctx, 700, 45, 0.85, G);
  },

  // 日月星辰几何信息：drawCelestial 绘制，位置与昼夜无关
  celestialInfo(G) {
    const { W, WATER_Y } = CFG;
    const t = G.time == null ? 0.5 : G.time;
    const frac = v => v - Math.floor(v);
    const horizonY = WATER_Y - 24;
    const arcH = 130;
    const sunP = ((t - 0.25 + 1) % 1) / 0.5 * Math.PI;
    const sunEl = Math.sin(sunP);
    const moonP = ((t - 0.75 + 1) % 1) / 0.5 * Math.PI;
    const moonEl = Math.sin(moonP);
    const night = this.clamp01(1 - sunEl * 1.5);
    const info = { night };
    if (sunEl > -0.08) info.sun = { x: W / 2 - Math.cos(sunP) * W * 0.42, y: horizonY - sunEl * arcH };
    if (moonEl > -0.08) info.moon = { x: W / 2 - Math.cos(moonP) * W * 0.42, y: horizonY - moonEl * arcH };
    if (night > 0.35) {
      info.stars = [];
      for (let i = 0; i < 48; i++) {
        info.stars.push({
          x: 20 + frac(Math.sin(i * 127.1) * 43758.5453) * (W - 40),
          y: 14 + frac(Math.sin(i * 269.5) * 43758.5453) * (WATER_Y - 100),
          r: 0.7 + frac(Math.sin(i * 419.2) * 43758.5453) * 1.3,
          ph: i * 1.7
        });
      }
    }
    return info;
  },

  // ---- 全局光照：昼夜反色已并入 pal()/alphaTone()，不再叠全局色层 ----
  // （原夜晚蓝色叠层 + 径向暗角与黑白像素风冲突，故为空实现；保留调用点以稳定渲染次序）
  drawLighting(ctx, G) { /* no-op */ },

  // ---- 日月星辰（背景层）：像素方块日/月 + 闪烁星 ----
  // 日月为光源：不随昼夜反色（可见时保持最亮/最暗端）
  drawCelestial(ctx, G) {
    const info = this.celestialInfo(G);
    const now = performance.now() / 1000;
    // 星星：4px 方点闪烁（仅夜晚出现）
    if (info.stars) {
      for (const st of info.stars) {
        const tw = 0.5 + 0.5 * Math.sin(now * 2 + st.ph);
        this.px(ctx, st.x - 2, st.y - 2, 4, 4, `rgba(255,255,255,${((info.night - 0.35) / 0.65 * tw).toFixed(3)})`);
      }
    }
    // 太阳：外圈抖动光晕 + 白色方核
    if (info.sun) {
      const { x: sx, y: sy } = info.sun;
      this.dither(ctx, sx - 24, sy - 24, 48, 48, this.alphaTone('WHITE', G, .5), 1);
      this.px(ctx, sx - 10, sy - 10, 20, 20, CFG.PALETTE.WHITE);
    }
    // 月亮：纸白方盘 + 墨色环形山
    if (info.moon) {
      const { x: mx, y: my } = info.moon;
      this.dither(ctx, mx - 22, my - 22, 44, 44, this.alphaTone('PAPER', G, .45), 1);
      this.px(ctx, mx - 10, my - 10, 20, 20, CFG.PALETTE.PAPER);
      this.px(ctx, mx - 6, my - 6, 4, 4, CFG.PALETTE.INK);
      this.px(ctx, mx + 2, my + 2, 4, 4, CFG.PALETTE.INK);
      this.px(ctx, mx - 2, my + 6, 4, 4, CFG.PALETTE.INK);
    }
  },

  // 像素云：三段横条
  drawCloud(ctx, x, y, s, G) {
    const c = this.snap(8 * s);
    const col = this.alphaTone('MID', G, .45);
    this.px(ctx, x - c, y - c, 3 * c, c, col);
    this.px(ctx, x - 2 * c, y, 5 * c, c, col);
    this.px(ctx, x - 1.5 * c, y + c, 4 * c, c, col);
  },

  // ---- 岸边（左）+ 池塘水体（右）：平涂色带 + 深度抖动 ----
  drawShoreAndWater(ctx, G) {
    const { W, H, SHORE_X, WATER_Y } = CFG;
    const waterH = H - WATER_Y;
    // 岸上地面：中灰平涂 + 顶部墨线（地平线）
    ctx.fillStyle = this.pal('MID', G);
    ctx.fillRect(0, WATER_Y, SHORE_X, waterH);
    this.px(ctx, 0, WATER_Y, SHORE_X, this.PX, this.pal('INK', G));
    // 草皮带：浅灰 + 稀疏抖动 + 草叶
    ctx.fillStyle = this.pal('LIGHT', G);
    ctx.fillRect(0, WATER_Y + 4, SHORE_X, 20);
    this.dither(ctx, 0, WATER_Y + 4, SHORE_X, 20, this.pal('DARK', G), 1);
    for (let i = 0; i < 26; i++) {
      const gx = (i * 41 + 15) % SHORE_X;
      const gy = WATER_Y + ((i * 17) % 12) + 4;
      this.px(ctx, gx, gy, this.PX, 8, this.pal('DARK', G));
    }
    // 岸边石头：方块石
    for (let i = 0; i < 4; i++) {
      const sx = 20 + i * 60, sy = WATER_Y + 26 + (i % 2) * 14;
      const sw = 12 + (i % 2) * 8;
      this.px(ctx, sx, sy, sw, 8, this.pal(i % 2 ? 'MID' : 'LIGHT', G));
    }
    // 灌木丛：两簇叠置方块
    this.px(ctx, 40, WATER_Y - 12, 28, 12, this.pal('DARK', G));
    this.px(ctx, 46, WATER_Y - 20, 16, 8, this.pal('DARK', G));
    this.dither(ctx, 40, WATER_Y - 12, 28, 12, this.pal('LIGHT', G), 1);
    // 岸缘剖面（水陆交界）
    this.px(ctx, SHORE_X - 16, WATER_Y + 4, 16, 24, this.pal('DARK', G));

    // 池塘水体：上浅下深两段平涂 + 抖动过渡（虾野仍清晰可见）
    ctx.fillStyle = this.pal('LIGHT', G);
    ctx.fillRect(SHORE_X, WATER_Y, W - SHORE_X, waterH * 0.45);
    ctx.fillStyle = this.pal('MID', G);
    ctx.fillRect(SHORE_X, WATER_Y + waterH * 0.45, W - SHORE_X, waterH * 0.55);
    this.dither(ctx, SHORE_X, WATER_Y + waterH * 0.4, W - SHORE_X, waterH * 0.12, this.pal('LIGHT', G), 2);
    this.dither(ctx, SHORE_X, WATER_Y + waterH * 0.52, W - SHORE_X, waterH * 0.12, this.pal('DARK', G), 1);
    // 水底淤泥带 + 底石
    ctx.fillStyle = this.pal('DARK', G);
    ctx.fillRect(SHORE_X, H - 44, W - SHORE_X, 44);
    this.dither(ctx, SHORE_X, H - 44, W - SHORE_X, 44, this.pal('MID', G), 1);
    for (let i = 0; i < 10; i++) {
      const sx = SHORE_X + 30 + ((i * 173 + 40) % (W - SHORE_X - 60));
      const sy = H - 36 - (i % 3) * 10;
      this.px(ctx, sx, sy, 12 + (i % 3) * 4, 8, this.pal(i % 2 ? 'LIGHT' : 'MID', G));
    }
  },

  // ---- 水草（方块链随波摆动） ----
  drawPondDetails(ctx, G) {
    const { W, H, SHORE_X } = CFG;
    const now = performance.now() / 1000;
    for (let i = 0; i < 14; i++) {
      const gx = SHORE_X + 30 + ((i * 97 + 20) % (W - SHORE_X - 60));
      const gy = H - 46 - (i % 2) * 8;
      const cells = Math.min(6, 4 + (i % 3));
      const col = this.pal(i % 2 ? 'DARK' : 'MID', G);
      for (let c = 0; c < cells; c++) {
        const sway = Math.sin(now / 800 + i + c * 0.6) * 4;
        this.px(ctx, gx + sway, gy - c * this.PX, this.PX, this.PX, col);
      }
    }
  },

  // ---- 龙虾洞（水底泥岸上的洞穴，虾可钻进钻出） ----
  drawHoles(ctx, G) {
    for (const h of CFG.HOLES) {
      // 土堆
      this.px(ctx, h.x - 6, h.y - 4, 32, 14, this.pal('MID', G));
      this.dither(ctx, h.x - 6, h.y - 4, 32, 14, this.pal('LIGHT', G), 1);
      // 洞口
      this.px(ctx, h.x - 12, h.y - 4, 24, 10, this.pal('INK', G));
    }
  },

  // ---- 水面（漂移的虚线波纹行） ----
  drawWaterSurface(ctx, G) {
    const { W, SHORE_X, WATER_Y } = CFG;
    const t = performance.now() / 1000;
    for (let i = 0; i < 6; i++) {
      const wy = WATER_Y + 16 + i * 18;
      const off = (t * 22 + i * 37) % 40;
      for (let x = SHORE_X - 40 + off; x < W; x += 40) {
        if (x < SHORE_X) continue;
        this.px(ctx, x, wy, 16, this.PX, this.alphaTone('INK', G, .3));
      }
    }
    // 水面高光短划
    for (let i = 0; i < 5; i++) {
      const hx = SHORE_X + 40 + ((i * 220 + 60 + Math.sin(t * 0.6 + i) * 30) % (W - SHORE_X - 80));
      this.px(ctx, hx, WATER_Y + 8 + (i % 2) * 10, 24, this.PX, this.alphaTone('INK', G, .2));
    }
  },

  // ---- 岸边钓鱼人（像素小人，持竿手臂指向竿根） ----
  drawPlayer(ctx, G) {
    const { WATER_Y } = CFG;
    const rod = G.rod;
    const x = rod.baseX - 16;   // 玩家中心
    const y = WATER_Y + 6;      // 脚底
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.beginPath();
    ctx.ellipse(x, y, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // 腿
    this.px(ctx, x - 10, y - 20, 5, 20, this.pal('INK', G));
    this.px(ctx, x + 5, y - 20, 5, 20, this.pal('INK', G));
    // 身体 + 腰带
    this.px(ctx, x - 12, y - 46, 24, 26, this.pal('MID', G));
    this.px(ctx, x - 12, y - 26, 24, this.PX, this.pal('DARK', G));
    this.dither(ctx, x - 12, y - 46, 24, 26, this.pal('LIGHT', G), 1);
    // 手臂伸向钓竿（钓竿放下时不画手臂）
    if (G.rodHeld) {
      ctx.strokeStyle = this.pal('MID', G);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + 10, y - 42);
      ctx.quadraticCurveTo(rod.baseX - 4, y - 44, rod.baseX, rod.baseY + 6);
      ctx.stroke();
      this.px(ctx, rod.baseX - 4, rod.baseY + 2, 8, 8, this.pal('PAPER', G));   // 手
    }
    // 头 + 眼
    this.px(ctx, x - 8, y - 62, 16, 16, this.pal('PAPER', G));
    this.px(ctx, x + 3, y - 57, this.PX, this.PX, this.pal('INK', G));
    // 帽（宽檐 + 冠）
    this.px(ctx, x - 12, y - 66, 24, this.PX, this.pal('DARK', G));
    this.px(ctx, x - 8, y - 74, 16, 8, this.pal('DARK', G));
  },

  // ---- 岸边水桶（放虾的目标）：像素桶 + 投放就绪虚线框呼吸 ----
  drawBucket(ctx, G) {
    const b = CFG.BUCKET;
    const t = performance.now() / 1000;
    // 可投放：墨色虚线方框呼吸（昼夜经 pal 反色均可见）
    if (G.dropReady) {
      const r = 36 + Math.sin(t * 4) * 4;
      ctx.strokeStyle = this.pal('INK', G);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(this.snap(b.x - r), this.snap(b.y - r * 0.85), this.snap(r * 2), this.snap(r * 1.7));
      ctx.setLineDash([]);
    }
    // 桶身：上宽下窄三段
    this.px(ctx, b.x - 20, b.y - 14, 40, 10, this.pal('MID', G));
    this.px(ctx, b.x - 18, b.y - 4, 36, 12, this.pal('MID', G));
    this.px(ctx, b.x - 16, b.y + 8, 32, 8, this.pal('DARK', G));
    // 桶箍与板条
    this.px(ctx, b.x - 19, b.y + 2, 38, this.PX, this.pal('DARK', G));
    this.dither(ctx, b.x - 18, b.y - 4, 36, 12, this.pal('LIGHT', G), 1);
    // 桶口（深色内空）
    this.px(ctx, b.x - 20, b.y - 19, 40, 5, this.pal('DARK', G));
    this.px(ctx, b.x - 15, b.y - 19, 30, 4, this.pal('INK', G));
    // 轮廓
    ctx.strokeStyle = this.pal('INK', G);
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - 20, b.y - 19, 40, 35);
    // 桶里探头的小龙虾（像素精灵，含昼夜档位）
    const peek = G.bucketCrays.slice(-3);
    peek.forEach((c, i) => {
      const pxc = b.x - 10 + i * 10;
      const pyc = b.y - 16;
      const bob2 = Math.sin(t * 3 + i * 2) * 1.5;
      ctx.save();
      ctx.translate(pxc, pyc + bob2);
      const tex = this._crayTint(c.species, this.nightQ(G));
      if (tex) {
        const w2 = Math.min(c.size * 1.4, 22);
        const h2 = w2 * (16 / 26);   // 像素精灵为 26x16 网格，保持宽高比
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tex, -w2 / 2, -h2 / 2, w2, h2);
        ctx.imageSmoothingEnabled = true;
      }
      ctx.restore();
    });
  },

  // ---- 饵料盒（水桶旁的小木盒，展示当前饵料） ----
  drawBaitBox(ctx, G) {
    const b = CFG.BAITBOX;
    // 盒身 + 盒口
    this.px(ctx, b.x - 20, b.y - 12, 40, 26, this.pal('MID', G));
    this.px(ctx, b.x - 20, b.y - 16, 40, 6, this.pal('DARK', G));
    this.px(ctx, b.x - 12, b.y - 16, 24, 4, this.pal('INK', G));
    // 盒底阴影
    this.px(ctx, b.x - 20, b.y + 14, 40, this.PX, this.alphaTone('INK', G, .25));
    // 轮廓
    ctx.strokeStyle = this.pal('INK', G);
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - 20, b.y - 16, 40, 32);
    // 盒内饵料（按当前类型画小图标）
    this.drawBait(ctx, b.x, b.y - 14, G.activeBait, G);
  },

  // ---- 荷叶（水面浮叶，钓起的虾碰到会掉落）：光栅化圆 + 墨色缺口 ----
  drawLeaves(ctx, G) {
    const t = performance.now() / 1000;
    for (const leaf of CFG.LEAVES) {
      const bob = Math.sin(t * 1.2 + leaf.x * 0.01) * 1.5;
      const cx = leaf.x, cy = leaf.y + bob, r = leaf.r;
      for (let dy = -r; dy < r; dy += this.PX) {
        const w = Math.sqrt(Math.max(0, r * r - dy * dy)) * 2;
        this.px(ctx, cx - w / 2, cy + dy, w, this.PX, this.pal('PAPER', G));
      }
      // 边缘缺口（45° 楔形，墨色切缝）
      for (let i = 0; i < r * 0.7; i += this.PX) {
        this.px(ctx, cx + i * 0.72, cy + i * 0.72, this.PX, this.PX, this.pal('INK', G));
      }
      // 叶脉十字
      this.px(ctx, cx - r * 0.6, cy - 2, r * 1.2, this.PX, this.pal('DARK', G));
      this.px(ctx, cx - 2, cy - r * 0.6, this.PX, r * 1.2, this.pal('DARK', G));
    }
  },

  // ---- 波纹：墨色圆环淡出 ----
  drawRipples(ctx, G) {
    for (const r of G.ripples) {
      ctx.strokeStyle = this.alphaTone('INK', G, 0.5 * (r.life / 40));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.min(r.r, r.max), 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // ---- 鱼饵（按种类像素绘制：田螺/青蛙/猪肝） ----
  drawBait(ctx, x, y, key, G) {
    const big = key === 'snail_l' || key === 'frog_l';
    if (key === 'frog_s' || key === 'frog_l') {
      // 青蛙：浅灰身体 + 墨点双眼
      const bw = this.snap(big ? 24 : 16);
      const bh = this.snap(big ? 12 : 8);
      this.px(ctx, x - bw / 2, y - bh / 2, bw, bh, this.pal('LIGHT', G));
      const es = this.snap(big ? 8 : 4);
      this.px(ctx, x - bw / 2, y - bh / 2 - es, es, es, this.pal('LIGHT', G));
      this.px(ctx, x + bw / 2 - es, y - bh / 2 - es, es, es, this.pal('LIGHT', G));
      this.px(ctx, x - bw / 2, y - bh / 2 - es, this.PX, this.PX, this.pal('INK', G));
      this.px(ctx, x + bw / 2 - this.PX, y - bh / 2 - es, this.PX, this.PX, this.pal('INK', G));
    } else if (key === 'liver') {
      // 猪肝：深灰肉块 + 纸白油花
      const bw = this.snap(big ? 20 : 14);
      const bh = this.snap(10);
      this.px(ctx, x - bw / 2, y - bh / 2, bw, bh, this.pal('DARK', G));
      this.px(ctx, x - bw / 4, y - bh / 4, this.PX, this.PX, this.pal('PAPER', G));
      this.px(ctx, x + bw / 8, y, this.PX, this.PX, this.pal('PAPER', G));
    } else {
      // 田螺：纸白方壳 + 墨色螺旋
      const r = this.snap(big ? 8 : 6);
      this.px(ctx, x - r, y - r, r * 2, r * 2, this.pal('PAPER', G));
      ctx.strokeStyle = this.pal('INK', G);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.45, 0.8, Math.PI * 2.2);
      ctx.stroke();
      this.px(ctx, x - r + this.PX, y + r - this.PX * 2, this.PX * 2, this.PX, this.pal('DARK', G));   // 壳口
    }
  },

  // 地上的钓竿：放下（F 键）后竿躺在地面，靠近才能捡起
  drawGroundRod(ctx, x, G) {
    const gy = CFG.WATER_Y + 18;   // 地面高度
    const x0 = x - 68, x1 = x + 58, y0 = gy + 9, y1 = gy - 1;
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath();
    ctx.ellipse((x0 + x1) / 2, gy + 10, 66, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 竿本体（略微弯曲地躺着）
    ctx.strokeStyle = this.pal('LIGHT', G);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, gy + 8, x1, y1);
    ctx.stroke();
    // 竹节
    ctx.strokeStyle = this.alphaTone('DARK', G, .8);
    ctx.lineWidth = 2;
    for (const f of [0.3, 0.55, 0.8]) {
      const jx = x0 + (x1 - x0) * f;
      const jy = y0 + (y1 - y0) * f;
      ctx.beginPath();
      ctx.moveTo(jx - 4, jy + 1);
      ctx.lineTo(jx + 4, jy - 1);
      ctx.stroke();
    }
    // 竿尖：墨色方头
    this.px(ctx, x1 - 5, y1 - 5, 10, 10, this.pal('INK', G));
    // 线尾（垂在地上）
    ctx.strokeStyle = this.alphaTone('PAPER', G, .8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(x1 + 14, y1 + 6, x1 + 8, y1 + 14);
    ctx.stroke();
  },

  // 钓竿 + 鱼线 + 鱼饵（手持状态）
  drawLine(ctx, G) {
    const { rod, line, baitX, baitY, state } = G;
    if (!G.rodHeld) {
      // 钓竿已放下（F 键）：竿躺在地面上，不绘制手持竿/鱼线/饵
      this.drawGroundRod(ctx, G.rodGroundX, G);
      return;
    }
    // 钓竿：竿梢下垂在 game.js 的物理更新里计算，这里画竿身弧线。
    // 无负载时笔直；负载时竿身向重力方向弯曲（沿竿的垂直方向、指向 +y 一侧偏移）
    const tip = { x: rod.x, y: rod.y };
    const loaded = line.phase === 'bite' || line.phase === 'reeling' || line.phase === 'hooked';
    const dx = tip.x - rod.baseX, dy = tip.y - rod.baseY;
    const rodLen = Math.hypot(dx, dy) || 1;
    let cx = rod.baseX + dx * 0.7;
    let cy = rod.baseY + dy * 0.7;
    if (loaded) {
      const hookedCray = G.crays.find(c => c.hooked);
      const weight = hookedCray ? Math.min(1, hookedCray.size / 26) : 0.7;
      const flex = (10 + Math.abs(line.shake || 0) * 0.3) * (0.6 + weight * 0.8);
      cx += -dy / rodLen * flex;
      cy += dx / rodLen * flex;
    }
    ctx.strokeStyle = this.pal('LIGHT', G);      // 竿身
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rod.baseX, rod.baseY);
    ctx.quadraticCurveTo(cx, cy, tip.x, tip.y);
    ctx.stroke();
    // 竹节纹理（沿竿身垂直于切线的短横纹）
    ctx.strokeStyle = this.alphaTone('DARK', G, .8);
    ctx.lineWidth = 2;
    for (const t of [0.3, 0.55, 0.8]) {
      const mt = 1 - t;
      const jx = mt * mt * rod.baseX + 2 * mt * t * cx + t * t * tip.x;
      const jy = mt * mt * rod.baseY + 2 * mt * t * cy + t * t * tip.y;
      const tx = 2 * mt * (cx - rod.baseX) + 2 * t * (tip.x - cx);
      const ty = 2 * mt * (cy - rod.baseY) + 2 * t * (tip.y - cy);
      const tl = Math.hypot(tx, ty) || 1;
      ctx.beginPath();
      ctx.moveTo(jx - ty / tl * 4, jy + tx / tl * 4);
      ctx.lineTo(jx + ty / tl * 4, jy - tx / tl * 4);
      ctx.stroke();
    }
    // 缠在竹竿上的鱼线：缩短时多余线缠在竿身下部（线捆绑在竹竿上，需显示这部分）
    const wrapped = Math.max(0, CFG.LINE_LEN - G.lineLen);
    if (wrapped > 4) {
      const n = Math.min(Math.floor(wrapped / 12), 12);
      ctx.strokeStyle = this.alphaTone('PAPER', G, .9);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.1 : 0.05 + i * (0.38 / (n - 1));   // 集中在竿身下部
        const mt = 1 - t;
        const wx = mt * mt * rod.baseX + 2 * mt * t * cx + t * t * tip.x;
        const wy = mt * mt * rod.baseY + 2 * mt * t * cy + t * t * tip.y;
        const tx = 2 * mt * (cx - rod.baseX) + 2 * t * (tip.x - cx);
        const ty = 2 * mt * (cy - rod.baseY) + 2 * t * (tip.y - cy);
        const tl = Math.hypot(tx, ty) || 1;
        ctx.beginPath();
        ctx.moveTo(wx - ty / tl * 5, wy + tx / tl * 5);
        ctx.lineTo(wx + ty / tl * 5, wy - tx / tl * 5);
        ctx.stroke();
      }
    }
    // 竿尖：墨色方头
    this.px(ctx, tip.x - 5, tip.y - 5, 10, 10, this.pal('INK', G));

    // 鱼线（固定长度，从竿尖垂向饵）
    if (rod.baitInWater) {
      const bx = baitX;
      const by = baitY;
      const midX = (tip.x + bx) / 2 + Math.sin(performance.now() / 500) * 2;
      const midY = (tip.y + by) / 2;
      ctx.strokeStyle = this.alphaTone('PAPER', G, .8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.quadraticCurveTo(midX, midY, bx, by);
      ctx.stroke();

      // 鱼饵（按种类绘制）—— 上钩拖出/投放阶段不画，虾代替饵挂在钩上
      if (line.phase !== 'hooked' && line.phase !== 'dropping') {
        this.drawBait(ctx, bx, by + 2, G.baitKey, G);
      }

      // 咬钩警示：黑白方波闪烁（原始两极色，昼夜双背景均醒目）+ 感叹号
      if (line.phase === 'bite') {
        const blink = ((performance.now() / 130) | 0) % 2 === 0;
        const c = blink ? CFG.PALETTE.WHITE : CFG.PALETTE.INK;
        ctx.strokeStyle = c;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(bx, by, 16 + Math.sin(line.biteTimer * 0.5) * 3, 0, Math.PI * 2);
        ctx.stroke();
        this.px(ctx, bx - 2, by - 36, this.PX, 12, c);
        this.px(ctx, bx - 2, by - 20, this.PX, this.PX, c);
      }
    } else if (state === 'playing') {
      // 未放饵时：提示箭头指向水面
      const t = performance.now() / 500;
      const ax = tip.x + 14, ay = tip.y + 26;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(0.6 + Math.sin(t) * 0.15);
      ctx.fillStyle = this.alphaTone('PAPER', G, .65);
      ctx.beginPath();
      ctx.moveTo(-7, -6); ctx.lineTo(5, 0); ctx.lineTo(-7, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },

  // ---- 小龙虾 ----
  drawCrays(ctx, G) {
    ctx.imageSmoothingEnabled = false;   // 像素风：最近邻采样，离开时恢复
    const q = this.nightQ(G);
    for (const c of G.crays) {
      if (c.state === 'inHole') continue;   // 藏在洞里时不绘制
      const bob = Math.sin(c.wiggle) * 1.5;
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.scale(c.dir, 1);
      const s = c.size;
      const sp = CFG.CRAY_SPECIES[c.species] || CFG.CRAY_SPECIES.red;
      // 落地影子
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.9, s * 0.95, s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      // 本体：灰阶像素精灵（26x16 网格，全长≈s*2.3，锚点=几何中心，含昼夜档位）
      const tex = this._crayTint(c.species, q);
      if (tex) {
        const w = s * 2.3, h = w * (16 / 26);
        ctx.globalAlpha = sp.special === 'soft' ? 0.9 : 1;   // 软皮壳半透
        ctx.drawImage(tex, -w / 2, -h / 2, w, h);
        ctx.globalAlpha = 1;
      }
      // 被钓住的虾：悬挂摆动
      if (c.hooked) {
        ctx.rotate(Math.sin(performance.now() / 160) * 0.18);
      }
      ctx.restore();
    }
    ctx.imageSmoothingEnabled = true;
  },

  // ---- 气泡：浅色圆环淡出 ----
  drawBubbles(ctx, G) {
    for (const b of G.bubbles) {
      const fade = b.life / 60;
      ctx.strokeStyle = this.alphaTone('PAPER', G, 0.7 * fade);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = this.alphaTone('WHITE', G, 0.2 * fade);
      ctx.fill();
    }
  },

  // ---- 飘字 / 星星粒子：反色墨块字幕 + 灰阶星 ----
  drawParticles(ctx, G) {
    for (const p of G.particles) {
      const alpha = Math.min(1, p.life / 30);
      if (p.type === 'text') {
        // 反色墨块：底=INK 面=PAPER（昼夜经 pal 同步反转，保持反色关系）
        ctx.font = 'bold 15px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText(p.text).width + 16;
        const h = 24;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.pal('INK', G);
        ctx.fillRect(this.snap(p.x - w / 2), this.snap(p.y - h / 2), this.snap(w), h);
        ctx.fillStyle = this.pal('PAPER', G);
        ctx.fillText(p.text, p.x, p.y);
        ctx.globalAlpha = 1;
      } else if (p.type === 'star') {
        // 星星：原始两极色（不随昼夜，保证可见）
        ctx.fillStyle = /^#/.test(p.color) ? p.color : CFG.PALETTE[p.color] || CFG.PALETTE.WHITE;
        ctx.globalAlpha = alpha;
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦', p.x, p.y);
        ctx.globalAlpha = 1;
      }
    }
  },
};
