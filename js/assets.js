/* ===== 素材管理：Twemoji 精灵（CC-BY 4.0）加载与染色 =====
 * 图片用 <img> 手动加载（不走 XHR，file:// 与 http 都能用，加载失败也不会抛异常）；
 * 全部就绪后按龙虾种类在离屏画布预渲染染色，保留 7 种外观差异。
 * 未就绪/加载失败时，绘制层自动回退到程序化版本。
 * 素材来源：https://github.com/twitter/twemoji
 */
const Assets = {
  images: {},   // key -> HTMLImageElement（cray/frog/snail/bucket/meat）
  tinted: {},   // speciesKey -> 染色后的龙虾离屏画布
  ready: false,

  // 手动加载全部素材；全部就绪（或全部失败）后回调。单张失败不阻塞其他。
  load(cb) {
    const list = {
      cray: 'assets/crayfish.png',
      frog: 'assets/frog.png',
      snail: 'assets/snail.png',
      bucket: 'assets/bucket.png',
      meat: 'assets/meat.png',
    };
    const keys = Object.keys(list);
    let left = keys.length;
    const done = () => {
      if (--left <= 0) {
        Assets.ready = true;
        Assets.preTint();
        if (cb) cb();
      }
    };
    if (!keys.length) return done();
    for (const k of keys) {
      const img = new Image();
      img.onload = () => { Assets.images[k] = img; done(); };
      img.onerror = done;
      img.src = list[k];
    }
  },

  // 按种类给龙虾精灵染色（画 emoji → source-atop 上色）
  tintCray(key) {
    const img = Assets.images.cray;
    if (!img) return null;
    const sp = CFG.CRAY_SPECIES[key] || CFG.CRAY_SPECIES.red;
    const S = 96;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, (S - 72) / 2, (S - 72) / 2, 72, 72);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = Sprites.rgb(Sprites.mix3(Sprites.hex(sp.body[0][1]), Sprites.hex(sp.body[1][1]), 0.5));
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over';
    Assets.tinted[key] = c;
    return c;
  },

  // 预渲染所有物种的染色龙虾（加载完成后自动调用）
  preTint() {
    for (const k of Object.keys(CFG.CRAY_SPECIES)) Assets.tintCray(k);
  },

  // 取某物种的染色龙虾画布（懒加载兜底）
  cray(key) {
    return Assets.tinted[key] || Assets.tintCray(key);
  },
};
