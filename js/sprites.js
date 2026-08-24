/* ===== 素材库：所有角色与场景的绘制 =====
 * 每个函数都是纯绘制（不修改游戏状态）。
 * G = { rod, line, baitX, baitY, state, crays, ripples, bubbles, particles }
 */
const Sprites = {
  // 圆角矩形工具
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  // 颜色插值：t∈[0,1]，0→a 浅色，1→b 深色（用于按大小调色）
  mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const r = ((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t;
    const g = ((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t;
    const bl = (pa & 255) + ((pb & 255) - (pa & 255)) * t;
    return `rgb(${r | 0},${g | 0},${bl | 0})`;
  },

  // 颜色工具：clamp01 / hex→[r,g,b] / 三通道插值 / 数组→字符串（供日夜渐变用）
  clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; },
  hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; },
  mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; },
  rgb(c) { return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; },

  // ---- 天空：随时间变化的渐变 + 云 + 远山（太阳/月亮见 drawCelestial） ----
  drawSky(ctx, G) {
    const { W, H, WATER_Y } = CFG;
    const t = G.time == null ? 0.5 : G.time;
    const p = ((t - 0.25 + 1) % 1) / 0.5 * Math.PI;
    const el = Math.sin(p);                          // 太阳高度：-1（深夜）~ 1（正午）
    const dayW = this.clamp01((el - 0.12) / 0.38);   // 1=白昼蓝天
    const duskW = this.clamp01(1 - Math.abs(el) / 0.4);  // 1=晨昏暖色
    // 三色调和：夜蓝 ↔ 天蓝，再叠晨昏暖橙
    const top = this.mix3(this.mix3(this.hex('#0d1b38'), this.hex('#3f9fd6'), dayW), this.hex('#f09a4e'), duskW);
    const mid = this.mix3(this.mix3(this.hex('#123055'), this.hex('#6fc2e6'), dayW), this.hex('#ffc080'), duskW);
    const bot = this.mix3(this.mix3(this.hex('#15264a'), this.hex('#a8dff2'), dayW), this.hex('#ffd9a0'), duskW);
    const g = ctx.createLinearGradient(0, 0, 0, WATER_Y + 20);
    g.addColorStop(0, this.rgb(top));
    g.addColorStop(0.5, this.rgb(mid));
    g.addColorStop(1, this.rgb(bot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, WATER_Y + 20);
    // 云（夜里变暗）
    ctx.fillStyle = `rgba(235, 240, 255, ${0.25 + 0.6 * dayW})`;
    this.drawCloud(ctx, 120, 55, 1);
    this.drawCloud(ctx, 430, 90, 0.7);
    this.drawCloud(ctx, 700, 45, 0.85);
    // 远山（夜里压暗）
    ctx.fillStyle = `rgba(${30 + 60 * dayW | 0}, ${70 + 90 * dayW | 0}, ${40 + 50 * dayW | 0}, .55)`;
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
  },

  // 日月星辰几何信息：drawCelestial 绘制 / drawLighting 抠遮罩共用，避免位置不一致
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

  // ---- 全局光照：夜晚调暗、晨昏偏暖。用 evenodd 路径在遮罩上抠掉日月星辰，保持其明亮 ----
  drawLighting(ctx, G) {
    const { W, H } = CFG;
    const t = G.time == null ? 0.5 : G.time;
    const p = ((t - 0.25 + 1) % 1) / 0.5 * Math.PI;
    const el = Math.sin(p);
    const light = this.clamp01(el * 1.4);          // 0=深夜 1=正午
    const dark = (1 - light) * 0.62;               // 夜晚暗度（保留可见度）
    const nearHorizon = Math.abs(el);
    const warm = nearHorizon < 0.35 && el > -0.12 ? (0.35 - nearHorizon) / 0.35 : 0;  // 晨昏暖色
    const r = 6 + warm * 92, gg = 12 + warm * 42, b = 38 - warm * 8;
    const info = this.celestialInfo(G);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);                          // 整屏
    if (info.sun) ctx.arc(info.sun.x, info.sun.y, 30, 0, Math.PI * 2);    // 抠掉太阳
    if (info.moon) ctx.arc(info.moon.x, info.moon.y, 24, 0, Math.PI * 2); // 抠掉月亮
    if (info.stars) for (const st of info.stars) ctx.arc(st.x, st.y, 2, 0, Math.PI * 2);  // 抠掉星星
    ctx.fillStyle = `rgba(${r | 0},${gg | 0},${b | 0},${dark})`;
    ctx.fill('evenodd');
    // 暗角：边缘轻微压暗，聚焦画面中央
    const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.5, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.22)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  },

  // ---- 日月星辰（背景层）：太阳东升西落、月亮夜晚升起、星星闪烁 ----
  drawCelestial(ctx, G) {
    const info = this.celestialInfo(G);
    const now = performance.now() / 1000;
    // 星星
    if (info.stars) {
      for (const st of info.stars) {
        const tw = 0.5 + 0.5 * Math.sin(now * 2 + st.ph);
        ctx.fillStyle = `rgba(255,255,255,${(info.night - 0.35) / 0.65 * tw})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 太阳
    if (info.sun) {
      const { x: sx, y: sy } = info.sun;
      const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 62);
      glow.addColorStop(0, 'rgba(255, 235, 160, .8)');
      glow.addColorStop(1, 'rgba(255, 235, 160, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe98a';
      ctx.beginPath();
      ctx.arc(sx, sy, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    // 月亮
    if (info.moon) {
      const { x: mx, y: my } = info.moon;
      const glow = ctx.createRadialGradient(mx, my, 4, mx, my, 52);
      glow.addColorStop(0, 'rgba(215, 230, 255, .75)');
      glow.addColorStop(1, 'rgba(215, 230, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(mx, my, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2f6ff';                    // 月盘
      ctx.beginPath();
      ctx.arc(mx, my, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(190, 205, 230, .6)';    // 环形山
      ctx.beginPath();
      ctx.arc(mx - 4, my - 3, 3.2, 0, Math.PI * 2);
      ctx.arc(mx + 5, my + 4, 2.4, 0, Math.PI * 2);
      ctx.arc(mx + 1, my + 6, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawCloud(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, 18 * s, 0, Math.PI * 2);
    ctx.arc(x + 22 * s, y - 10 * s, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 46 * s, y, 17 * s, 0, Math.PI * 2);
    ctx.fill();
  },

  // ---- 岸边（左）+ 池塘水体（右） ----
  drawShoreAndWater(ctx, G) {
    const { W, H, SHORE_X, WATER_Y } = CFG;
    // 岸边泥土
    const dirt = ctx.createLinearGradient(0, WATER_Y, 0, H);
    dirt.addColorStop(0, '#8d6e4e');
    dirt.addColorStop(0.4, '#7a5c3f');
    dirt.addColorStop(1, '#5d452e');
    ctx.fillStyle = dirt;
    ctx.fillRect(0, WATER_Y + 4, SHORE_X, H - WATER_Y - 4);
    // 草皮
    const grass = ctx.createLinearGradient(0, WATER_Y - 8, 0, WATER_Y + 16);
    grass.addColorStop(0, '#5cb85c');
    grass.addColorStop(1, '#3f8f3f');
    ctx.fillStyle = grass;
    ctx.fillRect(0, WATER_Y - 8, SHORE_X, 26);
    // 岸边边缘泥土剖面
    ctx.fillStyle = '#6b4c33';
    this.roundRect(ctx, SHORE_X - 14, WATER_Y + 6, 14, 18, 4);
    ctx.fill();
    // 小草
    ctx.strokeStyle = '#6fd06f';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const gx = (i * 41 + 15) % SHORE_X;
      const gy = WATER_Y - 4 + (i * 17) % 8;
      const gh = 6 + (i % 3) * 3;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.quadraticCurveTo(gx + 3, gy - gh / 2, gx + Math.sin(i) * 4, gy - gh);
      ctx.stroke();
    }
    // 岸边小石头
    ctx.fillStyle = 'rgba(140, 120, 100, .8)';
    for (let i = 0; i < 4; i++) {
      const sx = 20 + i * 60, sy = WATER_Y + 26 + (i % 2) * 14;
      const sr = 5 + (i % 2) * 4;
      ctx.beginPath();
      ctx.ellipse(sx, sy, sr, sr * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // 灌木丛
    ctx.fillStyle = 'rgba(44, 130, 60, .9)';
    ctx.beginPath();
    ctx.arc(55, WATER_Y - 6, 16, Math.PI, 0);
    ctx.arc(85, WATER_Y - 4, 13, Math.PI, 0);
    ctx.fill();

    // 池塘水体
    const water = ctx.createLinearGradient(0, WATER_Y, 0, H);
    water.addColorStop(0, 'rgba(50, 135, 175, .5)');
    water.addColorStop(0.5, 'rgba(35, 105, 150, .6)');
    water.addColorStop(1, 'rgba(25, 75, 115, .75)');
    ctx.fillStyle = water;
    ctx.fillRect(SHORE_X, WATER_Y, W - SHORE_X, H - WATER_Y);
    // 水底淤泥
    const mud = ctx.createLinearGradient(0, H - 60, 0, H);
    mud.addColorStop(0, '#8d6e4e');
    mud.addColorStop(1, '#6b5238');
    ctx.fillStyle = mud;
    ctx.fillRect(SHORE_X, H - 60, W - SHORE_X, 60);
    // 水底石头
    ctx.fillStyle = 'rgba(120, 100, 80, .55)';
    for (let i = 0; i < 10; i++) {
      const sx = SHORE_X + 30 + ((i * 173 + 40) % (W - SHORE_X - 60));
      const sy = H - 40 - (i % 3) * 10;
      const sr = 6 + (i % 3) * 4;
      ctx.beginPath();
      ctx.ellipse(sx, sy, sr, sr * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // ---- 水草（随波摆动） ----
  drawPondDetails(ctx, G) {
    const { W, H, SHORE_X } = CFG;
    for (let i = 0; i < 14; i++) {
      const gx = SHORE_X + 30 + ((i * 97 + 20) % (W - SHORE_X - 60));
      const gy = H - 46 - (i % 2) * 8;
      const gh = 30 + (i % 3) * 14;
      ctx.strokeStyle = i % 2 ? '#3f8f3f' : '#2f7a2f';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.quadraticCurveTo(gx + Math.sin(performance.now() / 900 + i) * 4, gy - gh / 2, gx + Math.sin(performance.now() / 700 + i * 2) * 7, gy - gh);
      ctx.stroke();
    }
  },

  // ---- 龙虾洞（水底泥岸上的洞穴，虾可钻进钻出） ----
  drawHoles(ctx, G) {
    for (const h of CFG.HOLES) {
      // 洞口外沿的土堆
      ctx.fillStyle = 'rgba(120, 96, 70, .9)';
      ctx.beginPath();
      ctx.ellipse(h.x + 8, h.y + 3, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // 洞口（深色椭圆）
      ctx.fillStyle = '#3b2a1c';
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, 13, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(20, 12, 8, .9)';
      ctx.beginPath();
      ctx.ellipse(h.x, h.y - 1, 9, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // ---- 水面（波浪 + 高光） ----
  drawWaterSurface(ctx, G) {
    const { W, SHORE_X, WATER_Y } = CFG;
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1.5;
    const t = performance.now() / 1000;
    for (let i = 0; i < 6; i++) {
      const wy = WATER_Y + 12 + i * 16;
      ctx.beginPath();
      for (let x = SHORE_X; x <= W; x += 8) {
        const y = wy + Math.sin(x / 34 + t * 1.4 + i * 1.7) * 3;
        x === SHORE_X ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    for (let i = 0; i < 5; i++) {
      const hx = SHORE_X + 40 + ((i * 220 + 60 + Math.sin(t * 0.6 + i) * 30) % (W - SHORE_X - 80));
      ctx.beginPath();
      ctx.ellipse(hx, WATER_Y + 6 + (i % 2) * 10, 26, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // ---- 岸边钓鱼人 ----
  drawPlayer(ctx, G) {
    const { WATER_Y } = CFG;
    const rod = G.rod;
    const px = rod.baseX - 16;   // 玩家中心
    const py = WATER_Y + 6;      // 脚底
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.beginPath();
    ctx.ellipse(px, py, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // 腿
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px - 6, py - 20);
    ctx.lineTo(px - 11, py);
    ctx.moveTo(px + 6, py - 20);
    ctx.lineTo(px + 11, py);
    ctx.stroke();
    // 身体
    ctx.fillStyle = '#2e86de';
    ctx.beginPath();
    ctx.ellipse(px, py - 42, 15, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // 手臂伸向钓竿
    ctx.strokeStyle = '#2e86de';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(px + 13, py - 48);
    ctx.quadraticCurveTo(rod.baseX - 4, py - 46, rod.baseX, rod.baseY + 6);
    ctx.stroke();
    // 手
    ctx.fillStyle = '#f5cba7';
    ctx.beginPath();
    ctx.arc(rod.baseX, rod.baseY + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    // 头
    ctx.fillStyle = '#f5cba7';
    ctx.beginPath();
    ctx.arc(px, py - 62, 11, 0, Math.PI * 2);
    ctx.fill();
    // 帽子
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.ellipse(px, py - 67, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py - 71, 8, Math.PI, 0);
    ctx.fill();
  },

  // ---- 岸边水桶（放虾的目标） ----
  drawBucket(ctx, G) {
    const b = CFG.BUCKET;
    const t = performance.now() / 1000;
    // 可投放时的金色光晕
    if (G.dropReady) {
      const pulse = 0.28 + 0.22 * Math.sin(t * 6);
      ctx.fillStyle = `rgba(255, 214, 102, ${pulse})`;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 46, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 214, 102, .8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 30, 24, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 桶身
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(b.x - 20, b.y - 18, 40, 36);
    // 桶箍
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(b.x - 20, b.y - 8, 40, 4);
    ctx.fillRect(b.x - 20, b.y + 6, 40, 4);
    // 桶底
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(b.x - 18, b.y + 16, 36, 3);
    // 桶口
    ctx.fillStyle = '#4e342e';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 18, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2a22';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 18, 17, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 桶里探头的小龙虾（最近钓到的几只）
    const peek = G.bucketCrays.slice(-3);
    peek.forEach((c, i) => {
      const pxc = b.x - 10 + i * 10;
      const pyc = b.y - 20;
      const bob2 = Math.sin(t * 3 + i * 2) * 1.5;
      ctx.save();
      ctx.translate(pxc, pyc + bob2);
      const s = Math.min(c.size * 0.5, 9);
      const shade = Math.max(0, Math.min(1, (c.size - 10) / 16));
      const sp = CFG.CRAY_SPECIES[c.species] || CFG.CRAY_SPECIES.red;
      // 头（颜色随种类）
      ctx.fillStyle = this.mixHex(sp.body[0][1], sp.body[1][1], shade);
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s * 0.35, -s * 0.25, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(s * 0.42, -s * 0.25, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      // 触须
      ctx.strokeStyle = this.mixHex('#f5a33c', '#a93226', shade);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.6, -s * 1.3, s * 0.9, -s * 1.1);
      ctx.stroke();
      ctx.restore();
    });
  },

  // ---- 饵料盒（水桶旁的小木盒，展示当前饵料） ----
  drawBaitBox(ctx, G) {
    const b = CFG.BAITBOX;
    const bait = CFG.BAITS[G.activeBait] || CFG.BAITS.snail_s;
    // 盒身
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(b.x - 20, b.y - 14, 40, 28);
    // 盒底阴影
    ctx.fillStyle = 'rgba(60, 40, 22, .6)';
    ctx.fillRect(b.x - 20, b.y + 12, 40, 3);
    // 盒口（椭圆开口）
    ctx.fillStyle = '#9c7b52';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 14, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4e3a24';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 14, 15, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // 盒内饵料（按当前类型画小图标）
    this.drawBait(ctx, b.x, b.y - 14, G.activeBait);
  },

  // ---- 荷叶（水面浮叶，钓起的虾碰到会掉落） ----
  drawLeaves(ctx, G) {
    const t = performance.now() / 1000;
    for (const leaf of CFG.LEAVES) {
      const bob = Math.sin(t * 1.2 + leaf.x * 0.01) * 1.5;   // 随波轻摆
      ctx.save();
      ctx.translate(leaf.x, leaf.y + bob);
      // 叶片（径向渐变）
      const g = ctx.createRadialGradient(-leaf.r * 0.3, -leaf.r * 0.3, 2, 0, 0, leaf.r);
      g.addColorStop(0, '#8ed05a');
      g.addColorStop(1, '#2f8f3f');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, leaf.r, 0, Math.PI * 2);
      ctx.fill();
      // 边缘缺口（深色豁口）
      ctx.fillStyle = 'rgba(20, 90, 40, .55)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, leaf.r * 0.9, Math.PI * 0.12, Math.PI * 0.5);
      ctx.closePath();
      ctx.fill();
      // 叶脉
      ctx.strokeStyle = 'rgba(20, 90, 40, .5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-leaf.r * 0.65, 0);
      ctx.lineTo(leaf.r * 0.65, 0);
      ctx.moveTo(0, -leaf.r * 0.65);
      ctx.lineTo(0, leaf.r * 0.65);
      ctx.stroke();
      ctx.restore();
    }
  },

  // ---- 波纹 ----
  drawRipples(ctx, G) {
    for (const r of G.ripples) {
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (r.life / 40)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.min(r.r, r.max), 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // ---- 鱼饵（按种类绘制：田螺/青蛙/猪肝） ----
  drawBait(ctx, x, y, key) {
    if (key === 'frog_s' || key === 'frog_l') {
      const k = key === 'frog_l' ? 1.35 : 1;   // 大青蛙更大
      ctx.fillStyle = '#6ab04c';               // 青蛙：绿身 + 眼睛
      ctx.beginPath();
      ctx.ellipse(x, y, 4.5 * k, 3.5 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + 2 * k, y - 2 * k, 1.6 * k, 0, Math.PI * 2);
      ctx.arc(x - 2 * k, y - 2 * k, 1.6 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(x + 2.2 * k, y - 2.2 * k, 0.8 * k, 0, Math.PI * 2);
      ctx.arc(x - 1.8 * k, y - 2.2 * k, 0.8 * k, 0, Math.PI * 2);
      ctx.fill();
    } else if (key === 'liver') {
      ctx.fillStyle = '#7e2f22';               // 猪肝：暗红肉块
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 1);
      ctx.quadraticCurveTo(x - 1, y - 4, x + 3, y - 1.5);
      ctx.quadraticCurveTo(x + 5, y + 2, x + 2, y + 4);
      ctx.quadraticCurveTo(x - 3, y + 5, x - 4, y + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,180,150,.35)'; // 光泽
      ctx.beginPath();
      ctx.arc(x - 1, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else {                                   // 田螺：壳 + 螺旋纹
      const k = key === 'snail_l' ? 1.3 : 1;   // 大田螺更大
      ctx.fillStyle = '#a08c68';
      ctx.beginPath();
      ctx.arc(x, y, 3.6 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6f5f43';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, 1.6 * k, 0.8, Math.PI * 2.2);
      ctx.stroke();
    }
  },

  // ---- 钓竿 + 鱼线 + 鱼饵 ----
  drawLine(ctx, G) {
    const { rod, line, baitX, baitY, state } = G;
    // 钓竿（模拟竹竿）：竿梢下垂在 game.js 的物理更新里计算，这里画竿身弧线。
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
    ctx.strokeStyle = '#b08948';      // 竹竿黄褐色
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rod.baseX, rod.baseY);
    ctx.quadraticCurveTo(cx, cy, tip.x, tip.y);
    ctx.stroke();
    // 竹节纹理（沿竿身垂直于切线的短横纹）
    ctx.strokeStyle = 'rgba(92, 64, 34, .55)';
    ctx.lineWidth = 1.4;
    for (const t of [0.3, 0.55, 0.8]) {
      const mt = 1 - t;
      const px = mt * mt * rod.baseX + 2 * mt * t * cx + t * t * tip.x;
      const py = mt * mt * rod.baseY + 2 * mt * t * cy + t * t * tip.y;
      const tx = 2 * mt * (cx - rod.baseX) + 2 * t * (tip.x - cx);
      const ty = 2 * mt * (cy - rod.baseY) + 2 * t * (tip.y - cy);
      const tl = Math.hypot(tx, ty) || 1;
      ctx.beginPath();
      ctx.moveTo(px - ty / tl * 4, py + tx / tl * 4);
      ctx.lineTo(px + ty / tl * 4, py - tx / tl * 4);
      ctx.stroke();
    }
    // 竿尖装饰
    ctx.fillStyle = '#ff8c42';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 鱼线（固定长度，从竿尖垂向饵）
    if (rod.baitInWater) {
      const bx = baitX;
      const by = baitY;
      const midX = (tip.x + bx) / 2 + Math.sin(performance.now() / 500) * 2;
      const midY = (tip.y + by) / 2;
      ctx.strokeStyle = 'rgba(240, 240, 240, .8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.quadraticCurveTo(midX, midY, bx, by);
      ctx.stroke();

      // 鱼饵（按种类绘制）—— 上钩拖出/投放阶段不画，虾代替饵挂在钩上
      if (line.phase !== 'hooked' && line.phase !== 'dropping') {
        this.drawBait(ctx, bx, by + 2, G.baitKey);
      }

      // 咬钩警示圈
      if (line.phase === 'bite') {
        ctx.strokeStyle = `rgba(255, 82, 82, ${0.6 + Math.sin(line.biteTimer * 0.5) * 0.4})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(bx, by, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (state === 'playing') {
      // 未放饵时：提示箭头指向水面
      const t = performance.now() / 500;
      const ax = tip.x + 14, ay = tip.y + 26;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(0.6 + Math.sin(t) * 0.15);
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.beginPath();
      ctx.moveTo(-7, -6); ctx.lineTo(5, 0); ctx.lineTo(-7, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },

  // ---- 小龙虾 ----
  drawCrays(ctx, G) {
    for (const c of G.crays) {
      if (c.state === 'inHole') continue;   // 藏在洞里时不绘制
      const bob = Math.sin(c.wiggle) * 1.5;
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.scale(c.dir, 1);
      const s = c.size;
      // 种类决定底色，大小在浅↔深之间插值（小浅大深）
      const sp = CFG.CRAY_SPECIES[c.species] || CFG.CRAY_SPECIES.red;
      const shade = Math.max(0, Math.min(1, (s - 10) / 16));
      const tailCol = this.mixHex(sp.tail[0], sp.tail[1], shade);
      const clawCol = this.mixHex(sp.claw[0], sp.claw[1], shade);
      if (sp.special === 'soft') ctx.globalAlpha = 0.92;   // 软皮壳半透
      // 身体
      const bodyG = ctx.createLinearGradient(0, -s, 0, s);
      bodyG.addColorStop(0, this.mixHex(sp.body[0][0], sp.body[1][0], shade));
      bodyG.addColorStop(0.6, this.mixHex(sp.body[0][1], sp.body[1][1], shade));
      bodyG.addColorStop(1, this.mixHex(sp.body[0][2], sp.body[1][2], shade));
      ctx.fillStyle = bodyG;
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      // 老龙虾：背甲上的深色皱纹斑
      if (sp.special === 'old') {
        ctx.fillStyle = 'rgba(50, 30, 12, .5)';
        ctx.beginPath();
        ctx.arc(-s * 0.08, -s * 0.22, s * 0.09, 0, Math.PI * 2);
        ctx.arc(s * 0.16, s * 0.08, s * 0.07, 0, Math.PI * 2);
        ctx.arc(-s * 0.24, s * 0.2, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      // 尾巴
      ctx.fillStyle = tailCol;
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.2);
      ctx.lineTo(-s * 1.3, -s * 0.55);
      ctx.lineTo(-s * 1.3, s * 0.55);
      ctx.lineTo(-s * 0.7, s * 0.2);
      ctx.closePath();
      ctx.fill();
      // 带籽母龙虾：尾下一簇卵
      if (sp.special === 'eggs') {
        ctx.fillStyle = 'rgba(255, 160, 70, .95)';
        for (let i = 0; i < 10; i++) {
          const ex = -s * (0.5 + (i % 4) * 0.14);
          const ey = s * (0.52 + Math.floor(i / 4) * 0.15);
          ctx.beginPath();
          ctx.arc(ex, ey, s * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // 大钳子（单钳龙虾少一只钳，只剩残肢）
      ctx.strokeStyle = clawCol;
      ctx.lineWidth = s * 0.16;
      ctx.lineCap = 'round';
      const clawWave = Math.sin(c.wiggle * 1.6) * 0.15;
      ctx.beginPath();
      ctx.moveTo(s * 0.6, -s * 0.35);
      ctx.quadraticCurveTo(s * 1.05, -s * 0.7, s * 1.25, -s * 0.55);
      ctx.quadraticCurveTo(s * 1.15, -s * 0.3, s * 0.95, -s * 0.2);
      ctx.stroke();
      if (sp.special === 'single') {
        ctx.beginPath();                                   // 残肢
        ctx.moveTo(s * 0.6, s * 0.35);
        ctx.lineTo(s * 0.82, s * 0.5);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(s * 0.6, s * 0.35);
        ctx.quadraticCurveTo(s * 1.05, s * 0.7, s * 1.25, s * 0.55);
        ctx.quadraticCurveTo(s * 1.15, s * 0.3, s * 0.95, s * 0.2);
        ctx.stroke();
      }
      // 软皮龙虾：壳上一道高光
      if (sp.special === 'soft') {
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -s * 0.12, s * 0.78, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s * 0.45, -s * 0.22, s * 0.16, 0, Math.PI * 2);
      ctx.arc(s * 0.45, s * 0.22, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(s * 0.5 + s * 0.06, -s * 0.22, s * 0.07, 0, Math.PI * 2);
      ctx.arc(s * 0.5 + s * 0.06, s * 0.22, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      // 触须
      ctx.strokeStyle = clawCol;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s * 0.4, -s * 0.4);
      ctx.quadraticCurveTo(s * 0.9, -s * 0.9, s * 1.1, -s * 0.8);
      ctx.moveTo(s * 0.4, s * 0.4);
      ctx.quadraticCurveTo(s * 0.9, s * 0.9, s * 1.1, s * 0.8);
      ctx.stroke();
      // 被钓住的虾：悬挂摆动
      if (c.hooked) {
        ctx.rotate(Math.sin(performance.now() / 160) * 0.18);
      }
      ctx.restore();
    }
  },

  // ---- 气泡 ----
  drawBubbles(ctx, G) {
    for (const b of G.bubbles) {
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * (b.life / 60)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.25 * (b.life / 60)})`;
      ctx.fill();
    }
  },

  // ---- 飘字 / 星星粒子 ----
  drawParticles(ctx, G) {
    for (const p of G.particles) {
      const alpha = Math.min(1, p.life / 30);
      if (p.type === 'text') {
        ctx.font = 'bold 20px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.4})`;
        ctx.fillText(p.text, p.x + 1, p.y + 1);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillText(p.text, p.x, p.y);
        ctx.globalAlpha = 1;
      } else if (p.type === 'star') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✦', p.x, p.y);
        ctx.globalAlpha = 1;
      }
    }
  },
};
