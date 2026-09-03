/* ===== 输入：握竿拖拽 + 点击交互（由 Phaser Scene 桥接，直接传入画布坐标） =====
 * 交互模型：按住竿身任意位置=握住该处；拖动=竿指向鼠标方位（绝对指向）+
 * 玩家随鼠标横向走位；松手=竿定格、指针完全空闲。
 * 点击语义分流：非紧急阶段按下竿身→握竿，其余点击→原 handleClick（放饵/收杆/投放/桶/饵盒）。
 */
(() => {
  const G = Game;

  // 紧急阶段（点击=动作）不允许开始握竿，防止忙乱中点竿误触；已握住则继续跟手
  const AIM_PHASES = ['idle', 'sinking', 'waiting', 'hooked'];

  // 点到竿身线段（肩→梢）的投影比例 t∈[0.08,0.95]；距离超过命中半径返回 -1
  G.rodHit = function (cx, cy) {
    const { baseX: sx, baseY: sy, x: tx, y: ty } = G.rod;
    const dx = tx - sx, dy = ty - sy;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0.08, Math.min(0.95, ((cx - sx) * dx + (cy - sy) * dy) / len2));
    const d = Math.hypot(cx - (sx + dx * t), cy - (sy + dy * t));
    return d <= CFG.GRIP_HIT_R ? t : -1;
  };

  function setCursor(c) {
    if (G.canvas) G.canvas.style.cursor = c;
  }

  // 指针移动：仅握竿拖动时生效；非握持时只做悬停光标反馈（web 通用约定，无视觉新增）
  G.handleMove = function (cx, cy) {
    if (!G.rodHeld) return;
    if (G.rod.gripping) {
      const sx = G.rod.baseX, sy = G.rod.baseY;
      if (Math.hypot(cx - sx, cy - sy) >= CFG.GRIP_DEADZONE) {
        G.rod.theta = G.clamp(Math.atan2(cy - sy, cx - sx), -0.7, 0.84);
      }
      G.playerX = G.clamp(cx, 60, CFG.SHORE_X - 26);
    } else {
      setCursor(G.rodHit(cx, cy) >= 0 ? 'grab' : '');
    }
  };

  // 按下：优先尝试握竿（命中竿身且处于非紧急阶段）；否则走原点击交互
  G.handleDown = function (cx, cy) {
    if (G.state !== 'playing') return;
    if (!G.rod.gripping && AIM_PHASES.includes(G.line.phase)) {
      const t = G.rodHit(cx, cy);
      if (t >= 0) {
        G.rod.gripping = true;
        G.rod.gripT = t;
        setCursor('grabbing');
        return;
      }
    }
    G.handleClick(cx, cy);
  };

  // 松手：结束握持（不触发任何点击）
  G.handleUp = function () {
    if (G.rod.gripping) {
      G.rod.gripping = false;
      setCursor('');
    }
  };
  // 指针拖出画布外松开的兜底
  window.addEventListener('pointerup', () => G.handleUp());

  // F 键：捡起 / 放下钓竿。放下时竿落在地面；捡起必须靠近地上的竿（不弹提示）
  G.toggleRod = function () {
    if (G.rodHeld) {
      // 放下：竿落在人物当前的位置，收回鱼线、释放挂钩的虾、强制松手
      G.rodGroundX = G.playerX;
      G.rodHeld = false;
      G.rod.gripping = false;
      G.rod.baitInWater = false;
      G.line.phase = 'idle';
      G.castBait = null;
      G.dropReady = false;
      for (const c of G.crays.filter(c => c.hooked)) {
        c.hooked = false;
        c.state = 'toHome';
      }
    } else if (Math.abs(G.playerX - G.rodGroundX) <= 45) {
      // 捡起：必须走到地上的钓竿旁边才能拿起
      G.rodHeld = true;
    }
    // 不弹任何提示文字（模拟现实：竿在地上就是信号）
  };

  // 键盘：←/→（或 A/D）控制人物沿岸边移动；F 捡起/放下钓竿
  G.keyLeft = false; G.keyRight = false;
  function isLeft(k) { return k === 'ArrowLeft' || k === 'a' || k === 'A'; }
  function isRight(k) { return k === 'ArrowRight' || k === 'd' || k === 'D'; }
  window.addEventListener('keydown', e => {
    if (isLeft(e.key)) { G.keyLeft = true; e.preventDefault(); }
    else if (isRight(e.key)) { G.keyRight = true; e.preventDefault(); }
    else if (e.key === 'f' || e.key === 'F') { if (!e.repeat) G.toggleRod(); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => {
    if (isLeft(e.key)) G.keyLeft = false;
    else if (isRight(e.key)) G.keyRight = false;
  });

  // 鼠标滚轮：调节线长（上滚放长、下滚缩短；缩短部分缠在竹竿上）
  G.handleWheel = function (dy) {
    G.lineLen = G.clamp(G.lineLen - dy * CFG.LINE_WHEEL_SPEED, CFG.LINE_MIN, CFG.LINE_MAX);
  };

  // 点击交互：放饵 / 收杆 / 投放进桶 / 水桶 / 饵料盒（cx, cy 为画布坐标）
  G.handleClick = function (cx, cy) {
    if (G.state !== 'playing') return;

    // 咬钩 → 收杆（把虾拉出水面）
    if (G.line.phase === 'bite') {
      G.line.phase = 'reeling';
      G.line.reelT = 0;
      G.line.reelRate = CFG.REEL_RATE;
      G.line.reelStartX = G.baitX;
      G.line.reelStartY = G.baitY;
      G.spawnBubbles(G.baitX, G.baitY, 12);
      return;
    }
    // 连点加速收杆：收得越快，虾越容易挣脱
    if (G.line.phase === 'reeling') {
      G.line.reelRate = Math.min(CFG.REEL_RATE * 3, G.line.reelRate + CFG.REEL_RATE * 0.8);
      return;
    }
    if (G.line.phase === 'dropping') return;

    // 虾挂在钩上 → 对准桶投放（可多只同时投放）
    if (G.line.phase === 'hooked') {
      const hs = G.crays.filter(c => c.hooked);
      if (hs.length && hs.every(h => h.y < CFG.WATER_Y && Math.abs(h.x - CFG.BUCKET.x) < 70)) {
        G.line.phase = 'dropping';
        G.line.dropT = 0;
        G.dropStartX = hs[0].x; G.dropStartY = hs[0].y;
        G.dropReady = false;
        G.spawnBubbles(hs[0].x, hs[0].y, 6);
      }
      return;
    }

    // 点击水桶：查看当前捕获统计（按种类计数）
    if (Math.hypot(cx - CFG.BUCKET.x, cy - CFG.BUCKET.y) < 46) {
      G.toggleBucketPanel();
      return;
    }
    // 点击饵料盒：换下一种饵并显示剩余量
    if (Math.hypot(cx - CFG.BAITBOX.x, cy - CFG.BAITBOX.y) < 36) {
      G.clickBaitBox();
      return;
    }

    // 钓竿已放下（F 键）：不响应钓鱼操作（水桶面板/饵料盒仍可用）
    if (!G.rodHeld) return;

    if (!G.rod.baitInWater) {
      // 竿尖必须伸到水面上方才能放饵
      if (G.rod.x < CFG.SHORE_X + 15) return;
      // 有饵就带上钩，没饵则空钩下水（钩上无饵即唯一信号，不提示）
      G.castBait = G.baitDura[G.activeBait] > 0 ? G.activeBait : null;
      if (G.castBait) {
        G.baitDura[G.castBait] = Math.max(0, G.baitDura[G.castBait] - 1);   // 每放一次饵损耗 1
      }
      G.rod.baitInWater = true;
      G.baitX = G.rod.x;
      G.baitY = CFG.WATER_Y + 4;      // 饵料从水面开始下沉
      G.line.phase = 'sinking';
      G.line.sinkP = 0;
      G.ripples.push({ x: G.rod.x, y: CFG.WATER_Y + 8, r: 4, max: 34, life: 40 });
      G.bubbles.push({ x: G.rod.x + G.rand(-4, 4), y: CFG.WATER_Y + 10, r: 3, vy: -G.rand(1, 2), life: 40 });
    }
    // 饵已在水里：点击不再收线/放线——线长只由滚轮控制
  };
})();
