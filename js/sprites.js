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

  // ---- 天空：渐变 + 太阳 + 云 + 远山 ----
  drawSky(ctx, G) {
    const { W, H, WATER_Y } = CFG;
    const g = ctx.createLinearGradient(0, 0, 0, WATER_Y + 20);
    g.addColorStop(0, '#7ec8e3');
    g.addColorStop(1, '#b5e8f5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, WATER_Y + 20);
    // 太阳
    ctx.fillStyle = 'rgba(255, 220, 120, .9)';
    ctx.beginPath();
    ctx.arc(W - 90, 60, 26, 0, Math.PI * 2);
    ctx.fill();
    // 云
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    this.drawCloud(ctx, 120, 55, 1);
    this.drawCloud(ctx, 430, 90, 0.7);
    this.drawCloud(ctx, 700, 45, 0.85);
    // 远山
    ctx.fillStyle = 'rgba(90, 160, 90, .55)';
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
      // 头
      ctx.fillStyle = '#c0392b';
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
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.6, -s * 1.3, s * 0.9, -s * 1.1);
      ctx.stroke();
      ctx.restore();
    });
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

  // ---- 钓竿 + 鱼线 + 鱼饵 ----
  drawLine(ctx, G) {
    const { rod, line, baitX, baitY, state } = G;
    // 钓竿
    const tip = { x: rod.x, y: rod.y };
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rod.baseX, rod.baseY);
    ctx.quadraticCurveTo(tip.x - 2, (rod.baseY + tip.y) / 2, tip.x, tip.y);
    ctx.stroke();
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

      // 鱼饵（小蚯蚓）—— 上钩拖出/投放阶段不画，虾代替饵挂在钩上
      if (line.phase !== 'hooked' && line.phase !== 'dropping') {
        ctx.strokeStyle = '#d35400';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + 4, by + 3, bx, by + 6);
        ctx.quadraticCurveTo(bx - 4, by + 9, bx, by + 12);
        ctx.stroke();
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();
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
      const bob = Math.sin(c.wiggle) * 1.5;
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.scale(c.dir, 1);
      const s = c.size;
      // 身体
      const bodyG = ctx.createLinearGradient(0, -s, 0, s);
      bodyG.addColorStop(0, '#e05f1a');
      bodyG.addColorStop(0.6, '#c0392b');
      bodyG.addColorStop(1, '#922b21');
      ctx.fillStyle = bodyG;
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      // 尾巴
      ctx.fillStyle = '#a93226';
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.2);
      ctx.lineTo(-s * 1.3, -s * 0.55);
      ctx.lineTo(-s * 1.3, s * 0.55);
      ctx.lineTo(-s * 0.7, s * 0.2);
      ctx.closePath();
      ctx.fill();
      // 大钳子
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = s * 0.16;
      ctx.lineCap = 'round';
      const clawWave = Math.sin(c.wiggle * 1.6) * 0.15;
      ctx.beginPath();
      ctx.moveTo(s * 0.6, -s * 0.35);
      ctx.quadraticCurveTo(s * 1.05, -s * 0.7, s * 1.25, -s * 0.55);
      ctx.quadraticCurveTo(s * 1.15, -s * 0.3, s * 0.95, -s * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.6, s * 0.35);
      ctx.quadraticCurveTo(s * 1.05, s * 0.7, s * 1.25, s * 0.55);
      ctx.quadraticCurveTo(s * 1.15, s * 0.3, s * 0.95, s * 0.2);
      ctx.stroke();
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
      ctx.strokeStyle = '#e74c3c';
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
