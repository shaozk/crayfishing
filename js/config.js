/* ===== 场景布局配置 =====
 * 所有尺寸都集中在这里，改这里即可调整整个场景。
 */
const CFG = {
  W: 900,                 // 画布宽
  H: 560,                 // 画布高
  SHORE_X: 270,           // 岸边（左）与水面（右）的分界线
  WATER_Y: 260,           // 水面高度
  ROD_LEN: 225,           // 钓竿长度（固定）
  LINE_LEN: 190,          // 鱼线长度（固定，受重力下垂）
  HOOK_DROP: 60,          // 收杆后虾挂在竿尖下方的高度
};
CFG.WATER_BOTTOM = CFG.H - 30;              // 水底
CFG.BAIT_DEPTH = CFG.WATER_BOTTOM - 28;     // 饵料沉底后的高度
CFG.BUCKET = { x: CFG.SHORE_X - 20, y: CFG.WATER_Y + 34 };  // 岸边桶的位置
