/* ===== 场景布局配置 =====
 * 所有尺寸都集中在这里，改这里即可调整整个场景。
 */
const CFG = {
  W: 900,                 // 画布宽
  H: 560,                 // 画布高
  SHORE_X: 270,           // 岸边（左）与水面（右）的分界线
  WATER_Y: 260,           // 水面高度
  ROD_LEN: 225,           // 钓竿长度（固定）
  LINE_LEN: 190,          // 默认线长（滚轮可伸缩）
  LINE_MIN: 30,           // 最短线长（更短则缠在竹竿上）
  LINE_MAX: 340,          // 最长线长
  LINE_WHEEL_SPEED: 0.08, // 滚轮每像素对应的线长变化
  PLAYER_SPEED: 2.4,      // 键盘移动人物的速度（像素/帧）
  HOOK_DROP: 60,          // 收杆后虾挂在竿尖下方的高度
  CRAY_COUNT: 24,         // 小龙虾数量
  CRAY_SPEED: 0.45,       // 小龙虾爬行速度（慢）
  TIME_OFFSET_HOURS: 0,   // 真实时间偏移（小时），调试用：想看白天就设正值
  REEL_RATE: 0.03,        // 基础收杆速度（每帧推进量，连点可加速）
};
CFG.WATER_BOTTOM = CFG.H - 30;              // 水底
CFG.BAIT_DEPTH = CFG.WATER_BOTTOM - 28;     // 饵料沉底后的高度
CFG.BUCKET = { x: CFG.SHORE_X - 20, y: CFG.WATER_Y + 34 };  // 岸边桶的位置
// 龙虾洞：水底泥岸上的洞穴，小龙虾可钻进钻出躲藏
CFG.HOLES = [
  { x: 430, y: CFG.WATER_BOTTOM - 8 },
  { x: 590, y: CFG.WATER_BOTTOM - 6 },
  { x: 750, y: CFG.WATER_BOTTOM - 10 },
];
// 龙虾种类：外观差异由 CFG.CRAY_SPRITES 像素图案表达（红/老/独螯/软壳/蓝/黑/抱卵）
// spd: 爬行速度倍率（相对 CRAY_SPEED）；w: 随机权重
// special: old / single / soft / eggs（行为与图案标识，其余为 null）
CFG.CRAY_SPECIES = {
  red:    { name: '红龙虾',     w: 3, spd: 1.0 },
  old:    { name: '老龙虾',     w: 2, spd: 0.7,  special: 'old' },
  single: { name: '单钳龙虾',   w: 2, spd: 1.0,  special: 'single' },
  soft:   { name: '软皮龙虾',   w: 2, spd: 0.85, special: 'soft' },
  blue:   { name: '青龙虾',     w: 1, spd: 1.05 },
  black:  { name: '黑龙虾',     w: 1, spd: 1.1 },
  eggs:   { name: '带籽母龙虾', w: 1, spd: 0.9,  special: 'eggs' },
};
// ===== 黑白像素风调色板：全部 R=G=B 灰阶，任何新绘制只允许引用这里的 token =====
CFG.PALETTE = {
  INK:   '#1a1a1a',   // 近黑：轮廓 / 最深
  DARK:  '#3d3d3d',   // 深灰：暗面
  MID:   '#6f6f6f',   // 中灰：主体
  LIGHT: '#a8a8a8',   // 浅灰：受光
  PAPER: '#e8e8e8',   // 纸白
  WHITE: '#ffffff',   // 纯白：高光
};
// 像素小龙虾：26x16 字符网格（俯视、朝右、上下对称），'.' 透明，
// 其余字符映射灰阶 k=INK d=DARK m=MID l=LIGHT p=PAPER w=WHITE
// 物种区分：red 纯色 / old 深色+斑点 / single 下钳残肢 / soft 浅色+高光弧
//           blue 双横纹 / black 墨身浅描边 / eggs 尾下卵簇
CFG.CRAY_SPRITES = {
  red: [
    '..........................',
    '.......................k..',
    'k........k.k.k.k.....kkdkk',
    'kk.......k.k.k.k.....kddk.',
    '.kk......k.k.kkk....kkkdkk',
    '..kk...kkmkmkmdmkkkk...k..',
    'kkllkkklllkllllllllk......',
    'klllllklllklllllllllkk....',
    'klllllklllklllllllllkk....',
    'kkllkkklllkllllllllk......',
    '..kk...kkmkmkmdmkkkkk..k..',
    '.kk......k.k.kkk.....kkdkk',
    'kk.......k.k.k.k.....kddk.',
    'k........k.k.k.k.....kkdkk',
    '.......................k..',
    '..........................',
  ],
  old: [
    '..........................',
    '.......................k..',
    'k........k.k.k.k.....kkkkk',
    'kk.......k.k.k.k.....kkkk.',
    '.kk......k.k.kkk....kkkkkk',
    '..kk...kkdkdkdkdkkkk...k..',
    'kkmmkkkmmmkmkmmmkmmk......',
    'kmmmmmkmmmkmmmmmmmmmkk....',
    'kmmmmmkmmmkmmmkmmmmmkk....',
    'kkmmkkkmmmkkmmmkmmmk......',
    '..kk...kkdkdkdkdkkkkk..k..',
    '.kk......k.k.kkk.....kkkkk',
    'kk.......k.k.k.k.....kkkk.',
    'k........k.k.k.k.....kkkkk',
    '.......................k..',
    '..........................',
  ],
  single: [
    '..........................',
    '.......................k..',
    'k........k.k.k.k.....kkdkk',
    'kk.......k.k.k.k.....kddk.',
    '.kk......k.k.kkk....kkkdkk',
    '..kk...kkmkmkmdmkkkk...k..',
    'kkllkkklllkllllllllk......',
    'klllllklllklllllllllkk....',
    'klllllklllklllllllllkk....',
    'kkllkkklllkllllllll.......',
    '..kk...kkmkmkmdmkkk.......',
    '.kk......k.k.kkk...kk.....',
    'kk.......k.k.k.k..........',
    'k........k.k.k.k..........',
    '..........................',
    '..........................',
  ],
  soft: [
    '..........................',
    '.......................k..',
    'k........k.k.k.k.....kkmkk',
    'kk.......k.k.k.k.....kmmk.',
    '.kk......k.k.kkk....kkkmkk',
    '..kk...kklklwwwlkkkk...k..',
    'kkppkkkpppkppppppppk......',
    'kpppppkpppkpppppppppkk....',
    'kpppppkpppkpppppppppkk....',
    'kkppkkkpppkppppppppk......',
    '..kk...kklklklmlkkkkk..k..',
    '.kk......k.k.kkk.....kkmkk',
    'kk.......k.k.k.k.....kmmk.',
    'k........k.k.k.k.....kkmkk',
    '.......................k..',
    '..........................',
  ],
  blue: [
    '..........................',
    '.......................k..',
    'k........k.k.k.k.....kkdkk',
    'kk.......k.k.k.k.....kddk.',
    '.kk......k.k.kkk....kkkdkk',
    '..kk...kkdkdkdddkkkk...k..',
    'kkllkkklllkllllllllk......',
    'klllllklllklllllllllkk....',
    'klllllklllklllllllllkk....',
    'kkddkkkdddkddddddddk......',
    '..kk...kkmkmkmdmkkkkk..k..',
    '.kk......k.k.kkk.....kkdkk',
    'kk.......k.k.k.k.....kddk.',
    'k........k.k.k.k.....kkdkk',
    '.......................k..',
    '..........................',
  ],
  black: [
    '..........................',
    '.......................l..',
    'l........l.l.l.l.....llkll',
    'll.......l.l.l.l.....lkkl.',
    '.ll......l.l.lll....lllkll',
    '..ll...llklklkkkllll...l..',
    'llddlllddddddddddddl......',
    'ldddddddddddddddddddll....',
    'ldddddddddddddddddddll....',
    'llddlllddddddddddddl......',
    '..ll...llklklkkklllll..l..',
    '.ll......l.l.lll.....llkll',
    'll.......l.l.l.l.....lkkl.',
    'l........l.l.l.l.....llkll',
    '.......................l..',
    '..........................',
  ],
  eggs: [
    '..........................',
    '.......................k..',
    'k........k.k.k.k.....kkdkk',
    'kk.......k.k.k.k.....kddk.',
    '.kk......k.k.kkk....kkkdkk',
    '..kk...kkmkmkmdmkkkk...k..',
    'kkllkkklllkllllllllk......',
    'klllllklllklllllllllkk....',
    'klllllklllklllllllllkk....',
    'kkllkkklllkllllllllk......',
    '.pkk...kkmkmkmdmkkkkk..k..',
    '.pkp.....k.k.kkk.....kkdkk',
    'pkp.p....k.k.k.k.....kddk.',
    'k.p......k.k.k.k.....kkdkk',
    '.......................k..',
    '..........................',
  ],
};
CFG.CRAY_SPRITE_PX = 1;   // 烘焙放大倍数（主档 26x16，绘制时按 size 最近邻缩放）
// ===== 剪影·留白（方案 A）核心参数 =====
CFG.IMMERSE_ALPHA = 0.5;    // 水下元素浸没透明度（水下一律 50% 墨，出水即纯墨）
CFG.WATER_TINT_ALPHA = 0;   // 水下区底色浓度（0=纯纸底；0.04=轻灰底变体，可对比调试）
// ===== 握竿交互（按住竿身拖动瞄准） =====
CFG.GRIP_HIT_R = 14;        // 按下命中竿身线段的判定半径（px）
CFG.GRIP_DEADZONE = 30;     // 鼠标距肩点小于该距离时不更新竿方位角（防近处跳变）
// 饵料种类：attract=吸引半径 pull=吸引力度 dur=耐久（每次放饵-1，咬钩再按虾大小扣，消耗较慢）
// bite=最多可同时上钩的虾数（大田螺/大青蛙/猪肝可两只同时上钩）
CFG.BAITS = {
  snail_s: { name: '小田螺', attract: 230, pull: 0.16, dur: 12, bite: 1 },
  snail_l: { name: '大田螺', attract: 300, pull: 0.20, dur: 15, bite: 2 },
  frog_s:  { name: '小青蛙', attract: 270, pull: 0.18, dur: 9, bite: 1 },
  frog_l:  { name: '大青蛙', attract: 350, pull: 0.24, dur: 12, bite: 2 },
  liver:   { name: '猪肝',   attract: 420, pull: 0.30, dur: 8, bite: 2 },
};
// 荷叶：水面上的浮叶，钓起的虾穿过水面时碰到大概率直接掉落
CFG.LEAVES = [
  { x: 370, y: CFG.WATER_Y + 10, r: 24 },
  { x: 530, y: CFG.WATER_Y + 5, r: 30 },
  { x: 690, y: CFG.WATER_Y + 12, r: 22 },
  { x: 810, y: CFG.WATER_Y + 7, r: 27 },
];
// 饵料盒：水桶旁的小木盒，点击查看/更换饵料
CFG.BAITBOX = { x: CFG.BUCKET.x - 78, y: CFG.BUCKET.y + 12 };
