<script setup lang="ts">
import * as echarts from 'echarts'
import {
  Activity,
  AlertTriangle,
  Bluetooth,
  Clock3,
  Cpu,
  HeartPulse,
  LineChart,
  Radio,
  Sparkles,
  TimerReset,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useHeartBluetooth } from '../composables/useHeartBluetooth'
import { ThreeScene } from '../webgl/ThreeScene'

const {
  isSupported,
  needsSecureContext,
  isConnecting,
  isConnected,
  deviceName,
  statusMessage,
  currentBpm,
  currentRrMs,
  currentRrEstimated,
  latestAt,
  samples,
  connectWatch,
  disconnectWatch,
} = useHeartBluetooth()

const chartRef = ref<HTMLDivElement | null>(null)
const rrWaveChartRef = ref<HTMLDivElement | null>(null)
const heartViewportRef = ref<HTMLDivElement | null>(null)

let bpmChart: echarts.ECharts | null = null
let rrWaveChart: echarts.ECharts | null = null
let threeScene: ThreeScene | null = null

const recentSamples = computed(() => samples.value.slice(0, 4))

const rrDisplay = computed(() => {
  if (currentRrMs.value === null) {
    return '--'
  }
  return `${currentRrMs.value} ms`
})

const fabLabel = computed(() => {
  if (isConnecting.value) {
    return 'Connecting...'
  }
  if (isConnected.value) {
    return 'Disconnect Device'
  }
  return 'Connect Bluetooth Device'
})

const isFabDisabled = computed(() => {
  if (isConnected.value) {
    return false
  }
  return isConnecting.value || !isSupported || needsSecureContext
})

const connectionLabel = computed(() => {
  if (isConnecting.value) {
    return '连接中'
  }
  return isConnected.value ? '已连接' : '未连接'
})

const connectionClass = computed(() => {
  if (isConnecting.value) {
    return 'is-pending'
  }
  return isConnected.value ? 'is-connected' : 'is-disconnected'
})

const deviceLabel = computed(() => {
  if (isConnecting.value) {
    return 'Searching...'
  }
  if (isConnected.value && deviceName.value !== 'Not connected') {
    return deviceName.value
  }
  return 'No Device'
})

const SAMPLE_WINDOW_SIZE = 120
const ECG_POINT_COUNT = 60
const ECG_BASELINE = 0
const ECG_TICK_MS = 1000
const ECG_MAX_PENDING_SPIKES = 8

let ecgStreamData = Array.from({ length: ECG_POINT_COUNT }, () => ECG_BASELINE)
let ecgTimeAxis = Array.from({ length: ECG_POINT_COUNT }, () => '--:--:--')
let ecgPulseQueue: number[] = []
let ecgStreamTimer: number | null = null

const toRrMs = (bpm: number, rrMs: number | null): number =>
  rrMs ?? (bpm > 0 ? Math.round(60000 / bpm) : 0)

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const formatClockLabel = (timeMs: number): string =>
  new Date(timeMs).toLocaleTimeString('zh-CN', { hour12: false })

const syncInitialEcgTimeAxis = (): void => {
  const now = Date.now()
  ecgTimeAxis = Array.from({ length: ECG_POINT_COUNT }, (_, index) =>
    formatClockLabel(now - (ECG_POINT_COUNT - 1 - index) * ECG_TICK_MS),
  )
}

const buildPulsePeak = (rrMs: number | null): number => {
  const rr = rrMs && rrMs > 0 ? rrMs : 820
  const rrFactor = clamp(820 / rr, 0.78, 1.24)
  return Number((0.96 * rrFactor).toFixed(4))
}

const resetEcgBaseline = (): void => {
  ecgStreamData = Array.from({ length: ECG_POINT_COUNT }, () => ECG_BASELINE)
  syncInitialEcgTimeAxis()
}

const tickEcgStream = (): void => {
  const nextPoint = ecgPulseQueue.length
    ? (ecgPulseQueue.shift() ?? ECG_BASELINE)
    : ECG_BASELINE

  ecgStreamData = [...ecgStreamData.slice(1), Number(nextPoint.toFixed(4))]
  ecgTimeAxis = [...ecgTimeAxis.slice(1), formatClockLabel(Date.now())]
  renderChart()
}

const startEcgStream = (): void => {
  if (ecgStreamTimer !== null) {
    return
  }
  ecgStreamTimer = window.setInterval(tickEcgStream, ECG_TICK_MS)
}

const stopEcgStream = (): void => {
  if (ecgStreamTimer === null) {
    return
  }
  window.clearInterval(ecgStreamTimer)
  ecgStreamTimer = null
}

const enqueueEcgPulse = (rrMs: number | null): void => {
  ecgPulseQueue = [
    ...ecgPulseQueue.slice(-(ECG_MAX_PENDING_SPIKES - 1)),
    buildPulsePeak(rrMs),
  ]
}

const renderChart = (): void => {
  if (!chartRef.value || !rrWaveChartRef.value) {
    return
  }

  const noDataXData = Array.from(
    { length: SAMPLE_WINDOW_SIZE },
    (_, index) => `${index}`,
  )

  const noDataGraphic: echarts.EChartsOption['graphic'] = [
    {
      type: 'text',
      left: 'center',
      top: 'middle',
      silent: true,
      style: {
        text: 'Waiting for heart data...',
        fill: 'rgba(148, 163, 184, 0.72)',
        font: '500 13px "Segoe UI", sans-serif',
      },
    },
  ]

  if (!bpmChart) {
    bpmChart = echarts.init(chartRef.value)
  }
  if (!rrWaveChart) {
    rrWaveChart = echarts.init(rrWaveChartRef.value)
  }

  const trendSamples = [...samples.value].reverse().slice(-SAMPLE_WINDOW_SIZE)
  const hasRealSamples = trendSamples.length > 0

  bpmChart.setOption({
    animation: false,
    backgroundColor: 'transparent',
    graphic: [],
    grid: { left: 14, right: 12, top: 18, bottom: 18 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ecgTimeAxis,
      axisLabel: {
        show: true,
        color: 'rgba(148, 163, 184, 0.7)',
        fontSize: 10,
        interval: 9,
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.2)' } },
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(34, 211, 238, 0.12)' },
      },
    },
    yAxis: {
      type: 'value',
      min: -0.58,
      max: 1.4,
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(34, 211, 238, 0.08)' },
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(2, 6, 23, 0.9)',
      borderColor: 'rgba(56, 189, 248, 0.32)',
      textStyle: { color: '#e2e8f0' },
    },
    series: [
      {
        name: 'ECG Glow',
        type: 'line',
        smooth: false,
        showSymbol: false,
        lineStyle: {
          width: 7,
          color: 'rgba(34, 211, 238, 0.2)',
        },
        data: ecgStreamData,
        silent: true,
        z: 1,
      },
      {
        name: 'Lead II',
        type: 'line',
        smooth: false,
        showSymbol: false,
        lineStyle: {
          width: 2.2,
          color: '#22d3ee',
          shadowColor: 'rgba(34, 211, 238, 0.7)',
          shadowBlur: 14,
        },
        itemStyle: { color: '#f472b6' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(34, 211, 238, 0.2)' },
            { offset: 1, color: 'rgba(34, 211, 238, 0.01)' },
          ]),
        },
        data: ecgStreamData,
        z: 2,
      },
    ],
  })

  if (!hasRealSamples) {
    rrWaveChart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      graphic: noDataGraphic,
      grid: { left: 12, right: 12, top: 18, bottom: 16 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: noDataXData,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.14)' } },
        splitLine: {
          show: true,
          lineStyle: { color: 'rgba(34, 211, 238, 0.07)' },
        },
      },
      yAxis: {
        type: 'value',
        min: -120,
        max: 120,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: {
          show: true,
          lineStyle: { color: 'rgba(244, 114, 182, 0.08)' },
        },
      },
      series: [
        {
          name: 'RR Wave Glow',
          type: 'line',
          smooth: 0.24,
          showSymbol: false,
          lineStyle: { width: 7, color: 'rgba(34, 211, 238, 0.18)' },
          data: [],
          silent: true,
          z: 1,
        },
        {
          name: 'RR Wave',
          type: 'line',
          smooth: 0.24,
          showSymbol: false,
          lineStyle: { width: 2.1, color: '#f472b6' },
          data: [],
          z: 2,
        },
      ],
    })
    return
  }

  const xData = trendSamples.map((sample) => sample.timeLabel)
  const rrRaw = trendSamples.map((sample) => toRrMs(sample.bpm, sample.rrMs))
  const rrBaseline =
    rrRaw.reduce((sum, value) => sum + value, 0) / Math.max(1, rrRaw.length)
  const rrWaveData = rrRaw.map((value) =>
    Number((value - rrBaseline).toFixed(1)),
  )
  const rrAbsMax = Math.max(20, ...rrWaveData.map((value) => Math.abs(value)))

  rrWaveChart.setOption({
    animation: false,
    backgroundColor: 'transparent',
    graphic: [],
    grid: { left: 12, right: 12, top: 18, bottom: 16 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xData,
      axisLabel: {
        show: true,
        color: 'rgba(148, 163, 184, 0.68)',
        fontSize: 10,
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.14)' } },
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(34, 211, 238, 0.07)' },
      },
    },
    yAxis: {
      type: 'value',
      min: -Math.ceil(rrAbsMax * 1.2),
      max: Math.ceil(rrAbsMax * 1.2),
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(244, 114, 182, 0.08)' },
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(2, 6, 23, 0.9)',
      borderColor: 'rgba(244, 114, 182, 0.32)',
      textStyle: { color: '#e2e8f0' },
    },
    series: [
      {
        name: 'RR Wave Glow',
        type: 'line',
        smooth: 0.24,
        showSymbol: false,
        lineStyle: {
          width: 7,
          color: 'rgba(34, 211, 238, 0.18)',
        },
        data: rrWaveData,
        silent: true,
        z: 1,
      },
      {
        name: 'RR Wave',
        type: 'line',
        smooth: 0.24,
        showSymbol: false,
        lineStyle: {
          width: 2.1,
          color: '#f472b6',
          shadowColor: 'rgba(244, 114, 182, 0.55)',
          shadowBlur: 12,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(34, 211, 238, 0.2)' },
            { offset: 1, color: 'rgba(34, 211, 238, 0.01)' },
          ]),
        },
        data: rrWaveData,
        z: 2,
      },
    ],
  })
}

const handleResize = (): void => {
  bpmChart?.resize()
  rrWaveChart?.resize()
}

const handleFabClick = async (): Promise<void> => {
  if (isConnected.value) {
    await disconnectWatch()
    return
  }
  await connectWatch()
}

onMounted(() => {
  resetEcgBaseline()
  startEcgStream()
  renderChart()
  window.addEventListener('resize', handleResize)
  if (heartViewportRef.value) {
    threeScene = new ThreeScene(heartViewportRef.value)
  }
})

watch(samples, () => {
  const latestSample = samples.value[0]
  if (latestSample) {
    enqueueEcgPulse(toRrMs(latestSample.bpm, latestSample.rrMs))
  }
  renderChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  stopEcgStream()
  ecgPulseQueue = []
  if (bpmChart) {
    bpmChart.dispose()
    bpmChart = null
  }
  if (rrWaveChart) {
    rrWaveChart.dispose()
    rrWaveChart = null
  }
  if (threeScene) {
    threeScene.destroy()
    threeScene = null
  }
})
</script>

<template>
  <section class="dashboard">
    <header class="page-top">
      <div class="brand">
        <div class="brand-icon-shell">
          <Activity class="brand-icon" />
        </div>
        <div class="brand-copy">
          <p class="brand-title">CARDIOVIS</p>
          <p class="brand-subtitle">实时心率监测</p>
        </div>
      </div>

      <div class="status-group">
        <div class="chip status-chip" :class="connectionClass">
          <span class="chip-dot"></span>
          <span>{{ connectionLabel }}</span>
        </div>
        <div class="chip device-chip">
          <Radio class="chip-icon" />
          <span class="chip-text">{{ deviceLabel }}</span>
        </div>
      </div>
    </header>

    <div class="hero-grid">
      <article class="glass heart-panel">
        <div class="panel-head">
          <p class="panel-kicker">
            <Sparkles class="label-icon" />
            <span>Pulse Core</span>
          </p>
          <p class="panel-title">3D Heart Field</p>
        </div>
        <div ref="heartViewportRef" class="heart-viewport"></div>
        <p class="panel-footnote">
          <Radio class="helper-icon" />
          <span>Click heart to trigger radial ripples.</span>
        </p>
      </article>

      <div class="metrics-column">
        <article class="glass metric bpm-card">
          <p class="metric-label">
            <HeartPulse class="label-icon" />
            <span>LIVE HEART RATE</span>
          </p>
          <div class="bpm-shell" :class="{ 'is-live': currentBpm !== null }">
            <span class="bpm-value">{{ currentBpm ?? '--' }}</span>
            <span class="bpm-unit">BPM</span>
          </div>
          <p class="metric-helper">
            <Activity class="helper-icon" />
            <span>{{ statusMessage }}</span>
          </p>
        </article>

        <article class="glass metric">
          <p class="metric-label">
            <TimerReset class="label-icon" />
            <span>RR INTERVAL</span>
          </p>
          <p class="metric-value">
            {{ rrDisplay }}
            <span v-if="currentRrEstimated" class="estimated-tag">estimated</span>
          </p>
          <p class="metric-helper">
            <Clock3 class="helper-icon" />
            <span>Last update: {{ latestAt || '--' }}</span>
          </p>
        </article>

        <article class="glass metric">
          <p class="metric-label">
            <Cpu class="label-icon" />
            <span>DEVICE</span>
          </p>
          <p class="metric-value">{{ deviceName }}</p>
          <ul class="mini-feed">
            <li v-for="sample in recentSamples" :key="sample.timeMs">
              <span>{{ sample.timeLabel }}</span>
              <span>{{ sample.bpm }} bpm</span>
            </li>
            <li v-if="!recentSamples.length" class="empty-row">No samples yet</li>
          </ul>
        </article>
      </div>
    </div>

    <article class="glass trend-panel">
      <div class="trend-grid">
        <div class="trend-card">
          <div class="trend-head">
            <p class="trend-title">
              <LineChart class="title-icon" />
              <span>ECG Waveform</span>
            </p>
            <p class="trend-subtitle">1s rolling timeline, heartbeat-triggered spike</p>
          </div>
          <div ref="chartRef" class="trend-chart"></div>
        </div>
        <div class="trend-card">
          <div class="trend-head">
            <p class="trend-title">
              <Activity class="title-icon is-pink" />
              <span>RR Variability Wave</span>
            </p>
            <p class="trend-subtitle">Beat-to-beat interval waveform</p>
          </div>
          <div ref="rrWaveChartRef" class="trend-chart"></div>
        </div>
      </div>
    </article>

    <p v-if="needsSecureContext" class="alert">
      <AlertTriangle class="alert-icon" />
      Bluetooth requires secure context (HTTPS or localhost).
    </p>
    <p v-if="!isSupported" class="alert">
      <AlertTriangle class="alert-icon" />
      This browser does not support Web Bluetooth.
    </p>

    <button class="fab-connect" :disabled="isFabDisabled" @click="handleFabClick">
      <Bluetooth class="fab-icon" />
      <span>{{ fabLabel }}</span>
    </button>
  </section>
</template>

<style scoped>
.dashboard {
  position: relative;
  display: grid;
  gap: 10px;
  padding-bottom: 74px;
}

.page-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 4px 2px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.brand-icon-shell {
  width: 50px;
  height: 50px;
  border-radius: 14px;
  border: 1px solid rgba(34, 211, 238, 0.33);
  background: radial-gradient(
    circle at 35% 35%,
    rgba(34, 211, 238, 0.2),
    rgba(8, 47, 73, 0.5)
  );
  display: grid;
  place-items: center;
  box-shadow: inset 0 0 18px rgba(34, 211, 238, 0.13);
}

.brand-icon {
  width: 24px;
  height: 24px;
  color: #22d3ee;
  stroke-width: 2.3;
}

.brand-copy {
  display: grid;
  gap: 2px;
}

.brand-title,
.brand-subtitle {
  margin: 0;
}

.brand-title {
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.brand-subtitle {
  color: #94a3b8;
  font-size: 12px;
  letter-spacing: 0.05em;
}

.status-group {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  flex-shrink: 0;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid rgba(34, 211, 238, 0.26);
  background: rgba(2, 6, 23, 0.72);
  box-shadow:
    0 10px 20px rgba(2, 6, 23, 0.38),
    inset 0 1px 0 rgba(226, 232, 240, 0.05);
  color: #cbd5e1;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.status-chip.is-connected {
  color: #86efac;
}

.status-chip.is-pending {
  color: #fde68a;
}

.status-chip.is-disconnected {
  color: #94a3b8;
}

.chip-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 22%, transparent);
}

.chip-icon {
  width: 16px;
  height: 16px;
  color: #22d3ee;
  stroke-width: 2.2;
}

.chip-text {
  max-width: 34vw;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1.95fr) minmax(0, 0.72fr);
}

.glass {
  border: 1px solid rgba(56, 189, 248, 0.24);
  border-radius: 16px;
  background: linear-gradient(
    160deg,
    rgba(2, 6, 23, 0.76),
    rgba(15, 23, 42, 0.5)
  );
  box-shadow:
    0 22px 30px rgba(2, 6, 23, 0.46),
    inset 0 1px 0 rgba(226, 232, 240, 0.07);
  backdrop-filter: blur(14px);
}

.heart-panel {
  padding: 18px;
  display: grid;
  gap: 12px;
}

.panel-head {
  display: grid;
  gap: 2px;
}

.panel-kicker {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #f472b6;
  font-size: 12px;
  letter-spacing: 0.1em;
}

.panel-title {
  margin: 0;
  color: #e2e8f0;
  font-size: 22px;
  font-weight: 700;
}

.heart-viewport {
  width: 100%;
  aspect-ratio: 1.35 / 1;
  min-height: 340px;
  border-radius: 12px;
  border: 1px solid rgba(34, 211, 238, 0.28);
  background: radial-gradient(circle at 50% 35%, rgba(15, 23, 42, 0.62), rgba(2, 6, 23, 0.92));
  overflow: hidden;
}

.panel-footnote {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #93c5fd;
  font-size: 12px;
}

.metrics-column {
  display: grid;
  gap: 8px;
}

.metric {
  padding: 10px;
  display: grid;
  gap: 6px;
}

.metric-label {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  letter-spacing: 0.11em;
  color: #67e8f9;
}

.metric-value {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  color: #e2e8f0;
}

.metric-helper {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #94a3b8;
}

.label-icon {
  width: 14px;
  height: 14px;
  stroke-width: 2.1;
}

.helper-icon {
  width: 13px;
  height: 13px;
  stroke-width: 2.1;
}

.bpm-card {
  gap: 10px;
}

.bpm-shell {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  width: fit-content;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(244, 114, 182, 0.36);
  background: radial-gradient(circle at 50% 50%, rgba(244, 114, 182, 0.22), rgba(244, 114, 182, 0.05));
}

.bpm-shell.is-live {
  animation: bpmPulse 1.1s ease-in-out infinite;
}

.bpm-value {
  font-size: 44px;
  font-weight: 800;
  line-height: 1;
  color: #f8fafc;
}

.bpm-unit {
  font-size: 12px;
  color: #67e8f9;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.estimated-tag {
  margin-left: 6px;
  font-size: 11px;
  color: #f9a8d4;
  letter-spacing: 0.03em;
}

.mini-feed {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}

.mini-feed li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #cbd5e1;
  font-size: 12px;
}

.empty-row {
  color: #64748b;
}

.trend-panel {
  padding: 10px 12px;
  display: grid;
  gap: 8px;
}

.trend-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr);
}

.trend-card {
  border: 1px solid rgba(56, 189, 248, 0.16);
  border-radius: 12px;
  padding: 8px;
  background: rgba(2, 6, 23, 0.32);
}

.trend-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.trend-title {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #e2e8f0;
  font-weight: 700;
}

.title-icon {
  width: 16px;
  height: 16px;
  color: #22d3ee;
}

.title-icon.is-pink {
  color: #f472b6;
}

.trend-subtitle {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
}

.trend-chart {
  width: 100%;
  height: 146px;
  border-radius: 12px;
  border: 1px solid rgba(34, 211, 238, 0.22);
  background: rgba(2, 6, 23, 0.32);
}

.alert {
  margin: 0;
  padding: 9px 12px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 10px;
  border: 1px solid rgba(244, 114, 182, 0.34);
  background: rgba(157, 23, 77, 0.2);
  color: #fbcfe8;
  font-size: 13px;
}

.alert-icon {
  width: 14px;
  height: 14px;
}

.fab-connect {
  position: fixed;
  right: 24px;
  bottom: 26px;
  z-index: 28;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 999px;
  padding: 14px 20px;
  font: inherit;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #031526;
  background: linear-gradient(135deg, #22d3ee 0%, #f472b6 100%);
  box-shadow:
    0 16px 28px rgba(6, 182, 212, 0.35),
    0 8px 20px rgba(244, 114, 182, 0.25);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    filter 0.2s ease,
    opacity 0.2s ease;
}

.fab-icon {
  width: 17px;
  height: 17px;
  stroke-width: 2.3;
}

.fab-connect:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.04);
}

.fab-connect:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@keyframes bpmPulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(244, 114, 182, 0.38);
  }
  70% {
    transform: scale(1.03);
    box-shadow: 0 0 0 12px rgba(244, 114, 182, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(244, 114, 182, 0);
  }
}

@media (max-width: 980px) {
  .page-top {
    flex-wrap: wrap;
  }

  .hero-grid {
    grid-template-columns: 1fr;
  }

  .trend-grid {
    grid-template-columns: 1fr;
  }

  .heart-viewport {
    min-height: 260px;
  }
}

@media (max-width: 640px) {
  .brand-icon-shell {
    width: 42px;
    height: 42px;
    border-radius: 12px;
  }

  .brand-title {
    font-size: 14px;
  }

  .brand-subtitle {
    font-size: 11px;
  }

  .chip {
    min-height: 38px;
    padding: 8px 12px;
    font-size: 12px;
  }

  .device-chip {
    display: none;
  }

  .trend-chart {
    height: 170px;
  }

  .bpm-value {
    font-size: 40px;
  }

  .fab-connect {
    right: 14px;
    bottom: 14px;
    padding: 12px 16px;
    font-size: 14px;
  }
}
</style>
