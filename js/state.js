/* ===== 共享游戏状态：所有模块通过 Game 读写（单一数据源） ===== */
const Game = {
  // ---- DOM（由 game.js 注入；input.js 自行取 canvas 元素） ----
  canvas: null,
  ctx: null,
  overlay: null,
  startBtn: null,

  // ---- 流程 ----
  state: 'menu',                 // menu | playing
  score: 0,

  // ---- 钓竿 ----
  // theta=竿方位角（握竿拖拽驱动，松手保持）；gripT=握点沿竿比例(0=根..1=梢)；gripping=是否握持中
  rod: { x: 150, y: 0, baseX: 150, baseY: 0, theta: 0.5, gripT: 0.3, gripping: false, baitInWater: false },
  rodHeld: true,                     // F 键切换：是否手持钓竿
  rodGroundX: 150,                   // 放下钓竿时，竿落在地面的位置

  // ---- 饵料实际位置（线尾，受重力下垂）与钓线状态机 ----
  baitX: 150, baitY: 0,
  lineLen: CFG.LINE_LEN,               // 当前线长（鼠标滚轮调节，默认固定长度）
  line: {
    phase: 'idle',               // idle | sinking | waiting | bite | reeling | hooked | dropping
    sinkP: 0, reelT: 0, dropT: 0,
    reelStartX: 0, reelStartY: 0,            // 收杆起点（虾的位置）
    reelRate: CFG.REEL_RATE,                 // 当前收杆速度（连点加速）
    biteTimer: 0,
    shake: 0, wiggle: 0
  },

  // ---- 投放进桶 ----
  dropStartX: 0, dropStartY: 0,
  dropReady: false,              // 虾是否可以在桶上方投放
  bucketCrays: [],               // 桶里的小龙虾（探头展示）

  // ---- 小龙虾 & 特效 ----
  crays: [],
  ripples: [],                   // 波纹
  bubbles: [],                   // 气泡
  particles: [],                 // 飘字/星星

  // ---- 捕获统计（按种类） ----
  caughtCounts: {},

  // ---- 饵料 ----
  activeBait: 'snail_s',         // 当前选中的饵料
  castBait: null,                // 已投入水中的饵料种类（null = 钩上没饵）
  baitDura: {},                  // 各饵料剩余耐久

  // ---- 键盘状态（左右键移动人物；F 捡放钓竿） ----
  playerX: 150,             // 人物沿岸边的位置
  keyLeft: false, keyRight: false,

  // ---- 工具 ----
  rand(a, b) { return a + Math.random() * (b - a); },
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },

  // 昼夜时间（真实时钟）：0=0:00 午夜，0.25=6:00 日出，0.5=12:00 正午，0.75=18:00 日落
  getDayT() {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600 + now.getMilliseconds() / 3600000;
    return (((h + CFG.TIME_OFFSET_HOURS) % 24) + 24) % 24 / 24;
  },

  // 水中饵料信息（钩上没饵则为 null → 不吸引、不上钩）
  baitInfo() { return Game.castBait ? CFG.BAITS[Game.castBait] : null; },

  // ---- 供素材库读取的派生字段（等价于旧 draw() 里的 G 快照） ----
  get time() { return Game.getDayT(); },
  get baitKey() { return Game.castBait; },
};

// 依据配置初始化几何位置与容器
(() => {
  const G = Game;
  G.rod.y = CFG.WATER_Y - 30;
  G.rod.baseY = CFG.WATER_Y - 80;
  G.baitY = CFG.WATER_Y;
  for (const k of Object.keys(CFG.CRAY_SPECIES)) G.caughtCounts[k] = 0;
  for (const k of Object.keys(CFG.BAITS)) G.baitDura[k] = CFG.BAITS[k].dur;
})();
