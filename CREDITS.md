# 素材版权说明 / Credits

## AI 协作者

本项目由人类开发者与 AI 编程代理协作完成：

- **pi**（AI 编程代理，@earendil-works/pi-coding-agent，模型 deepseek-v4-pro）——参与代码实现、重构、调试、素材集成与文档撰写。

## 游戏内像素美术

全部实体（小龙虾 7 种、青蛙/田螺/猪肝饵料、水桶、饵料盒）均为**程序化黑白像素绘制**，
由代码按 `CFG.PALETTE` 灰阶调色板生成，无外部图片依赖。

历史版本曾使用 **Twemoji**（CC-BY 4.0，https://github.com/twitter/twemoji）的 emoji 素材，
现已被像素风替换；`assets/` 目录下的旧 PNG 不再被加载，仅作历史保留。

## 软件库

- **Phaser 3**（`js/vendor/phaser.min.js`）— MIT，https://github.com/phaserjs/phaser
- **Mustache.js**（`js/vendor/mustache.min.js`）— MIT，https://github.com/janl/mustache.js
