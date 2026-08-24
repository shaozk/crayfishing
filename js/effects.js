/* ===== 特效工具：气泡 / 水花 / 特效更新 ===== */
(() => {
  const G = Game;

  // 生成气泡
  G.spawnBubbles = function (x, y, n) {
    for (let i = 0; i < n; i++) {
      G.bubbles.push({
        x: x + G.rand(-10, 10), y: y + G.rand(0, 12),
        r: G.rand(1.5, 4), vy: -G.rand(0.6, 1.8), life: G.rand(30, 60)
      });
    }
  };

  // 出水/落水水花
  G.splashAt = function (x) {
    G.ripples.push({ x, y: CFG.WATER_Y + 8, r: 5, max: 42, life: 34 });
    for (let i = 0; i < 10; i++) {
      G.bubbles.push({
        x: x + G.rand(-14, 14), y: CFG.WATER_Y + G.rand(0, 14),
        r: G.rand(1.5, 4), vy: -G.rand(0.8, 2.2), life: G.rand(30, 60)
      });
    }
  };

  // 特效每帧更新：波纹扩散、气泡上浮、粒子飘动
  G.updateEffects = function () {
    G.ripples = G.ripples.filter(r => { r.r += 0.8; r.life--; return r.life > 0; });
    G.bubbles = G.bubbles.filter(b => { b.y += b.vy; b.vy *= 0.98; b.life--; return b.life > 0; });
    G.particles = G.particles.filter(p => {
      if (p.type === 'star') { p.x += p.vx; p.y += p.vy; p.vy += 0.08; }
      p.life--;
      p.y -= 0.6;
      return p.life > 0;
    });
    for (const b of G.bucketCrays) b.t++;
  };
})();
