<template>
  <section class="about-page">
    <header class="glass hero">
      <div class="hero-copy">
        <p class="hero-kicker">CARDIOVIS</p>
        <h1 class="hero-title">关于页面</h1>
        <p class="hero-subtitle">
          面向实时心率可视化的 Web 端实验项目，提供蓝牙连接、心率趋势展示、3D 心脏交互与全屏监测体验。
        </p>
      </div>
      <RouterLink class="back-link" to="/">返回实时监测</RouterLink>
    </header>

    <section class="about-grid">
      <article class="glass card">
        <h2>项目目标</h2>
        <p>
          在浏览器中快速搭建一个可运行的心率监测面板，帮助验证设备联通性、交互体验和可视化表达。
        </p>
      </article>

      <article class="glass card">
        <h2>核心能力</h2>
        <ul>
          <li>Web Bluetooth 连接心率设备</li>
          <li>实时 BPM 状态与健康区间提示</li>
          <li>3D 心脏波纹反馈与节律跳动</li>
          <li>实时 ECG 风格波形显示</li>
        </ul>
      </article>

      <article class="glass card">
        <h2>技术栈</h2>
        <div class="stack">
          <span>Vue 3</span>
          <span>TypeScript</span>
          <span>Vite</span>
          <span>Three.js</span>
          <span>ECharts</span>
          <span>Web Bluetooth</span>
        </div>
      </article>

      <article class="glass card">
        <h2>数据说明</h2>
        <p>
          本地页面仅处理设备实时广播的心率数据，不内置外部云端上传逻辑。生产环境请补充数据加密、权限声明与合规策略。
        </p>
      </article>
    </section>
  </section>
</template>

<style scoped>
.about-page {
  display: grid;
  gap: 12px;
}

.glass {
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-radius: 16px;
  background: linear-gradient(
    160deg,
    rgba(2, 6, 23, 0.76),
    rgba(15, 23, 42, 0.5)
  );
  box-shadow:
    0 18px 30px rgba(2, 6, 23, 0.44),
    inset 0 1px 0 rgba(226, 232, 240, 0.07);
  backdrop-filter: blur(14px);
}

.hero {
  padding: 20px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.hero-copy {
  max-width: 760px;
}

.hero-kicker {
  margin: 0;
  color: #22d3ee;
  letter-spacing: 0.1em;
  font-size: 12px;
  font-weight: 700;
}

.hero-title {
  margin: 8px 0 10px;
  color: #f8fafc;
  font-size: 30px;
  line-height: 1.1;
}

.hero-subtitle {
  margin: 0;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.75;
}

.back-link {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.34);
  color: #bae6fd;
  font-weight: 700;
  letter-spacing: 0.03em;
  background: rgba(2, 6, 23, 0.65);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.back-link:hover {
  border-color: rgba(34, 211, 238, 0.6);
  background: rgba(15, 23, 42, 0.84);
  color: #e0f2fe;
}

.about-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.card {
  padding: 18px;
  display: grid;
  gap: 8px;
}

.card h2 {
  margin: 0;
  color: #e2e8f0;
  font-size: 18px;
}

.card p {
  margin: 0;
  color: #94a3b8;
  line-height: 1.75;
  font-size: 14px;
}

.card ul {
  margin: 0;
  padding-left: 18px;
  color: #cbd5e1;
  display: grid;
  gap: 6px;
  font-size: 14px;
}

.stack {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stack span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(34, 211, 238, 0.28);
  background: rgba(2, 6, 23, 0.56);
  color: #67e8f9;
  font-size: 12px;
  font-weight: 600;
}

@media (max-width: 880px) {
  .hero {
    flex-direction: column;
  }

  .about-grid {
    grid-template-columns: 1fr;
  }
}
</style>
