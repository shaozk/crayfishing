/* ===== 素材库：剪影·留白（方案 A）=====
 * 每个函数都是纯绘制（不修改游戏状态）。
 * G = { rod, line, baitX, baitY, state, crays, ripples, bubbles, particles }
 *
 * 设计纪律：
 *  - 元素预算：水位线/岸台线/日月方块/人剪影/线+饵/虾剪影/荷叶/洞/桶/HUD，同屏仅此；
 *  - 颜色纪律：只经 CFG.PALETTE 的 pal()/alphaTone() 出口（含昼夜反色），
 *    原始两极色（WHITE/INK）仅用于闪烁信号与天体；
 *  - 浸没规则：水下元素一律 IMMERSE_ALPHA 墨，出水即纯墨（状态即反馈）；
 *  - 纯装饰元素（山/云/草/石/水草/抖动/波纹行/星空/气泡渲染等）不绘制。
 */
const Sprites = {
  clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; },

  // ---- 昼夜反色：夜晚亮度取反，量化 4 档避免过渡期闪变 ----
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

  // 直线笔刷
  ln(ctx, x1, y1, x2, y2, w, style, cap) {
    ctx.strokeStyle = style;
    ctx.lineWidth = w;
    ctx.lineCap = cap || 'square';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  },

  // 日月几何信息：8×8 方块沿东升西落轨迹（与旧版同轨迹，星空已删除不生成）
  celestialInfo(G) {
    const { W, WATER_Y } = CFG;
    const t = G.time == null ? 0.5 : G.time;
    const horizonY = WATER_Y - 24;
    const arcH = 130;
    const sunP = ((t - 0.25 + 1) % 1) / 0.5 * Math.PI;
    const sunEl = Math.sin(sunP);
    const moonP = ((t - 0.75 + 1) % 1) / 0.5 * Math.PI;
    const moonEl = Math.sin(moonP);
    const info = {};
    if (sunEl > -0.08) info.sun = { x: W / 2 - Math.cos(sunP) * W * 0.42, y: horizonY - sunEl * arcH };
    if (moonEl > -0.08) info.moon = { x: W / 2 - Math.cos(moonP) * W * 0.42, y: horizonY - moonEl * arcH };
    return info;
  },

  // ---- 天空：唯一纸底 + 可选水下轻底 + 日/月方块（唯一天体） ----
  drawSky(ctx, G) {
    const { W, H, SHORE_X, WATER_Y } = CFG;
    ctx.fillStyle = this.pal('PAPER', G);
    ctx.fillRect(0, 0, W, H);
    if (CFG.WATER_TINT_ALPHA > 0) {
      ctx.globalAlpha = CFG.WATER_TINT_ALPHA;
      ctx.fillStyle = this.pal('INK', G);
      ctx.fillRect(SHORE_X, WATER_Y, W - SHORE_X, H - WATER_Y);
      ctx.globalAlpha = 1;
    }
    // 天体：光源不随昼夜反色（昼=安静的太阳，夜=深底上的亮月亮）
    const info = this.celestialInfo(G);
    ctx.fillStyle = CFG.PALETTE.WHITE;
    if (info.sun) ctx.fillRect(Math.round(info.sun.x) - 4, Math.round(info.sun.y) - 4, 8, 8);
    if (info.moon) ctx.fillRect(Math.round(info.moon.x) - 4, Math.round(info.moon.y) - 4, 8, 8);
  },

  // ---- 结构线：水位线（全场唯一水平基准）+ 岸台线 + 岸缘竖接线 ----
  drawShoreAndWater(ctx, G) {
    const { W, SHORE_X, WATER_Y } = CFG;
    const ink = this.pal('INK', G);
    this.ln(ctx, SHORE_X, WATER_Y, W, WATER_Y, 2, ink);            // 水位线
    this.ln(ctx, 60, WATER_Y + 6, SHORE_X, WATER_Y + 6, 2, ink);   // 岸台线
    this.ln(ctx, SHORE_X, WATER_Y, SHORE_X, WATER_Y + 6, 2, ink);  // 岸缘
  },

  // ---- 荷叶：缺口圆（纸填充 + 墨描边，水面浮叶玩法载体） ----
  drawLeaves(ctx, G) {
    for (const leaf of CFG.LEAVES) {
      ctx.beginPath();
      ctx.arc(leaf.x, leaf.y, leaf.r, Math.PI * 0.22, Math.PI * 1.88);   // 右下缺口
      ctx.closePath();
      ctx.fillStyle = this.pal('PAPER', G);
      ctx.fill();
      ctx.strokeStyle = this.pal('INK', G);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },

  // ---- 龙虾洞：浸没墨椭圆（虾可钻入的玩法载体） ----
  drawHoles(ctx, G) {
    ctx.globalAlpha = CFG.IMMERSE_ALPHA;
    ctx.fillStyle = this.pal('INK', G);
    for (const h of CFG.HOLES) {
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  // ---- 岸边钓鱼人：纯墨几何剪影 ----
  drawPlayer(ctx, G) {
    const { WATER_Y } = CFG;
    const rod = G.rod;
    const x = rod.baseX - 16;   // 玩家中心
    const g = WATER_Y + 6;      // 脚底=岸台线
    const ink = this.pal('INK', G);
    ctx.fillStyle = ink;
    ctx.fillRect(x - 6, g - 20, 5, 20);      // 腿
    ctx.fillRect(x + 2, g - 20, 5, 20);
    ctx.fillRect(x - 10, g - 44, 21, 25);    // 身体
    ctx.fillRect(x - 7, g - 58, 14, 14);     // 头
    if (G.rodHeld) {
      this.ln(ctx, x + 6, g - 36, rod.baseX, rod.baseY + 18, 5, ink, 'round');   // 手臂→竿根
    }
  },

  // ---- 岸边水桶：墨剪影梯形 + 投放就绪虚线圆 ----
  drawBucket(ctx, G) {
    const b = CFG.BUCKET;
    const ink = this.pal('INK', G);
    if (G.dropReady) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y - 28, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(b.x - 15, b.y - 22);
    ctx.lineTo(b.x + 15, b.y - 22);
    ctx.lineTo(b.x + 12, b.y + 22);
    ctx.lineTo(b.x - 12, b.y + 22);
    ctx.closePath();
    ctx.fill();
  },

  // ---- 饵料盒：墨描边方框 + 当前饵方块（点击换饵的交互入口） ----
  drawBaitBox(ctx, G) {
    const b = CFG.BAITBOX;
    const ink = this.pal('INK', G);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - 14, b.y - 10, 28, 20);
    this.drawBait(ctx, b.x, b.y, G.activeBait, G);
  },

  // ---- 鱼饵：单一方块字形（大小饵仅尺寸差异，类型由饵料盒/提示表达） ----
  drawBait(ctx, x, y, key, G) {
    const big = key === 'snail_l' || key === 'frog_l' || key === 'liver';
    const s = big ? 10 : 6;
    ctx.fillStyle = this.pal('INK', G);
    ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  },

  // 地上的钓竿：放下（F 键）后竿躺在地面
  drawGroundRod(ctx, x, G) {
    const gy = CFG.WATER_Y + 18;   // 地面高度
    const x0 = x - 68, x1 = x + 58, y0 = gy + 9, y1 = gy - 1;
    const ink = this.pal('INK', G);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, gy + 8, x1, y1);
    ctx.stroke();
    // 线尾（垂在地上）
    this.ln(ctx, x1, y1, x1 + 8, y1 + 14, 1, this.alphaTone('INK', G, .6));
  },

  // 钓竿 + 鱼线 + 鱼饵（手持状态；竿身弯曲与旧版同一物理几何）
  drawLine(ctx, G) {
    const { rod, line, baitX, baitY, state } = G;
    if (!G.rodHeld) {
      this.drawGroundRod(ctx, G.rodGroundX, G);
      return;
    }
    const ink = this.pal('INK', G);
    // 竿身弧线：无负载笔直；负载时向重力方向弯曲
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
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(rod.baseX, rod.baseY);
    ctx.quadraticCurveTo(cx, cy, tip.x, tip.y);
    ctx.stroke();
    // 缠在竿身的余线（线长状态的玩法信息）：竿身下部若干短横
    const wrapped = Math.max(0, CFG.LINE_LEN - G.lineLen);
    if (wrapped > 4) {
      const n = Math.min(Math.floor(wrapped / 12), 12);
      ctx.strokeStyle = this.alphaTone('INK', G, .9);
      ctx.lineWidth = 2;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.1 : 0.05 + i * (0.38 / (n - 1));
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

    if (rod.baitInWater) {
      // 鱼线：水上段纯墨 1px；水下段浸没；咬钩时整线加粗 2px（唯一强化信号）
      const lw = line.phase === 'bite' ? 2 : 1;
      const midX = (tip.x + baitX) / 2 + Math.sin(performance.now() / 500) * 2;
      const midY = (tip.y + baitY) / 2;
      const below = baitY > CFG.WATER_Y;
      const cross = below && tip.y < CFG.WATER_Y
        ? tip.x + (baitX - tip.x) * (CFG.WATER_Y - tip.y) / (baitY - tip.y)
        : null;
      if (cross != null) {
        this.ln(ctx, tip.x, tip.y, cross, CFG.WATER_Y, lw, ink);
        ctx.globalAlpha = CFG.IMMERSE_ALPHA;
        this.ln(ctx, cross, CFG.WATER_Y, baitX, baitY, lw, ink);
        ctx.globalAlpha = 1;
      } else if (below) {
        ctx.globalAlpha = CFG.IMMERSE_ALPHA;
        this.ln(ctx, tip.x, tip.y, midX, midY, lw, ink);
        this.ln(ctx, midX, midY, baitX, baitY, lw, ink);
        ctx.globalAlpha = 1;
      } else {
        this.ln(ctx, tip.x, tip.y, midX, midY, lw, ink);
        this.ln(ctx, midX, midY, baitX, baitY, lw, ink);
      }

      // 鱼饵：上钩拖出/投放阶段不画（虾代替饵挂在钩上）
      if (line.phase !== 'hooked' && line.phase !== 'dropping') {
        ctx.globalAlpha = CFG.IMMERSE_ALPHA;
        this.drawBait(ctx, baitX, baitY, G.baitKey, G);
        ctx.globalAlpha = 1;
      }

      // 咬钩信号：端点黑白方波闪烁方块（原始两极色，昼夜双背景醒目）
      if (line.phase === 'bite') {
        const blink = ((performance.now() / 130) | 0) % 2 === 0;
        const c = blink ? CFG.PALETTE.WHITE : CFG.PALETTE.INK;
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(baitX) - 7, Math.round(baitY) - 7, 14, 14);
        ctx.strokeStyle = blink ? CFG.PALETTE.INK : CFG.PALETTE.WHITE;
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(baitX) - 7, Math.round(baitY) - 7, 14, 14);
      }
    } else if (state === 'playing') {
      // 未放饵：竿尖下方小箭头提示指向水面
      const t = performance.now() / 500;
      const ax = tip.x + 14, ay = tip.y + 26;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(0.6 + Math.sin(t) * 0.15);
      ctx.fillStyle = this.alphaTone('INK', G, .5);
      ctx.beginPath();
      ctx.moveTo(-7, -6); ctx.lineTo(5, 0); ctx.lineTo(-7, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },

  // ---- 小龙虾：两色剪影（水下浸没 50% 墨，出水即纯墨） ----
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
      const tex = this._crayTint(c.species, q);
      if (tex) {
        const w = s * 2.3, h = w * (16 / 26);
        ctx.globalAlpha = c.y > CFG.WATER_Y ? CFG.IMMERSE_ALPHA : 1;   // 浸没规则
        ctx.drawImage(tex, -w / 2, -h / 2, w, h);
        ctx.globalAlpha = 1;
      }
      if (c.hooked) {
        ctx.rotate(Math.sin(performance.now() / 160) * 0.18);
      }
      ctx.restore();
    }
    ctx.imageSmoothingEnabled = true;
  },

  // ---- 波纹：墨色圆环淡出（放饵/出水的落点反馈） ----
  drawRipples(ctx, G) {
    for (const r of G.ripples) {
      ctx.strokeStyle = this.alphaTone('INK', G, 0.5 * (r.life / 40));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.min(r.r, r.max), 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // ---- 粒子：捕获=墨色圆环扩散（星星粒子不再渲染） ----
  drawParticles(ctx, G) {
    for (const p of G.particles) {
      if (p.type !== 'text') continue;
      const t = 1 - p.life / 60;                       // 0→1 扩散进度
      ctx.strokeStyle = this.alphaTone('INK', G, Math.min(1, p.life / 20));
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12 + t * 34, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // ---- HUD：左上等宽分数（唯一常驻文字） ----
  drawHUD(ctx, G) {
    ctx.fillStyle = this.pal('INK', G);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText('SCORE', 24, 20);
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.fillText(String(G.score).padStart(2, '0'), 24, 34);
  },
};
