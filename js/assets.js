/* ===== 素材管理：两色剪影像素精灵（全程序化，无外部图片） =====
 * CFG.CRAY_SPRITES 字符网格 → 墨色剪影 + 纸色镂空图案（7 种物种区分）；
 * 昼夜反色档位 q∈{0,1/3,2/3,1} 各烘焙一份缓存（"key|q"），首帧即有精灵。
 * 两色规则经 verify-2color.js 验证 7 种图案互不相同。
 */
const Assets = {
  baked: {},    // "speciesKey|q" -> 像素烘焙画布
  ready: false,

  // 兼容旧调用：无外部素材需要加载
  load(cb) {
    Assets.ready = true;
    if (cb) cb();
  },

  // 两色剪影规则：返回 true=纸色镂空 / false=墨色剪影
  // red 纯色 / old 斑点 / single 缺下钳（形状自带） / soft 空壳（体腔镂空）
  // blue 双横纹 / black 墨身纸描边 / eggs 尾下卵簇
  _OLD_SPOTS: [[12, 6], [15, 9], [16, 6], [11, 9], [14, 8]],
  _rule(key, ch, x, y) {
    switch (key) {
      case 'old':    return Assets._OLD_SPOTS.some(([sx, sy]) => sx === x && sy === y);
      case 'soft':   return ch === 'p' || ch === 'w' || ch === 'l';
      case 'blue':   return (y === 5 || y === 9) && ch !== 'k';
      case 'black':  return ch === 'l';
      case 'eggs':   return ch === 'p';
      default:       return false;   // red / single
    }
  },

  // 字符网格 -> 两色像素画布（q 为昼夜反色档位）
  bakeCray(key, q = 0) {
    const ck = key + '|' + q;
    if (Assets.baked[ck]) return Assets.baked[ck];
    const rows = CFG.CRAY_SPRITES[key] || CFG.CRAY_SPRITES.red;
    const P = CFG.CRAY_SPRITE_PX;
    const c = document.createElement('canvas');
    c.width = rows[0].length * P;
    c.height = rows.length * P;
    const ctx = c.getContext('2d');
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x];
        if (ch === '.') continue;
        ctx.fillStyle = Assets._rule(key, ch, x, y)
          ? Sprites.tone(CFG.PALETTE.PAPER, q)
          : Sprites.tone(CFG.PALETTE.INK, q);
        ctx.fillRect(x * P, y * P, P, P);
      }
    }
    Assets.baked[ck] = c;
    return c;
  },

  // 取某物种某昼夜档位的像素小龙虾画布（懒烘焙兜底）
  cray(key, q = 0) {
    return Assets.baked[key + '|' + q] || Assets.bakeCray(key, q);
  },
};
