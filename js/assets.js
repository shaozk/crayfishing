/* ===== 素材管理：全程序化像素精灵（无外部图片） =====
 * CFG.CRAY_SPRITES 字符网格按 CFG.PALETTE 灰阶离屏烘焙；昼夜反色档位 q∈{0,1/3,2/3,1}
 * 各烘焙一份缓存（"key|q"），绘制时按当前档位取用，首帧即有精灵、file:// 可用。
 */
const Assets = {
  baked: {},    // "speciesKey|q" -> 像素烘焙画布
  ready: false,

  // 兼容旧调用：无外部素材需要加载
  load(cb) {
    Assets.ready = true;
    if (cb) cb();
  },

  // 字符网格 -> 灰阶像素画布（每个字符一个 P×P 方块，q 为昼夜反色档位）
  bakeCray(key, q = 0) {
    const ck = key + '|' + q;
    if (Assets.baked[ck]) return Assets.baked[ck];
    const rows = CFG.CRAY_SPRITES[key] || CFG.CRAY_SPRITES.red;
    const P = CFG.CRAY_SPRITE_PX;
    const MAP = { k: 'INK', d: 'DARK', m: 'MID', l: 'LIGHT', p: 'PAPER', w: 'WHITE' };
    const c = document.createElement('canvas');
    c.width = rows[0].length * P;
    c.height = rows.length * P;
    const ctx = c.getContext('2d');
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x];
        if (ch === '.') continue;
        ctx.fillStyle = Sprites.tone(CFG.PALETTE[MAP[ch]], q);
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
