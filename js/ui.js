/* ===== UI：水桶统计面板 / 饵料剩余提示 ===== */
(() => {
  const G = Game;

  // ---- 水桶统计面板（按种类计数，点水桶查看） ----
  const bucketPanel = document.getElementById('bucketPanel');
  const speciesListEl = document.getElementById('speciesList');
  const totalCountEl = document.getElementById('totalCount');
  document.getElementById('bpClose').addEventListener('click', () => bucketPanel.classList.add('hidden'));

  G.renderBucketPanel = function () {
    let html = '';
    let total = 0;
    for (const [key, sp] of Object.entries(CFG.CRAY_SPECIES)) {
      const n = G.caughtCounts[key] || 0;
      total += n;
      const c = Sprites.rgb(Sprites.mix3(Sprites.hex(sp.body[0][1]), Sprites.hex(sp.body[1][1]), 0.4));
      html += `<div class="row${n ? '' : ' zero'}"><span class="dot" style="background:${c}"></span><span class="name">${sp.name}</span><span class="num">×${n}</span></div>`;
    }
    speciesListEl.innerHTML = html;
    totalCountEl.textContent = total;
  };

  G.toggleBucketPanel = function () {
    G.renderBucketPanel();
    bucketPanel.classList.toggle('hidden');
  };

  // ---- 饵料剩余提示（点击饵料盒时短暂显示，不常驻） ----
  const baitInfoEl = document.getElementById('baitInfo');
  let baitInfoTimer = 0;

  G.showBaitInfo = function (key) {
    const b = CFG.BAITS[key];
    const left = Math.max(0, Math.round(G.baitDura[key]));
    baitInfoEl.innerHTML = `${b.icon} ${b.name}：剩余 ${left}/${b.dur}`;
    // 定位在饵料盒旁边（画布坐标 → 屏幕坐标）
    const rect = G.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / CFG.W, rect.height / CFG.H);
    const ox = (rect.width - CFG.W * scale) / 2;
    const oy = (rect.height - CFG.H * scale) / 2;
    baitInfoEl.style.left = (rect.left + ox + CFG.BAITBOX.x * scale) + 'px';
    baitInfoEl.style.top = (rect.top + oy + CFG.BAITBOX.y * scale - 34) + 'px';
    baitInfoEl.style.transform = 'translateX(-50%)';
    baitInfoEl.classList.remove('hidden');
    clearTimeout(baitInfoTimer);
    baitInfoTimer = setTimeout(() => baitInfoEl.classList.add('hidden'), 2500);
  };
})();
