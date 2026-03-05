# Heart Beat Demo

基于 `Vue 3 + Vite + Web Bluetooth` 的心率可视化 demo，数据源来自 iOS App「心率广播」+ Apple Watch。

目标是逐步从当前图表方案升级到 `WebGL/WebGPU` 渲染，实现更有表现力的心跳动画可视化。

## 参考 App

- App Store（中国区）: [心率广播 Heart Rate Monitor](https://apps.apple.com/cn/app/%E5%BF%83%E7%8E%87%E5%B9%BF%E6%92%AD-heart-rate-monitor/id6473728264)
- 需要配合 Apple Watch 使用（由 iPhone 端进行心率广播）

## 当前状态

- 当前仍处于开发/测试阶段，文档以技术方向和接入流程为主
- 已在验证 Web Bluetooth 心率数据读取链路（`heart_rate` / `heart_rate_measurement`）
- 可视化方案正在从普通图表逐步迁移到 `WebGL/WebGPU`

## 环境要求

- Apple Watch + iPhone
- iPhone 安装并开启「心率广播」App 的蓝牙广播功能
- 一台支持 Web Bluetooth 的浏览器环境（建议桌面 Chromium 内核浏览器）
- `localhost` 或 `HTTPS`（Web Bluetooth 需要安全上下文）

## 本地运行

```bash
npm install
npm run dev
```

打开：`http://localhost:5173`

## GitHub Actions

- CI 校验：`.github/workflows/ci.yml`
  - push / PR 自动安装依赖并执行 `yarn build`
- GitHub Pages 发布：`.github/workflows/deploy-pages.yml`
  - 推送到 `main` / `master` 自动构建并部署到 Pages

首次启用请在仓库 `Settings -> Pages` 中将 `Source` 设为 `GitHub Actions`。

## 使用流程（心率广播 + 本项目）

1. 在 iPhone 打开「心率广播」App，并确认已连接 Apple Watch。
2. 在 App 中开启蓝牙心率广播（具体按钮名称可能随版本变化）。
3. 在浏览器打开本项目开发页后，执行当前版本中的连接操作（以代码实现为准）。
4. 在系统蓝牙选择弹窗中选择心率设备（常见名称前缀如 `xinlvguangbo` / `xinlv`）。
5. 连接成功后即可看到实时 BPM、RR 和趋势图更新。

## WebGL/WebGPU 升级方向

建议将现有蓝牙数据层保留，替换渲染层：

1. 数据层：继续使用 `src/composables/useHeartBluetooth.ts` 输出 BPM/RR 流。
2. 渲染层：新增 `HeartRenderer`（WebGL/WebGPU）负责心跳脉冲、粒子、波形动画。
3. 兼容层：浏览器不支持 WebGPU 时自动降级到 WebGL 或当前图表方案。

可以先做 MVP：

- BPM 驱动脉冲缩放频率
- RR 驱动波形间隔与抖动强度
- 保留最近 30~60 秒历史数据做轨迹拖尾

## 更新日志

### 2026-03-06

- 调整顶部状态栏交互：连接蓝牙设备按钮改为顶部常驻（不再右下角悬浮），并与连接状态样式联动。
- 优化桌面端首屏布局自适应：主区域按视口高度分配，减少常见屏幕下首屏滚动。
- 设备信息卡片改造：
  - 设备名称固定展示
  - BPM 历史列表改为可滚动栏（支持拖动滚动条）
- ECG 波形改为“固定窗口持续滚动”：
  - 以固定时间步推进波形，数据从右侧进入、向左滚动
  - 修复“连接后仍显示等待心跳数据”问题
  - 修复网格/刻度刷新异常问题
  - 隐藏底部时间刻度显示（保留网格与波形）
- 连接按钮可见性兜底：避免连接/动画状态切换时按钮偶发隐藏。

### 2026-03-05

- 首页改为深色医疗可视化仪表盘风格，整合原 HeartTest 逻辑。
- 新增中英文切换（默认中文），并补充关于信息弹窗（作者信息与免责声明）。
- Three.js 心形粒子交互增强：
  - 点击法线方向波纹、颜色变化与多次叠加
  - 断连超时后粒子逐步下落到平面，重连后回升聚合成心形
  - OrbitControls 禁止平移并限制缩放范围
- ECG 与心率展示改进：
  - BPM 健康区间提示与颜色分级
  - 全屏视图联动（3D + ECG）
  - 移除无真实来源的 RR 变异展示项
- 顶部与页面动效补充：接入 GSAP 做入场与状态反馈动画（保留主要信息可读性）。

## 常见问题

- 无法点击连接/连接失败：
  - 确认在 `localhost` 或 `HTTPS`
  - 确认浏览器已开启蓝牙权限
  - 确认 iPhone App 已开始广播
- 能连接但无数据：
  - 检查 Apple Watch 是否正在采样
  - 断开后重新连接一次设备
