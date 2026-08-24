# Agent.md

面向开发/修改此项目的指引（也供 AI 代理阅读）。请先通读本文件，再动手改代码。

## 设计原则（最重要）

> **所有功能都要尽可能模拟现实世界。** 做任何玩法 / 视觉 / 交互设计前，先问「现实里会怎样」，再据此实现：
> - **信息不过度暴露**：捕获数量不直接显示（点水桶查看）、饵料剩余不直接显示（点饵料槽才短暂显示）、饵料用完不弹提示——钩上有没有饵、虾还上不上钩，就是玩家能观察到的唯一信号。
> - **物理直觉**：钓竿受重力下垂、虾挣脱/落水/沉底、荷叶碰掉上钩的虾，均遵循重力、碰撞与直觉。
> - 新增功能时优先用「世界自身的行为」传达信息，而不是 UI 文字提示。

## 项目概况

- **技术栈**：原生 JavaScript（ES2015+）+ **Phaser 3**（`js/vendor/phaser.min.js`，游戏循环 / 输入 / 缩放 / 相机）+ Mustache（`js/vendor/mustache.min.js`，UI 模板）。无构建步骤，无需 npm install。
- **运行方式**：`open index.html` 或 `python3 -m http.server` 后浏览器访问（Phaser 需现代浏览器）。
- **语言**：代码注释、UI 文案均为中文；新增文案请保持中文。
- **调试入口**：浏览器控制台访问 `globalThis.__game`（定义在 `game.js` 末尾），可读 `phase` / `score` / `crays` / `baitX` / `baitY` / `dropReady` / `bucketCrays`。

## 文件职责与加载顺序

`index.html` 中脚本**必须**按此顺序加载（有全局依赖）：

1. `js/config.js` — 定义全局常量 `CFG`（所有配置数据集中地：布局/物种/饵料/荷叶/饵料盒等）
2. `js/state.js` — 定义共享状态对象 `Game`（所有模块通过它读写数据的单一数据源）
3. `js/effects.js` — 特效工具（气泡/水花/特效更新），注册到 `Game`
4. `js/crays.js` — 龙虾系统（生成/贴地移动/洞/坠落/挣脱/荷叶/捕获），注册到 `Game`
5. `js/bait.js` — 饵料系统（耐久/吸引/咬钩/用光/饵料盒），注册到 `Game`
6. `js/phases.js` — 钓竿物理 + 鱼线状态机 + 挣脱概率，注册到 `Game`
7. `js/vendor/phaser.min.js` — **Phaser 3（MIT）**，游戏引擎（循环/输入/缩放/相机），必须在 `input.js` 之前加载
8. `js/input.js` — 指针与点击交互（`Game.handleMove/handleClick`，由 Phaser 场景桥接坐标）
9. `js/vendor/mustache.min.js` — Mustache（MIT），UI 模板渲染，必须在 `ui.js` 之前加载
10. `js/ui.js` — 水桶统计面板 / 饵料剩余提示（Mustache 模板渲染）
11. `js/sprites.js` — 定义全局对象 `Sprites`（纯绘制函数，不修改游戏状态）
12. `js/scene.js` — Phaser 场景：驱动逻辑、画布纹理桥接渲染、输入绑定、震屏反馈
13. `js/game.js` — 入口：Phaser 配置启动、`startGame`、`__game` 调试钩子

新增脚本请追加在 `game.js` 之前，并更新 `index.html`。

## 核心架构约定

### 1. 布局配置集中在 CFG

- 所有坐标/尺寸写在 `js/config.js` 的 `CFG` 中，**不要在游戏逻辑里硬编码魔法数字**（场景内的位置偏差除外）。
- 关键字段：`W`/`H` 画布尺寸，`SHORE_X` 岸边-水面分界，`WATER_Y` 水面高度，`WATER_BOTTOM` 水底，`BAIT_DEPTH` 饵料沉底高度，`ROD_LEN`/`LINE_LEN` 竿长/线长，`HOOK_DROP` 收杆后虾挂在竿尖下方的高度，`BUCKET` 水桶位置，`REEL_RATE` 基础收杆速度。

### 1.5 模块间通过 Game 通信（单一数据源）

- `state.js` 定义全局对象 `Game`：所有可变状态（`rod` / `line` / `crays` / `baitDura` …）都是它的属性；各模块把函数注册为 `Game.xxx`，互相通过 `Game.xxx()` 调用，杜绝闭包耦合与循环依赖。
- 每个模块是「注册到 Game 的 IIFE」：`(() => { const G = Game; G.xxx = function () {…}; })();`
- 状态一律读写 `G.xxx`；重置用 `G.crays = G.crays.filter(...)`（不要解构出局部引用再赋值，避免引用失效）。
- 新增数据/方法时，同步更新 `state.js`（数据）与 `__game` 钩子（调试）。

### 2. 绘制与逻辑分离（Phaser 场景 + 画布纹理桥接）

- `Sprites`（sprites.js）只做绘制，**不得修改游戏状态**；它把场景画进一个离屏画布。
- `scene.js` 的 `GameScene` 用 `this.textures.createCanvas('scene', W, H)` 建立 **CanvasTexture**，每帧 `drawFrame()` 把 `Sprites.*` 依次画到该画布上再 `refresh()`，由 Phaser 全屏显示——既保留既有美术，又获得 Phaser 的循环 / 输入 / 缩放 / 相机能力。
- 逻辑由 `GameScene.update()` 编排：`checkBaitExhausted()` → `updatePhase(t)` → `updateCrays()` → `updateEffects()`；捕获成功时用 `this.cameras.main.shake()` 做反馈。
- 输入由 Phaser 桥接：`this.input.on('pointermove'/'pointerdown')` → `Game.handleMove/Game.handleClick`（坐标为画布坐标，无需手写缩放换算）。

### 3. 鱼线状态机（`Game.line.phase`）

虾的整个交互流程由状态机驱动，新增流程/交互时优先扩展此状态机：

| phase | 含义 | 进入条件 |
|-------|------|---------|
| `idle` | 未放饵 | 初始 / 收线 / 失败 |
| `sinking` | 饵料下沉 | 点击放饵 |
| `waiting` | 饵沉底等待 | 下沉结束 |
| `bite` | 虾咬钩（警示） | 虾靠近饵且随机命中 |
| `reeling` | 收杆拖虾出水面 | 咬钩时点击 |
| `hooked` | 虾挂竿尖，可投放 | 收杆完成 |
| `dropping` | 投放入桶动画 | hooked 状态点击桶 |

对应点击逻辑在 `onCanvasClick()`，更新逻辑在 `update()` 中的分支，绘制提示在 `Sprites.drawLine()`（咬钩警示圈、未放饵箭头）。

### 4. 小龙虾对象

由 `makeCray()` 生成，字段：`x/y`、`size`（决定计分大小）、`vx/vy`（速度受关卡 `speed` 影响）、`dir`（朝向，绘制翻转用）、`wiggle`（摆动相位）、`hooked`（是否被钓）。

- 虾**只在水底活动**（`y` 被限制在 `WATER_BOTTOM-58 ~ WATER_BOTTOM-24`）。
- 行为函数：`attractCrays()` 饵沉底后吸引虾爬近；`scareNearbyCrays()` 饵落水吓跑附近的虾；`bite()` 咬钩；`loseBait()` 超时挣脱。
- 捕获成功：`catchCray()` 计分（size>21 → +3，>15 → +2，否则 +1）、桶内展示、补充新虾、判定升级。

### 5. 难度设定

- 已去除关卡系统，游戏为无限畅玩模式：虾数量 `CRAY_COUNT`、速度 `CRAY_SPEED` 定义在 `config.js` 的 `CFG` 中，`makeCray()` 与移动逻辑直接使用这两个常量。
- 没有升级/通关判定；得分在 `catchCray()` 中累计，`score >= 0` 无上限。

## 修改指南

- **改布局/尺寸** → 只动 `js/config.js`。
- **调难度** → 改 `js/config.js` 中的 `CRAY_COUNT`（虾数量）与 `CRAY_SPEED`（速度）。
- **加视觉元素** → 在 `js/sprites.js` 新增 `Sprites.xxx(ctx, G)` 纯绘制函数，并在 `game.js` 的 `draw()` 中按绘制层级（天空→岸水→细节→人物→桶→水面→波纹→线→虾→气泡→粒子）调用；粒子/气泡/波纹用 `particles` / `bubbles` / `ripples` 数组管理。
- **加交互/玩法** → 在 `game.js` 的 `onCanvasClick()` 与 `update()` 状态机分支中扩展；保持点击只做「触发」，物理与判定放 `update()`。
- **计分平衡** → `catchCray()` 按数量计分，每只 `score++`（无大小加分）。
- **小龙虾种类** → 7 种虾在 `CFG.CRAY_SPECIES`（config.js）定义：体色为 [浅,深] 两档、`special` 控制特殊外观（`old` 皱纹斑 / `single` 单钳残肢 / `soft` 软壳半透+高光 / `eggs` 尾下卵簇）、`spd` 控制速度倍率、`w` 随机权重；`game.js` 的 `pickSpeciesKey()` 按权重抽取，绘制在 `Sprites.drawCrays()`，按 `size` 在浅↔深间插值（小浅大深）。
- **小龙虾行为** → `game.js`：虾有三态 `walk`（贴地爬行，速度 `CRAY_SPEED`）/ `toHome`（回洞途中）/ `inHole`（洞中躲藏，`hideT` 倒计时后出洞）；洞穴位置在 `CFG.HOLES`（config.js），每只虾在 `makeCray()` 里分配最近的洞，受惊（`scareNearbyCrays()`）或随机（概率在 `update()` 移动循环里）会回洞。
- **挣脱机制** → `game.js`：`reelEscapeP()` 收杆中每帧判定，随收杆倍率（`line.reelRate`，连点加速，基础 `REEL_RATE`）与离水面距离增大；`hookedEscapeP()` 挂竿阶段随出水面高度增大；挣脱走 `escapeCray()`（解除挂钩 → `falling` 空中坠落 → `sinking` 水中下沉到水底 → `toHome` 爬回洞，全程可见）。概率系数都在这两个函数里，调大/调小即改难度。
- **水桶统计面板** → 点击水桶（`game.js` 的 `onCanvasClick` 中 `toCanvas()` 换算坐标后命中检测）弹出 `#bucketPanel`（index.html），数据源为 `caughtCounts`（按种类累计，`catchCray()` 里 `caughtCounts[h.species]++`，重开游戏时清零）；面板行由 `CFG.CRAY_SPECIES` 遍历生成，色点用 `Sprites.hex/mix3/rgb` 计算。
- **信息不过度暴露** → 已移除常驻中央统计与 HUD 数量：捕获数量仅在点击水桶（`#bucketPanel`）时显示；饵料剩余仅在点击水桶旁的饵料盒（`showBaitInfo()`，2.5 秒自动隐藏）时显示；饵料用完不提示（`castBait = null` 钩上无饵，`baitInfo()` 返回 null 时 `attractCrays()`/`tryBite()` 直接跳过，虾不会咬钩）。
- **饵料系统** → 5 种饵在 `CFG.BAITS`（config.js）：`attract` 吸引半径 / `pull` 力度 / `dur` 耐久 / `bite` 同时上钩数。`game.js` 中 `activeBait` 当前选择、`castBait` 水中饵料、`baitDura` 耐久（放饵 -1、咬钩按虾大小扣 0.5×，被咬到负值即吃光触发 `baitUsedUp()` 静默收饵）；`bite>=2` 的饵（大田螺/大青蛙/猪肝）由 `tryBite()` 在 waiting/bite 阶段允许两只虾同时咬钩。
- **饵料盒** → `CFG.BAITBOX`（config.js，水桶旁）定义位置，`Sprites.drawBaitBox()` 绘制木盒并展示当前饵料；`onCanvasClick` 命中检测后 `clickBaitBox()` 循环换下一种饵（空饵自动补满）并 `showBaitInfo()` 在盒旁显示剩余量。
- **荷叶** → `CFG.LEAVES`（config.js）定义水面浮叶，`Sprites.drawLeaves()` 绘制；`leafDropCheck()`（game.js）在 reeling/hooked 阶段对每只上钩的虾判定：穿过水面（|y-WATER_Y|<34）且碰到叶子（半径 + 虾半身）时 45% 概率直接掉落（走 `escapeCray()` 物理落水）。
- **多虾处理** → 收杆/挂竿/投放/计分都按 `crays.filter(c => c.hooked)` 批量处理；挣脱逐只判断，`escapeCray(h)` 只释放单只，没有别的虾挂着才复位钓线。
- **移动端适配** → 触摸输入由 `scene.js` 的 Phaser `pointerdown/pointermove` 接管（`Game.handleMove/handleClick`，自动处理触摸与缩放坐标）；CSS 中 `touch-action`/`overscroll-behavior`/`-webkit-tap-highlight` 禁用浏览器手势；竖屏提示 `#rotateHint` 用 `@media (orientation: portrait) and (pointer: coarse)` 控制；全屏按钮 `#fsBtn` 做能力检测（iOS Safari 隐藏）；DOM 面板用 `env(safe-area-inset-*)` 避让刘海屏。
- **日夜更迭** → `game.js` 的 `getDayT()` 按真实时钟计算（0~1，0=午夜 / 0.25=6:00 日出 / 0.5=正午 / 0.75=18:00 日落），`CFG.TIME_OFFSET_HOURS` 可偏移调试；绘制：`Sprites.drawSky()` 天空渐变随时间插色 → `Sprites.drawCelestial()` 日月星辰作为**背景层**（画在最底层，不遮挡角色）→ 场景 → `Sprites.drawLighting()` 全局亮度/晨昏暖色，用 evenodd 路径抠掉天体区域使其保持明亮；天体几何由 `celestialInfo()` 统一计算，绘制与遮罩共用。
- **钓竿动画** → 分两处：`game.js` 的 `update()` 在 `bite`/`reeling`/`hooked` 阶段让竿梢在重力方向下垂（`rod.y += 7 + weight*12 + |shake|*0.3`，虾越重垂得越多）；`Sprites.drawLine()` 画竿身弧线，控制点取沿竿 70% 处 + 指向重力侧的垂直偏移 `(-dy, dx)/len * flex`，弯曲始终朝重力方向，无负载时笔直。

## 常见陷阱

- `CFG`、`Sprites` 是全局常量，`game.js` 是 IIFE——不要在 IIFE 外引用其内部变量；调试用 `__game`。
- `rod.baitInWater` 决定是否绘制鱼线/饵，`state` 决定是否响应点击（`menu` / `playing` / `over`）。
- 触屏事件用 `{ passive: false }` 且调 `preventDefault()`，否则 `touchmove` 会滚动页面。
- `sprites.js` 中 `performance.now()` 直接用于动画相位，绘制函数须保持无副作用。
- 坐标换算：鼠标/触屏事件需按 `canvas.getBoundingClientRect()` 缩放映射到画布坐标，见 `onMove()`。
