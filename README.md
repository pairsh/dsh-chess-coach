# dsh-chess-coach

在 DeepSeek Harness 的右侧栏里，用 **En Croissant 的风格和数据** 分析国际象棋，同时保留原来的 AI 教练。

![En Croissant 风格的分析棋盘与 AI 教练](docs/croissant-fullscreen.png)

- 左侧是灰阶棋盘、玩家条、评估条和着法控制；
- 右侧是 En Croissant 式标签页：**AI 教练 / 引擎 / 数据库 / 着法**；
- 全屏右侧栏时自动变成「棋盘 + 分析面板」双栏布局。

## 接入 En Croissant 的方式

En Croissant 是 Tauri 桌面应用，没有 HTTP/CLI API；直接把它整个窗口嵌进 DSH 需要重写几十个 Tauri command，不现实。这个插件采用的是**文件级只读接入 + 同风格 UI**：

| 能力 | 实现 |
| --- | --- |
| 引擎 | 读取 `engines/engines.json`，把 En Croissant 管理的本地 UCI 引擎合并进引擎选择器；Stockfish / RubiChess 可直接用 |
| 数据库 | 只读枚举 `db/*.db3`，读取 `Info` 元数据，按棋手/赛事/结果搜索 `Games` 表 |
| 载入对局 | 优先匹配 `.pgn` 附属文件；没有匹配时，如果 `Site` 是 Lichess 链接，则通过 Lichess 导出 API 拉取 PGN |
| 应用联动 | 「打开应用」按钮可启动本机 En Croissant，方便查看完整对局/开局库 |
| 外观 | 深色 Mantine 风格、`#e9ecef/#868e96` 灰阶棋盘、cburnett 棋子、右侧分析标签、纸面卡片式面板 |
| AI 教练 | 完全保留：局面总结、双方计划、战术警报、王安全/中心/出子/兵形、引擎首选与后续变化 |

本机实测读取到 4 个数据库（含 Caissabase、Lumbra's Gigabase 和 chess.com/lichess 个人库）以及 En Croissant 的 Stockfish 17.1。

### 为什么不能直接解码 `Moves` BLOB

En Croissant 的 `Games.Moves` 是每个半回合一个字节的**合法着法索引**，索引顺序由它的 Rust 走子生成器决定。除非逐字节复刻这个顺序，否则会静默载入另一盘棋。因此：

- 有 `.pgn` 附属文件时，按 White/Black/Date/Result 匹配后载入；
- 有 Lichess `Site` 链接时，通过 Lichess API 载入；
- 两者都没有时，只展示对局元数据，不猜测 BLOB。

`.pgn` 是 En Croissant 导入时的快照，可能和新导入的游戏发生漂移；载入失败时界面会明确提示。

## 功能

- **交互棋盘**：点击/拖拽走子，合法落点、升变、上一步、将军高亮，翻转棋盘，玩家条与等级分。
- **实时 Stockfish**：常驻 UCI 进程，走子后自动分析；MultiPV、深度、节点、耗时、白方视角评分。
- **AI 教练**：局面总结、双方计划、战术警报、局面指标、引擎首选和后续变化。
- **En Croissant 数据库**：数据库选择、棋手/赛事/结果筛选、对局列表、载入 PGN、打开 En Croissant。
- **En Croissant 引擎**：从 `engines.json` 导入 Stockfish 等本地引擎；Lc0 因需要额外权重/后端参数暂不列出。
- **研究工具**：FEN 载入、PGN 导入/导出、复制 FEN、回看/撤销、Lichess 分析链接。
- **Cloud Lichess（可选）**：云端评估交叉验证；开局库受网络影响，默认关闭。
- **会话隔离**：棋局按会话持久化，切换会话不会串棋。

## 截图

En Croissant 数据库页：

![En Croissant 数据库浏览](docs/croissant-database.png)

载入 En Croissant 对局后：

![载入 En Croissant 对局](docs/croissant-game.png)

设置页会显示 En Croissant 连接状态、数据库数量和引擎：

![设置](docs/croissant-settings.png)

## 环境要求

| 项目 | 要求 |
| --- | --- |
| DSH | `>=0.2.2-rc.1 <0.3.0` |
| Node.js | `>=20`；En Croissant 数据库功能需要 `node:sqlite`（Node 22.5+，DSH Desktop 当前使用 Node 24） |
| En Croissant | 可选；本插件只读兼容 0.15.x 的 `db3` 旧库格式 |
| Stockfish | 推荐 16/17；也可使用 En Croissant 的其它本地 UCI 引擎 |

## 安装

```sh
# npm 发布后
dsh plugin --profile <profile> add dsh-chess-coach

# 本地 tarball
pnpm build && pnpm pack
dsh plugin --profile <profile> add ./dsh-chess-coach-0.2.0.tgz
```

Desktop 的 `desktop` profile 由 Electron 管理，命令行 `dsh plugin` 会拒绝修改；请使用 DSH 的插件安装入口，或本仓库开发时使用的 local bundle 安装。

本机构建产物（当前未安装，可手动安装）：

`D:\DSH\artifacts\dsh-chess-coach-0.2.0.tgz`

打开方式：**展开右侧栏 → 指南页点击「棋局教练」**。

## 使用

| 操作 | 说明 |
| --- | --- |
| AI 教练 | 默认标签；显示局面总结、双方计划、战术警报和教练首选 |
| 引擎 | MultiPV 候选线，点击可切换棋盘箭头 |
| 数据库 | 选择 En Croissant `.db3`，按棋手/赛事/结果查询；点击带 `PGN` 或 `Lichess` 标记的对局载入 |
| 着法 | 完整着法列表，点击任意半回合回看 |
| 全屏右侧栏 | 自动切换双栏布局，接近 En Croissant 的分析窗口 |

快捷键：`←`/`→` 上一步/下一步，`Home`/`End` 开局/最新，`F` 翻转，`Esc` 关闭弹窗。

## 配置 `cordis.patch.yml`

```yaml
- id: dsh-chess-coach
  name: dsh-chess-coach
  config:
    # 可选：手动指定 Stockfish
    enginePath: 'C:\Program Files\Stockfish\stockfish.exe'
    threads: 4
    hashMb: 256
    defaultMultipv: 3
    # 可选：En Croissant 数据目录/应用路径（默认自动检测）
    enCroissantDataDir: 'C:\Users\<you>\AppData\Roaming\org.encroissant.app'
    enCroissantAppPath: 'D:\en-croissant\en-croissant.exe'
```

patch 会替换整段 `config`，不是深合并；覆盖时请写全需要的键。

## 安全与隐私

- En Croissant 数据目录**只读**打开；插件不写 `.db3`、`.ecsi`、`.pgn`，不修改 En Croissant 配置。
- Host 路由为同源 `/chess-coach/api/*`，检查 `Host`/`Origin`、`sec-fetch-site`，请求体上限 64 KiB。
- 数据库名拒绝路径分隔符；引擎路径只能是服务端发现的白名单；En Croissant 启动路径只接受检测到的固定可执行文件，不经过 shell。
- 本地 Stockfish 不联网；只有开启云评估/开局库时，当前 FEN 才会发给 Lichess。
- 读取 En Croissant 数据库后只返回对局元数据和 PGN，不执行数据库中的任何内容。

## 开发

```sh
pnpm install
pnpm typecheck
pnpm test          # 15 个测试，含真实 Stockfish 与 En Croissant 文件桥
pnpm test:engine
pnpm build         # lib/index.js (ESM host) + lib/client.js (DSH lazy-CJS browser factory)
pnpm pack
```

### 结构

```
src/
  index.ts                 Host 路由与生命周期
  host/
    engine.ts              UCI 常驻引擎、取消/串行、候选合并
    encroissant.ts         En Croissant 只读文件桥（引擎/数据库/PGN/Lichess/启动）
    coach.ts               FEN + 引擎线 → 教练报告
    lichess.ts             cloud-eval / opening explorer
  shared/types.ts          Host ↔ Client wire types
  client/
    index.tsx              DSH 右侧栏 type/body/title 注册
    ChessCoach.tsx         棋局状态、分析调度、En Croissant 风格布局
    EnCroissantPanel.tsx   数据库浏览
    CoachPanel.tsx         AI 教练
    Board.tsx              8×8 棋盘
    piece-theme.ts         cburnett 棋子（生成）
    styles.ts              En Croissant 主题与布局
tests/                     15 个单元/集成测试
```

### 与 DSH 发布规范对应

- `dsh.bundle.patch` → `cordis.patch.yml`，安装后插入一行 `dsh-chess-coach`。
- `dsh.client` 声明 web platform、inject 和 browser entry；Client bundle 是 DSH Module Loader 的 lazy-CJS factory。
- `files` 只发布构建产物、patch、manifest、README、LICENSE、第三方声明、图标和截图。
- `engines.dsh` 限制兼容范围；React 是唯一 peer。
- Host 不静态 import 任何 `@deepseek-ai/dsh-*` 运行时包；Client 只使用公开的 slot/tab 注册面。

## 已知限制

- En Croissant 0.15.x 旧库格式；Database v2（DuckDB）尚未接入。
- `Moves` BLOB 不解码；没有 PGN/Lichess 来源的对局只能看元数据。
- `.pgn` 附属文件是导入快照，可能漂移；匹配失败会提示。
- Lc0 需要权重文件和后端参数，当前不列入可选引擎。
- 没有在线对战、时钟、开局库训练/间隔重复；这些仍请在 En Croissant 本体中使用。
- 教练文字是确定性规则 + 引擎评估，不会凭空编造评估。

## License

代码 MIT。cburnett 棋子 SVG 为 **GPL-2.0-or-later**（Colin M.L. Burnett），完整文本见 [`LICENSES/GPL-2.0.txt`](LICENSES/GPL-2.0.txt)；第三方声明见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

En Croissant 是独立的 GPL-3.0 项目，本项目不包含其源码，也不代表 En Croissant 官方。Stockfish 是独立的 GPLv3 程序，本项目只通过 UCI 调用，不打包其二进制。Lichess 数据受其服务条款与速率限制约束。
