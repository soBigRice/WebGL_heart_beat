<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as echarts from 'echarts'

const chartRef = ref<HTMLDivElement | null>(null)

const SAMPLE_SIZE = 360
const SAMPLE_INTERVAL_MS = 24

const signalData = Array.from({ length: SAMPLE_SIZE }, () => 0)

let chart: echarts.ECharts | null = null
let animationFrameId: number | null = null
let lastFrameTime = 0
let accumulatedMs = 0
let elapsedSeconds = 0
let phase = 0

const gaussian = (x: number, center: number, width: number, amplitude: number): number => {
  const normalized = (x - center) / width
  return amplitude * Math.exp(-normalized * normalized)
}

const generateEcgSample = (deltaSeconds: number): number => {
  elapsedSeconds += deltaSeconds
  const bpm =
    74 + Math.sin(elapsedSeconds * 0.24) * 3.8 + Math.sin(elapsedSeconds * 0.051) * 2.2
  const beatDuration = 60 / Math.max(52, bpm)
  phase = (phase + deltaSeconds / beatDuration) % 1

  const pWave = gaussian(phase, 0.18, 0.024, 0.12)
  const qWave = gaussian(phase, 0.36, 0.0095, -0.2)
  const rWave = gaussian(phase, 0.4, 0.007, 1.42)
  const sWave = gaussian(phase, 0.44, 0.013, -0.34)
  const tWave = gaussian(phase, 0.7, 0.052, 0.31)
  const baselineWander = Math.sin(elapsedSeconds * 0.78) * 0.02
  const noise = (Math.random() - 0.5) * 0.014

  return pWave + qWave + rWave + sWave + tWave + baselineWander + noise
}

const buildOption = (): echarts.EChartsOption => ({
  animation: false,
  backgroundColor: 'transparent',
  grid: {
    left: 8,
    right: 8,
    top: 10,
    bottom: 10,
    containLabel: false,
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: signalData.map((_, index) => index),
    axisLabel: { show: false },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: {
      show: true,
      lineStyle: {
        color: 'rgba(56, 189, 248, 0.08)',
      },
    },
  },
  yAxis: {
    type: 'value',
    min: -0.65,
    max: 1.55,
    axisLabel: { show: false },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: {
      show: true,
      lineStyle: {
        color: 'rgba(56, 189, 248, 0.12)',
      },
    },
  },
  series: [
    {
      name: 'ecg-glow',
      type: 'line',
      data: signalData,
      smooth: 0.12,
      showSymbol: false,
      silent: true,
      lineStyle: {
        width: 8,
        color: 'rgba(34, 211, 238, 0.22)',
      },
      z: 1,
    },
    {
      name: 'ecg-main',
      type: 'line',
      data: signalData,
      smooth: 0.12,
      showSymbol: false,
      silent: true,
      lineStyle: {
        width: 2.3,
        color: '#22d3ee',
        shadowColor: 'rgba(34, 211, 238, 0.75)',
        shadowBlur: 12,
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(34, 211, 238, 0.2)' },
          { offset: 1, color: 'rgba(34, 211, 238, 0)' },
        ]),
      },
      z: 2,
    },
  ],
})

const updateChartSeries = (): void => {
  if (!chart) {
    return
  }

  chart.setOption({
    series: [{ data: signalData }, { data: signalData }],
  })
}

const handleResize = (): void => {
  chart?.resize()
}

const animate = (time: number): void => {
  if (!lastFrameTime) {
    lastFrameTime = time
  }

  const deltaMs = Math.min(80, time - lastFrameTime)
  lastFrameTime = time
  accumulatedMs += deltaMs

  let updated = false
  while (accumulatedMs >= SAMPLE_INTERVAL_MS) {
    accumulatedMs -= SAMPLE_INTERVAL_MS
    signalData.shift()
    signalData.push(generateEcgSample(SAMPLE_INTERVAL_MS / 1000))
    updated = true
  }

  if (updated) {
    updateChartSeries()
  }

  animationFrameId = requestAnimationFrame(animate)
}

onMounted(() => {
  if (!chartRef.value) {
    return
  }

  chart = echarts.init(chartRef.value, undefined, { renderer: 'canvas' })
  chart.setOption(buildOption())
  animationFrameId = requestAnimationFrame(animate)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  if (chart) {
    chart.dispose()
    chart = null
  }
})
</script>

<template>
  <section class="ecg-panel" aria-label="Virtual ECG monitor">
    <div class="ecg-meta">
      <p class="ecg-title">Virtual ECG</p>
      <p class="ecg-subtitle">Synthetic Signal</p>
      <span class="ecg-live-dot"></span>
    </div>
    <div ref="chartRef" class="ecg-chart"></div>
  </section>
</template>

<style scoped>
.ecg-panel {
  width: 100%;
  border-radius: 16px;
  border: 1px solid rgba(56, 189, 248, 0.35);
  background: linear-gradient(
    160deg,
    rgba(2, 6, 23, 0.78),
    rgba(2, 6, 23, 0.56)
  );
  box-shadow:
    0 18px 30px rgba(2, 6, 23, 0.5),
    inset 0 1px 0 rgba(226, 232, 240, 0.09);
  backdrop-filter: blur(12px);
  padding: 10px 12px 12px;
  pointer-events: none;
}

.ecg-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.ecg-title,
.ecg-subtitle {
  margin: 0;
}

.ecg-title {
  color: #f8fafc;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.ecg-subtitle {
  color: #94a3b8;
  font-size: 12px;
}

.ecg-live-dot {
  margin-left: auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #22d3ee;
  box-shadow: 0 0 0 5px rgba(34, 211, 238, 0.14);
}

.ecg-chart {
  width: 100%;
  height: 190px;
  border-radius: 12px;
  background-color: transparent;
}

@media (max-width: 640px) {
  .ecg-chart {
    height: 150px;
  }
}
</style>
