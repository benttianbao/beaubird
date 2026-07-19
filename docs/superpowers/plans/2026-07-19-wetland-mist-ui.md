# 湿地晨雾 UI 换肤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不影响任何业务功能的前提下，把 BeauBird 主界面视觉升级为「湿地晨雾」风格（清晨湿地、薄雾、青绿 + 暖金点缀）。

**Architecture:** 纯视觉层改动。以 `style.css` 的 CSS 变量与选择器为主；`index.html` 仅更新 stylesheet cache-bust 参数。不改 `script.js` / `src/script/`、不改控件 `id`、不改导航 `data-target`、不引入远程字体或 CDN。开工前用 git tag 冻结当前前端。

**Tech Stack:** 静态 HTML + 单文件 CSS（OKLCH + hex 回退）、现有 Node UI 回归测试脚本。

**Spec:** `docs/superpowers/specs/2026-07-19-wetland-mist-ui-design.md`

---

## File map

| 文件 | 职责 |
|------|------|
| `style.css` | 全部视觉 token 与组件样式（主改） |
| `index.html` | 仅 `link rel="stylesheet"` 的 `?v=` cache-bust |
| `docs/superpowers/specs/2026-07-19-wetland-mist-ui-design.md` | 已定案设计（只读参考） |
| `tools/test-bird-prep-ui.js` | 回归：预习 PPT UI 结构/文案（不改逻辑则应继续通过） |
| `tools/test-unlocked-toggle-ui.js` | 回归：未解锁相关 UI（不改逻辑则应继续通过） |

**不修改：** `src/script/**`、`script.js`、`server/**`、Android 原生代码。

---

### Task 1: Git 基线冻结

**Files:**
- None (git only)

- [ ] **Step 1: 确认工作区状态**

Run:

```powershell
git status -sb
git log -1 --oneline
```

Expected:
- 分支为当前功能分支（如 `codex/frontend-modularization`）
- 工作区干净，或仅有无关未跟踪目录（如 `graphify-out/`）
- **不要**提交 `graphify-out/`

- [ ] **Step 2: 打 tag 冻结老版本**

Run:

```powershell
git tag -a pre-ui-wetland-mist -m "Baseline before wetland mist UI refresh"
git show pre-ui-wetland-mist --no-patch
```

Expected: tag 指向当前 HEAD（含已提交的 design/plan 文档亦可；**关键是 `style.css` / `index.html` 尚未换肤**）。

若 tag 已存在且指向错误 commit：

```powershell
git tag -d pre-ui-wetland-mist
git tag -a pre-ui-wetland-mist -m "Baseline before wetland mist UI refresh"
```

- [ ] **Step 3: 记录回滚命令（写入会话备忘，不必 commit）**

回滚前端：

```powershell
git checkout pre-ui-wetland-mist -- style.css index.html
```

---

### Task 2: 升级 `:root` token 与 OKLCH 回退

**Files:**
- Modify: `style.css`（文件顶部 `:root { ... }` 与 `@supports not (color: oklch(...))` 块，约 L1–105）

- [ ] **Step 1: 更新 OKLCH 设计 token**

在 `style.css` 的 `:root` 中，将下列变量替换/调整为「湿地晨雾」值（保留未列出的变量；可新增本任务列出的变量）：

```css
:root {
  --bg: oklch(97.2% 0.008 185);
  --surface: oklch(99.2% 0.004 190);
  --sidebar: oklch(94.5% 0.01 185);
  --sidebar-shell: oklch(36% 0.055 170);
  --sidebar-shell-strong: oklch(28% 0.05 170);
  --sidebar-ink: oklch(97% 0.01 150);
  --sidebar-muted: oklch(78% 0.03 155);
  --sidebar-line: color-mix(in oklch, var(--sidebar-ink) 14%, transparent);
  --sidebar-hover: color-mix(in oklch, var(--sidebar-ink) 8%, transparent);
  --sidebar-active: color-mix(in oklch, var(--sidebar-ink) 12%, transparent);
  --panel: var(--surface);
  --panel-muted: oklch(97.6% 0.007 188);
  --text: oklch(22% 0.02 210);
  --muted: oklch(46% 0.02 210);
  --primary: oklch(44% 0.09 175);
  --primary-strong: oklch(32% 0.07 175);
  --primary-soft: oklch(94% 0.03 175);
  --accent: oklch(45% 0.085 245);
  --accent-monitor: oklch(58% 0.12 65);
  --accent-unlocked: oklch(52% 0.1 248);
  --accent-ppt: oklch(51% 0.11 305);
  --accent-ebird: oklch(47% 0.09 148);
  --accent-birdreport: oklch(51% 0.09 195);
  --danger: oklch(46% 0.13 28);
  --border: oklch(88% 0.012 200);
  --border-strong: oklch(78% 0.016 200);
  --shadow-subtle: 0 1px 2px rgba(18, 40, 36, 0.05);
  --shadow-panel: 0 1px 2px rgba(18, 40, 36, 0.04), 0 8px 24px rgba(18, 40, 36, 0.06);
  --shadow-panel-active: 0 2px 6px rgba(18, 40, 36, 0.08), 0 14px 32px rgba(18, 40, 36, 0.08);
  --shadow-nav-active: 0 1px 2px rgba(5, 22, 18, 0.12), 0 8px 18px rgba(5, 22, 18, 0.14);
  --shadow-button: 0 1px 2px rgba(18, 40, 36, 0.08), 0 6px 14px rgba(18, 40, 36, 0.1);
  --radius: 10px;
  --radius-panel: 16px;
  /* 保留 section-* / controls / stats / state / ease / focus / sticky 等既有变量；
     可按需微调 --section-surface 混色比例，但不要删除依赖它们的选择器 */
}
```

新增（若尚不存在）：

```css
:root {
  --bg-glow-warm: oklch(92% 0.03 85);
  --bg-glow-cool: oklch(93% 0.025 175);
  --mist-inset: inset 0 1px 0 color-mix(in oklch, var(--surface) 78%, transparent);
}
```

- [ ] **Step 2: 同步 hex 回退块**

在 `@supports not (color: oklch(50% 0 0))` 的 `:root` 中更新对应 hex，至少包括：

```css
@supports not (color: oklch(50% 0 0)) {
  :root {
    --bg: #f2f7f6;
    --surface: #fbfcfc;
    --sidebar: #ebf2f1;
    --sidebar-shell: #1f5248;
    --sidebar-shell-strong: #173f38;
    --sidebar-ink: #f3faf6;
    --sidebar-muted: #b5d0c4;
    --sidebar-line: rgba(243, 250, 246, 0.16);
    --sidebar-hover: rgba(243, 250, 246, 0.09);
    --sidebar-active: rgba(243, 250, 246, 0.14);
    --panel-muted: #f3f8f7;
    --text: #1f3036;
    --muted: #5f6e75;
    --primary: #1f7a6c;
    --primary-strong: #14564d;
    --primary-soft: #e3f4ef;
    --accent: #346eb8;
    --accent-monitor: #b06e18;
    --accent-unlocked: #3a6fbd;
    --accent-ppt: #7d5bb8;
    --accent-ebird: #2a7a4d;
    --accent-birdreport: #2a7d8b;
    --danger: #a13f32;
    --border: #d4dedf;
    --border-strong: #b7c5c8;
    --bg-glow-warm: #f3ebd4;
    --bg-glow-cool: #dceee8;
    /* 其余 section/state 回退保持可读；若依赖 oklch mix 的中间态在旧浏览器偏灰，
       现有回退中的 --section-surface 等可略调亮 */
  }
}
```

- [ ] **Step 3: 提交 token 层**

```powershell
git add style.css
git commit -m "style: refresh wetland mist design tokens"
```

---

### Task 3: 页面底与工作台外壳

**Files:**
- Modify: `style.css`（`body`、`.workspace-shell`、`.workspace-content`，约 L117–370）

- [ ] **Step 1: 给 body 加雾面光晕背景**

将 `body` 背景从纯色改为分层（保留字体与 overflow 规则）：

```css
body {
  margin: 0;
  background:
    radial-gradient(1200px 520px at 12% -8%, color-mix(in oklch, var(--bg-glow-warm) 55%, transparent), transparent 62%),
    radial-gradient(900px 480px at 88% 0%, color-mix(in oklch, var(--bg-glow-cool) 50%, transparent), transparent 58%),
    var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  overflow-x: hidden;
}
```

非 OKLCH 浏览器可用近似：

```css
/* 若 color-mix 不可用，径向层可退化为 var(--bg) 纯色；
   不必单独写第二套 body，浏览器会忽略无法解析的层或回退到最后的 var(--bg) */
```

- [ ] **Step 2: 微调 shell 与 content 间距**

```css
.workspace-shell {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  align-items: start;
  width: min(1480px, 100%);
  margin: 0 auto;
  min-height: 100vh;
}

.workspace-content {
  min-width: 0;
  padding: 32px 36px 48px;
  gap: 22px;
}
```

- [ ] **Step 3: 提交**

```powershell
git add style.css
git commit -m "style: add mist background and content breathing room"
```

---

### Task 4: 侧栏与导航「工具坞」

**Files:**
- Modify: `style.css`（`.workspace-sidebar`、`.hero*`、`.app-quicknav*`，约 L137–357）

- [ ] **Step 1: 加深侧栏与 logo**

```css
.workspace-sidebar {
  position: sticky;
  top: 0;
  z-index: 12;
  min-height: 100vh;
  padding: 28px 16px;
  border-right: 0;
  background:
    radial-gradient(180px 120px at 20% 8%, color-mix(in oklch, var(--sidebar-ink) 12%, transparent), transparent 70%),
    linear-gradient(180deg, var(--sidebar-shell) 0%, var(--sidebar-shell-strong) 100%);
  box-shadow: inset -1px 0 0 var(--sidebar-line);
}

.hero-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  border: 1px solid var(--sidebar-line);
  border-radius: 14px;
  color: oklch(82% 0.11 148);
  background:
    linear-gradient(160deg, color-mix(in oklch, var(--sidebar-ink) 16%, transparent), color-mix(in oklch, var(--sidebar-ink) 6%, transparent));
  box-shadow: 0 12px 28px rgba(5, 22, 18, 0.22), inset 0 1px 0 color-mix(in oklch, var(--sidebar-ink) 22%, transparent);
}
```

- [ ] **Step 2: 强化导航 active / hover**

确保 `.app-quicknav-btn`：
- `border-radius: 12px`
- `min-height: 42px`
- active 时使用分区 `--nav-accent` 混色背景 + `box-shadow: var(--shadow-nav-active)`
- `::before` 色条在 active 时 `opacity: 1` 且 `scaleY(1)`（移动端保持现有底部条逻辑，见 Task 7）

`.quicknav-icon`：`border-radius: 9px`；active 时 inset 描边略加强。

- [ ] **Step 3: 提交**

```powershell
git add style.css
git commit -m "style: deepen sidebar dock and navigation states"
```

---

### Task 5: 面板、优先级块与分区顶条

**Files:**
- Modify: `style.css`（`.panel`、`.workspace-panel*`、`.panel::before`、`.panel h2::before`，约 L393–531）

- [ ] **Step 1: 面板卡片化**

```css
.panel {
  min-width: 0;
  max-width: 100%;
  background: color-mix(in oklch, var(--section-accent) 2.5%, var(--panel));
  border: 1px solid color-mix(in oklch, var(--section-accent) 14%, var(--border));
  border-radius: var(--radius-panel);
  padding: 24px 24px 22px;
  box-shadow: var(--shadow-panel);
  position: relative;
  overflow: hidden;
  transition:
    border-color 180ms var(--ease-out-quart),
    box-shadow 180ms var(--ease-out-quart),
    background-color 180ms var(--ease-out-quart);
}

.panel::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    var(--section-accent),
    color-mix(in oklch, var(--section-accent) 45%, var(--accent-monitor)),
    color-mix(in oklch, var(--section-accent) 55%, var(--accent))
  );
  opacity: 0.85;
}

.workspace-panel--priority {
  background:
    linear-gradient(180deg, color-mix(in oklch, var(--section-accent) 10%, var(--panel)) 0%, var(--section-surface) 58%),
    var(--section-surface);
  border-color: color-mix(in oklch, var(--section-accent) 32%, var(--border));
  box-shadow: 0 2px 6px rgba(18, 40, 36, 0.06), 0 16px 36px rgba(18, 40, 36, 0.07);
}

.panel h2::before {
  width: 9px;
  height: 9px;
  border-radius: 4px;
  background: var(--section-accent);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--section-accent) 18%, transparent);
}
```

- [ ] **Step 2: 保持 jump-target 动画**

确认 `.panel.is-jump-target` 与 `@keyframes panel-jump-focus` 仍工作；若背景改为更复杂渐变，动画终点使用 `var(--panel)` 或当前 section 背景即可，不要删除该交互反馈。

- [ ] **Step 3: 提交**

```powershell
git add style.css
git commit -m "style: cardify workspace panels with morning accent bar"
```

---

### Task 6: 表单壳、输入框与按钮

**Files:**
- Modify: `style.css`（input/select、`.controls` / grid shells、`button` / `button.ghost`，约 L557–720、L1054–1125）

- [ ] **Step 1: 输入控件**

```css
input[type="text"],
input[type="number"],
input[type="date"],
input[type="password"],
textarea,
select,
input[type="file"] {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--control-padding-y) var(--control-padding-x);
  background: var(--surface);
  color: var(--text);
  box-shadow: inset 0 1px 0 rgba(18, 40, 36, 0.03);
  transition:
    border-color 150ms var(--ease-out-quart),
    box-shadow 150ms var(--ease-out-quart),
    background-color 150ms var(--ease-out-quart);
}

input[type="text"]:focus,
input[type="number"]:focus,
input[type="date"]:focus,
input[type="password"]:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: color-mix(in oklch, var(--section-accent) 70%, var(--border));
  background: color-mix(in oklch, var(--section-accent) 4%, var(--surface));
  box-shadow: var(--focus-ring);
}
```

- [ ] **Step 2: 控件壳统一雾面**

对 `.ebird-grid`、`.bird-prep-picker`、以及同类 controls 壳（含 `.controls` 若已有壳样式）统一：

```css
border-radius: 12px;
box-shadow: var(--mist-inset);
/* 保留 --controls-surface / --controls-border */
```

- [ ] **Step 3: 主按钮与 ghost**

在现有 `button` 规则上调整为：

```css
button {
  /* 保留 width/font 等全局规则 */
  border-radius: var(--radius);
  padding: var(--button-padding-y) var(--button-padding-x);
  border: 1px solid color-mix(in oklch, var(--section-accent) 35%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in oklch, var(--section-accent) 8%, var(--primary)) 0%,
    var(--primary) 100%
  );
  color: oklch(99% 0.01 150);
  font-weight: 700;
  box-shadow: var(--shadow-button);
  cursor: pointer;
  transition:
    transform 150ms var(--ease-out-quart),
    box-shadow 150ms var(--ease-out-quart),
    filter 150ms var(--ease-out-quart),
    background-color 150ms var(--ease-out-quart);
}

button:hover:not(:disabled) {
  filter: brightness(1.03);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(18, 40, 36, 0.1), 0 10px 20px rgba(18, 40, 36, 0.12);
}

button:active:not(:disabled) {
  transform: translateY(0);
  filter: brightness(0.98);
}

button.ghost {
  background: color-mix(in oklch, var(--section-accent) 4%, var(--surface));
  color: var(--section-link);
  border-color: color-mix(in oklch, var(--section-accent) 22%, var(--border));
  box-shadow: none;
}

button.ghost:hover:not(:disabled) {
  background: color-mix(in oklch, var(--section-accent) 10%, var(--surface));
  border-color: color-mix(in oklch, var(--section-accent) 34%, var(--border));
  filter: none;
}
```

**注意：** 若现有主按钮使用 `var(--section-accent)` 而非 `--primary`，优先与「分区主操作」一致——即主按钮背景用 `var(--section-accent)` 及其 deep mix，避免五个分区按钮都变成同一青绿。实现时以**分区 accent 驱动主按钮**为准：

```css
button {
  background: linear-gradient(
    180deg,
    color-mix(in oklch, var(--section-accent) 78%, white) 0%,
    var(--section-accent) 100%
  );
  border-color: color-mix(in oklch, var(--section-accent) 55%, var(--text));
  color: oklch(99% 0.01 150);
}
```

- [ ] **Step 4: 提交**

```powershell
git add style.css
git commit -m "style: refine controls and action buttons for mist UI"
```

---

### Task 7: 空状态、stats、消息与详情浮层

**Files:**
- Modify: `style.css`（`.empty-state*`、`.stats`、`.message*`、`.query-detail*` / `.birdreport-rare-detail*` 相关）

- [ ] **Step 1: 空状态引导卡片**

```css
.empty-state {
  display: grid;
  justify-items: center;
  gap: 6px;
  border: 1px dashed color-mix(in oklch, var(--section-accent) 28%, var(--border));
  border-radius: 12px;
  padding: 20px 16px;
  background:
    radial-gradient(circle at 50% 0%, color-mix(in oklch, var(--section-accent) 10%, transparent), transparent 55%),
    color-mix(in oklch, var(--section-accent) 5%, var(--panel-muted));
  color: var(--muted);
  text-align: center;
  font-size: 0.9rem;
  line-height: 1.45;
}

.empty-state::before {
  content: "";
  display: block;
  width: 40px;
  height: 40px;
  margin: 0 auto 2px;
  border-radius: 999px;
  border: 2px solid color-mix(in oklch, var(--section-accent) 42%, transparent);
  background:
    radial-gradient(circle at center, color-mix(in oklch, var(--section-accent) 62%, var(--surface)) 0 4px, transparent 5px),
    color-mix(in oklch, var(--section-accent) 10%, var(--surface));
  box-shadow: 0 6px 14px color-mix(in oklch, var(--section-accent) 12%, transparent);
}

.empty-state-title {
  color: color-mix(in oklch, var(--section-accent) 40%, var(--text));
  font-size: 0.96rem;
  font-weight: 800;
}
```

- [ ] **Step 2: stats 与 message**

- `.stats`：略增 gap、圆角 12px、背景用 `--stats-surface`。
- `.message.error` / `.message.is-loading`：保持现有语义 class；可略提背景对比。
- 不改 message 的 DOM 或 JS 写入逻辑。

- [ ] **Step 3: 详情浮层**

对 `.query-detail-backdrop`、`.birdreport-rare-detail-backdrop`：
- `background: color-mix(in oklch, oklch(20% 0.02 200) 45%, transparent)` 或等价 rgba 深雾。

对详情面板：
- `border-radius: var(--radius-panel)`
- `box-shadow: var(--shadow-panel-active)`

- [ ] **Step 4: 提交**

```powershell
git add style.css
git commit -m "style: polish empty states, stats, and detail overlays"
```

---

### Task 8: 响应式与 Android 收敛

**Files:**
- Modify: `style.css`（`@media (max-width: 860px)`、`640px`、`420px`、`.embedded-android-app` 段）

- [ ] **Step 1: 窄屏减弱重阴影**

在 `@media (max-width: 860px)` 的 `:root` 或选择器中增加：

```css
@media (max-width: 860px) {
  :root {
    --shadow-panel: 0 1px 2px rgba(18, 40, 36, 0.05), 0 4px 12px rgba(18, 40, 36, 0.04);
    --shadow-panel-active: 0 2px 4px rgba(18, 40, 36, 0.07), 0 8px 18px rgba(18, 40, 36, 0.06);
    --shadow-button: 0 1px 2px rgba(18, 40, 36, 0.07);
    --radius-panel: 14px;
  }

  body {
    background: var(--bg);
  }

  .workspace-content {
    padding: 12px;
  }

  button:hover:not(:disabled) {
    transform: none;
  }
}
```

- [ ] **Step 2: 保持移动端侧栏横向导航**

确认 860px 下：
- `.workspace-shell { grid-template-columns: 1fr; }`
- `.workspace-nav-items` 横向滚动
- `.app-quicknav-btn::before` 底部条逻辑不被 Task 4 破坏

- [ ] **Step 3: Android 壳**

`.embedded-android-app`：
- 背景用 `var(--bg)`（可无径向光晕，省电）
- 侧栏渐变与桌面 token 一致即可
- 不改 safe-area padding 逻辑

- [ ] **Step 4: reduced-motion**

确认现有 `@media (prefers-reduced-motion: reduce)` 仍覆盖 `*` 的 animation/transition；若主按钮 hover 用 transform，reduced-motion 下已有全局缩短即可。

- [ ] **Step 5: 提交**

```powershell
git add style.css
git commit -m "style: tone down mist effects on narrow and Android layouts"
```

---

### Task 9: cache-bust 与回归验证

**Files:**
- Modify: `index.html` L7（stylesheet href）
- Test: `tools/test-bird-prep-ui.js`、`tools/test-unlocked-toggle-ui.js`

- [ ] **Step 1: 更新 cache-bust**

将：

```html
<link rel="stylesheet" href="./style.css?v=20260613-0001" />
```

改为当日版本，例如：

```html
<link rel="stylesheet" href="./style.css?v=20260719-wetland-mist" />
```

- [ ] **Step 2: 跑 UI 回归**

Run:

```powershell
node tools\test-bird-prep-ui.js
node tools\test-unlocked-toggle-ui.js
```

Expected: 全部 PASS（这些测试断言结构/文案/开关，不依赖具体颜色）。

若失败：先确认是否误改了 HTML 结构或 class 名；本计划不应改业务 class。仅当测试硬编码旧 class 且你有意重命名时才改测试——**本计划禁止重命名业务 class**。

- [ ] **Step 3: 手工验收清单（实现者勾选）**

- [ ] 五区导航切换、`is-active` 正常
- [ ] 各面板输入与主/ghost 按钮可点
- [ ] 空状态可见且分区色正确
- [ ] 详情浮层开合正常
- [ ] &lt;860px 无横向溢出，阴影不过重
- [ ] 无新增远程字体/CDN
- [ ] `git diff pre-ui-wetland-mist -- script.js src` 为空（确认未碰脚本）

- [ ] **Step 4: 最终提交**

```powershell
git add index.html style.css
git commit -m "style: ship wetland mist UI cache-bust and polish"
```

- [ ] **Step 5: 对照基线（可选）**

```powershell
git diff pre-ui-wetland-mist --stat -- style.css index.html
```

Expected: 仅这两个文件有显著 diff（外加本计划/spec 若已在 tag 之后提交）。

---

## Spec coverage self-check

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 开工前 tag `pre-ui-wetland-mist` | Task 1 |
| 湿地晨雾 token / OKLCH+hex | Task 2 |
| 页面雾面光晕 | Task 3 |
| 侧栏工具坞 | Task 4 |
| 面板卡片 + 晨光顶条 + 优先级监测 | Task 5 |
| 表单/按钮 | Task 6 |
| 空状态/stats/浮层 | Task 7 |
| 窄屏减弱阴影 + Android | Task 8 |
| 不改功能/脚本；cache-bust；回归 | Task 9 |
| 无远程依赖 | 全任务约束 |
| 回滚路径 | Task 1 Step 3 |

**Placeholder scan:** 无 TBD/TODO；CSS 步骤含具体值；命令可直接运行。

**一致性：** 主按钮以 `--section-accent` 分区驱动（Task 6 已写明，避免与 `--primary` 冲突）。

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-19-wetland-mist-ui.md`.

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每个 Task 派生子代理，任务间复查，迭代快  
2. **Inline Execution** — 本会话按 executing-plans 顺序执行，设检查点  

你更想用哪一种？
