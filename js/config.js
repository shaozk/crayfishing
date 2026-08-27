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
  AIM_SPEED: 1.6,         // 键盘 W/S 调节竿尖仰角的速度（像素/帧）
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
// 龙虾种类：body/tail/claw 各为 [浅色系, 深色系]，绘制时按大小在浅↔深间插值（小浅大深）
// special: old=皱纹斑 / single=单钳 / soft=软壳半透+高光 / eggs=尾下卵簇（其余为 null）
// spd: 爬行速度倍率（相对 CRAY_SPEED）；w: 随机权重
CFG.CRAY_SPECIES = {
  red:    { name: '红龙虾',     w: 3, spd: 1.0,
            body: [['#f8b27a', '#f28a4a', '#d96a2e'], ['#b03a20', '#8f2c18', '#6e1f13']],
            tail: ['#f0a154', '#b8321f'], claw: ['#f5a33c', '#c0392b'] },
  old:    { name: '老龙虾',     w: 2, spd: 0.7, special: 'old',
            body: [['#c98f5e', '#b07a4a', '#96653c'], ['#6e4a28', '#5c3d20', '#4a3019']],
            tail: ['#a06a3e', '#5c3d20'], claw: ['#b07a4a', '#6e4a28'] },
  single: { name: '单钳龙虾',   w: 2, spd: 1.0, special: 'single',
            body: [['#f5a06a', '#e8793a', '#cf6026'], ['#b04a22', '#933b19', '#753012']],
            tail: ['#e8793a', '#a8451f'], claw: ['#f0a05a', '#c0602a'] },
  soft:   { name: '软皮龙虾',   w: 2, spd: 0.85, special: 'soft',
            body: [['#fbe3d4', '#f5c9b4', '#eeb29c'], ['#e0a28c', '#d18e78', '#bd7c66']],
            tail: ['#f0c0a8', '#d18e78'], claw: ['#f5c9b4', '#d89a84'] },
  blue:   { name: '青龙虾',     w: 1, spd: 1.05,
            body: [['#8fd3e8', '#5cb6d9', '#3a9cc4'], ['#1f6e95', '#185b80', '#12496a']],
            tail: ['#5cb6d9', '#185b80'], claw: ['#6fc4e0', '#2a80a8'] },
  black:  { name: '黑龙虾',     w: 1, spd: 1.1,
            body: [['#8a8594', '#6e6977', '#565260'], ['#3d3944', '#322f38', '#28252d']],
            tail: ['#6e6977', '#322f38'], claw: ['#7a7484', '#3d3944'] },
  eggs:   { name: '带籽母龙虾', w: 1, spd: 0.9, special: 'eggs',
            body: [['#f8a86a', '#ef7a3c', '#d96226'], ['#b53c1e', '#98301a', '#7a2514']],
            tail: ['#ef7a3c', '#a8381e'], claw: ['#f5a33c', '#c03a28'] },
};
// 饵料种类：attract=吸引半径 pull=吸引力度 dur=耐久（每次放饵-1，咬钩再按虾大小扣，消耗较慢）
// bite=最多可同时上钩的虾数（大田螺/大青蛙/猪肝可两只同时上钩）
CFG.BAITS = {
  snail_s: { name: '小田螺', icon: '🐌', attract: 230, pull: 0.16, dur: 12, bite: 1, color: '#a08c68' },
  snail_l: { name: '大田螺', icon: '🐌', attract: 300, pull: 0.20, dur: 15, bite: 2, color: '#7a6a4e' },
  frog_s:  { name: '小青蛙', icon: '🐸', attract: 270, pull: 0.18, dur: 9, bite: 1, color: '#5daa4f' },
  frog_l:  { name: '大青蛙', icon: '🐸', attract: 350, pull: 0.24, dur: 12, bite: 2, color: '#3f8f3f' },
  liver:   { name: '猪肝',   icon: '🥩', attract: 420, pull: 0.30, dur: 8, bite: 2, color: '#8a3a2a' },
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
