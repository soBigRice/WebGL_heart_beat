<script setup lang="ts">
import * as echarts from 'echarts'
import {
  Activity,
  AlertTriangle,
  Bluetooth,
  Cpu,
  HeartPulse,
  LineChart,
  Maximize2,
  Minimize2,
  Radio,
  Sparkles,
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
  samples,
  connectWatch,
  disconnectWatch,
} = useHeartBluetooth()

const chartRef = ref<HTMLDivElement | null>(null)
const heartViewportRef = ref<HTMLDivElement | null>(null)
const visualStageRef = ref<HTMLElement | null>(null)

let bpmChart: echarts.ECharts | null = null
let threeScene: ThreeScene | null = null

const locale = ref<'zh' | 'en'>('zh')
const messages = {
  zh: {
    connecting: '连接中...',
    disconnectDevice: '断开设备',
    connectDevice: '连接蓝牙设备',
    connectionConnecting: '连接中',
    connectionConnected: '已连接',
    connectionDisconnected: '未连接',
    searching: '搜索中...',
    noDevice: '无设备',
    fullscreenEnter: '全屏',
    fullscreenExit: '退出全屏',
    waitingHeartData: '等待心跳数据...',
    brandSubtitle: '实时心率监测',
    pulseCore: '脉冲核心',
    heartField: '3D 心脏可视化',
    clickHeartRipple: '点击爱心触发径向波纹。',
    ecgWaveform: '心电波形',
    ecgSubtitle: '来自蓝牙真实心跳事件',
    ecgAxisName: '振幅',
    ecgAxisUnit: '级',
    liveHeartRate: '实时心率',
    bpm: 'BPM',
    healthyRange: '健康参考（静息成人）',
    healthyRangeValue: '60-100 BPM',
    currentReading: '当前读数',
    zoneUnknown: '未检测',
    zoneLow: '偏低',
    zoneNormal: '正常',
    zoneElevated: '偏高',
    zoneHigh: '过高',
    rangeLow: '<60',
    rangeNormal: '60-100',
    rangeElevated: '101-120',
    rangeHigh: '>120',
    device: '设备',
    noSamplesYet: '暂无样本',
    secureAlert: '蓝牙需要安全上下文（HTTPS 或 localhost）。',
    unsupportedAlert: '当前浏览器不支持 Web Bluetooth。',
    aboutBtn: '关于',
    close: '关闭',
    aboutTitle: '关于 CARDIOVIS',
    aboutIntro: '实时心率可视化 Web 项目，提供蓝牙连接、3D 心脏交互与心电风格波形展示。',
    aboutGoalTitle: '项目目标',
    aboutGoalBody: '在浏览器中快速验证设备联通、实时展示与交互体验。',
    aboutAbilityTitle: '核心能力',
    aboutAbility1: 'Web Bluetooth 连接设备',
    aboutAbility2: '实时 BPM 与健康区间提示',
    aboutAbility3: '3D 心脏节律跳动和点击波纹',
    aboutAbility4: '实时 ECG 风格波形',
    aboutTechTitle: '技术栈',
    aboutDataTitle: '数据说明',
    aboutDataBody:
      '页面只处理实时广播数据，不包含云端上传。生产环境请补充权限与合规策略。本应用内容仅供娱乐参考，具体实际情况请遵循专业医疗人士建议。',
    aboutAuthorTitle: '作者信息',
    aboutAuthorBody: '作者：soBigRice。欢迎访问个人主页了解项目更新与更多开源实践。',
    aboutAuthorLinkLabel: 'GitHub 主页',
    switchToEnglish: 'EN',
    switchToChinese: '中文',
    switchLocaleAriaZh: '切换为中文',
    switchLocaleAriaEn: 'Switch to English',
    statusReady: '准备连接。',
    statusRequesting: '正在请求蓝牙设备...',
    statusConnectingGatt: '正在连接 GATT 服务...',
    statusWaitingData: '已连接，等待心率数据...',
    statusAlreadyConnected: '设备已连接。',
    statusDisconnected: '已断开连接。',
    statusDeviceDisconnected: '设备已断开。',
  },
  en: {
    connecting: 'Connecting...',
    disconnectDevice: 'Disconnect Device',
    connectDevice: 'Connect Bluetooth Device',
    connectionConnecting: 'Connecting',
    connectionConnected: 'Connected',
    connectionDisconnected: 'Disconnected',
    searching: 'Searching...',
    noDevice: 'No Device',
    fullscreenEnter: 'Fullscreen',
    fullscreenExit: 'Exit Fullscreen',
    waitingHeartData: 'Waiting for heart data...',
    brandSubtitle: 'Real-time Heart Monitoring',
    pulseCore: 'Pulse Core',
    heartField: '3D Heart Field',
    clickHeartRipple: 'Click heart to trigger radial ripples.',
    ecgWaveform: 'ECG Waveform',
    ecgSubtitle: 'Real heartbeat events from Bluetooth data',
    ecgAxisName: 'Amplitude',
    ecgAxisUnit: '',
    liveHeartRate: 'LIVE HEART RATE',
    bpm: 'BPM',
    healthyRange: 'Healthy range (resting adult)',
    healthyRangeValue: '60-100 BPM',
    currentReading: 'Current reading',
    zoneUnknown: 'No reading',
    zoneLow: 'Low',
    zoneNormal: 'Normal',
    zoneElevated: 'Elevated',
    zoneHigh: 'High',
    rangeLow: '<60',
    rangeNormal: '60-100',
    rangeElevated: '101-120',
    rangeHigh: '>120',
    device: 'DEVICE',
    noSamplesYet: 'No samples yet',
    secureAlert: 'Bluetooth requires secure context (HTTPS or localhost).',
    unsupportedAlert: 'This browser does not support Web Bluetooth.',
    aboutBtn: 'About',
    close: 'Close',
    aboutTitle: 'About CARDIOVIS',
    aboutIntro: 'A real-time heart-rate visualization web app with Bluetooth connectivity, 3D heart interaction, and ECG-style waveform rendering.',
    aboutGoalTitle: 'Goal',
    aboutGoalBody: 'Quickly validate device connectivity, real-time rendering, and interaction experience in browser.',
    aboutAbilityTitle: 'Capabilities',
    aboutAbility1: 'Web Bluetooth device connection',
    aboutAbility2: 'Live BPM with health range hints',
    aboutAbility3: '3D heart rhythmic pulse and click ripple',
    aboutAbility4: 'Realtime ECG-style waveform',
    aboutTechTitle: 'Tech Stack',
    aboutDataTitle: 'Data Notes',
    aboutDataBody:
      'The page processes live broadcast data only. No cloud upload is included. For entertainment/reference only, and real medical decisions should follow professional healthcare advice.',
    aboutAuthorTitle: 'Author',
    aboutAuthorBody: 'Created by soBigRice. Visit the profile for project updates and open-source work.',
    aboutAuthorLinkLabel: 'GitHub Profile',
    switchToEnglish: 'EN',
    switchToChinese: '中文',
    switchLocaleAriaZh: '切换为中文',
    switchLocaleAriaEn: 'Switch to English',
    statusReady: 'Ready to connect.',
    statusRequesting: 'Requesting Bluetooth device...',
    statusConnectingGatt: 'Connecting GATT server...',
    statusWaitingData: 'Connected. Waiting for heart rate data...',
    statusAlreadyConnected: 'Already connected.',
    statusDisconnected: 'Disconnected.',
    statusDeviceDisconnected: 'Device disconnected.',
  },
} as const

type I18nKey = keyof typeof messages.zh

const t = (key: I18nKey): string => messages[locale.value][key]

const toggleLocale = (): void => {
  locale.value = locale.value === 'zh' ? 'en' : 'zh'
  renderChart()
}

const localeToggleLabel = computed(() =>
  locale.value === 'zh' ? t('switchToEnglish') : t('switchToChinese'),
)
const localeToggleAria = computed(() =>
  locale.value === 'zh' ? t('switchLocaleAriaEn') : t('switchLocaleAriaZh'),
)

const recentSamples = computed(() => samples.value.slice(0, 4))
const aboutTechTags = ['Vue 3', 'TypeScript', 'Vite', 'Three.js', 'ECharts', 'Web Bluetooth']
const authorProfileUrl = 'https://github.com/soBigRice'
const aboutAbilities = computed(() => [
  t('aboutAbility1'),
  t('aboutAbility2'),
  t('aboutAbility3'),
  t('aboutAbility4'),
])
const isAboutModalOpen = ref(false)

const openAboutModal = (): void => {
  isAboutModalOpen.value = true
}

const closeAboutModal = (): void => {
  isAboutModalOpen.value = false
}

const bpmZone = computed(() => {
  const bpm = currentBpm.value
  if (bpm === null) {
    return {
      className: 'zone-unknown',
      label: t('zoneUnknown'),
      rangeLabel: '--',
    }
  }
  if (bpm < 60) {
    return {
      className: 'zone-low',
      label: t('zoneLow'),
      rangeLabel: t('rangeLow'),
    }
  }
  if (bpm <= 100) {
    return {
      className: 'zone-normal',
      label: t('zoneNormal'),
      rangeLabel: t('rangeNormal'),
    }
  }
  if (bpm <= 120) {
    return {
      className: 'zone-elevated',
      label: t('zoneElevated'),
      rangeLabel: t('rangeElevated'),
    }
  }
  return {
    className: 'zone-high',
    label: t('zoneHigh'),
    rangeLabel: t('rangeHigh'),
  }
})

const bpmInsight = computed(() => {
  const bpm = currentBpm.value
  if (bpm === null) {
    return `${t('currentReading')}: --`
  }
  return `${t('currentReading')}: ${bpm} ${t('bpm')} · ${bpmZone.value.label} (${bpmZone.value.rangeLabel} ${t('bpm')})`
})

const fabLabel = computed(() => {
  if (isConnecting.value) {
    return t('connecting')
  }
  if (isConnected.value) {
    return t('disconnectDevice')
  }
  return t('connectDevice')
})

const isFabDisabled = computed(() => {
  if (isConnected.value) {
    return false
  }
  return isConnecting.value || !isSupported || needsSecureContext
})

const connectionLabel = computed(() => {
  if (isConnecting.value) {
    return t('connectionConnecting')
  }
  return isConnected.value ? t('connectionConnected') : t('connectionDisconnected')
})

const connectionClass = computed(() => {
  if (isConnecting.value) {
    return 'is-pending'
  }
  return isConnected.value ? 'is-connected' : 'is-disconnected'
})

const deviceLabel = computed(() => {
  if (isConnecting.value) {
    return t('searching')
  }
  if (isConnected.value && deviceName.value !== 'Not connected') {
    return deviceName.value
  }
  return t('noDevice')
})

const isVisualFullscreen = ref(false)
const fullscreenLabel = computed(() =>
  isVisualFullscreen.value ? t('fullscreenExit') : t('fullscreenEnter'),
)

const localizedStatusMessage = computed(() => {
  const raw = statusMessage.value
  if (raw === 'Ready to connect.') return t('statusReady')
  if (raw === 'Requesting Bluetooth device...') return t('statusRequesting')
  if (raw === 'Connecting GATT server...') return t('statusConnectingGatt')
  if (raw === 'Connected. Waiting for heart rate data...') return t('statusWaitingData')
  if (raw === 'Already connected.') return t('statusAlreadyConnected')
  if (raw === 'Disconnected.') return t('statusDisconnected')
  if (raw === 'Device disconnected.') return t('statusDeviceDisconnected')
  return raw
})

const SAMPLE_WINDOW_SIZE = 120

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const toEcgPeak = (bpm: number, rrMs: number | null): number => {
  const rrFactor =
    rrMs && rrMs > 0 ? clamp(820 / rrMs, 0.78, 1.24) : 1
  const bpmFactor = clamp((bpm || 70) / 75, 0.72, 1.22)
  return Number((rrFactor * 0.7 + bpmFactor * 0.3).toFixed(4))
}

const renderChart = (): void => {
  if (!chartRef.value) {
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
        text: t('waitingHeartData'),
        fill: 'rgba(148, 163, 184, 0.72)',
        font: '500 13px "Segoe UI", sans-serif',
      },
    },
  ]

  const ecgAxisLabelFormatter = (value: number): string => {
    if (locale.value === 'zh') {
      return `${value.toFixed(1)}${t('ecgAxisUnit')}`
    }
    return value.toFixed(1)
  }

  if (!bpmChart) {
    bpmChart = echarts.init(chartRef.value)
  }

  const trendSamples = [...samples.value].reverse().slice(-SAMPLE_WINDOW_SIZE)
  const hasRealSamples = trendSamples.length > 0

  if (!hasRealSamples) {
    bpmChart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      graphic: noDataGraphic,
      grid: { left: 44, right: 12, top: 18, bottom: 18 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: noDataXData,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.2)' } },
        splitLine: {
          show: true,
          lineStyle: { color: 'rgba(34, 211, 238, 0.12)' },
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 1.4,
        splitNumber: 4,
        name: t('ecgAxisName'),
        nameLocation: 'middle',
        nameGap: 34,
        nameTextStyle: {
          color: 'rgba(125, 211, 252, 0.8)',
          fontSize: 10,
        },
        axisLabel: {
          show: true,
          color: 'rgba(148, 163, 184, 0.76)',
          fontSize: 10,
          formatter: ecgAxisLabelFormatter,
        },
        axisTick: {
          show: true,
          length: 3,
          lineStyle: { color: 'rgba(148, 163, 184, 0.28)' },
        },
        axisLine: {
          show: true,
          lineStyle: { color: 'rgba(148, 163, 184, 0.2)' },
        },
        splitLine: {
          show: true,
          lineStyle: { color: 'rgba(34, 211, 238, 0.08)' },
        },
      },
      series: [
        {
          name: 'ECG Glow',
          type: 'line',
          smooth: false,
          showSymbol: false,
          lineStyle: { width: 7, color: 'rgba(34, 211, 238, 0.2)' },
          data: [],
          silent: true,
          z: 1,
        },
        {
          name: 'Lead II',
          type: 'line',
          smooth: false,
          showSymbol: false,
          lineStyle: { width: 2.2, color: '#22d3ee' },
          data: [],
          z: 2,
        },
      ],
    })
    return
  }

  const ecgXData: string[] = []
  const ecgData: number[] = []
  trendSamples.forEach((sample) => {
    const peak = toEcgPeak(sample.bpm, sample.rrMs)
    ecgXData.push(sample.timeLabel, '', '')
    ecgData.push(0, peak, 0)
  })

  bpmChart.setOption({
    animation: false,
    backgroundColor: 'transparent',
    graphic: [],
    grid: { left: 44, right: 12, top: 18, bottom: 18 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ecgXData,
      axisLabel: {
        show: true,
        color: 'rgba(148, 163, 184, 0.7)',
        fontSize: 10,
        formatter: (value: string) => value,
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
      min: 0,
      max: 1.4,
      splitNumber: 4,
      name: t('ecgAxisName'),
      nameLocation: 'middle',
      nameGap: 34,
      nameTextStyle: {
        color: 'rgba(125, 211, 252, 0.8)',
        fontSize: 10,
      },
      axisLabel: {
        show: true,
        color: 'rgba(148, 163, 184, 0.76)',
        fontSize: 10,
        formatter: ecgAxisLabelFormatter,
      },
      axisTick: {
        show: true,
        length: 3,
        lineStyle: { color: 'rgba(148, 163, 184, 0.28)' },
      },
      axisLine: {
        show: true,
        lineStyle: { color: 'rgba(148, 163, 184, 0.2)' },
      },
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
        data: ecgData,
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
        data: ecgData,
        z: 2,
      },
    ],
  })
}

const handleResize = (): void => {
  bpmChart?.resize()
}

const syncFullscreenState = (): void => {
  isVisualFullscreen.value = document.fullscreenElement === visualStageRef.value
  window.setTimeout(() => {
    handleResize()
    window.dispatchEvent(new Event('resize'))
  }, 50)
}

const toggleVisualFullscreen = async (): Promise<void> => {
  const target = visualStageRef.value
  if (!target) {
    return
  }

  try {
    if (document.fullscreenElement === target) {
      await document.exitFullscreen()
      return
    }
    await target.requestFullscreen()
  } catch {
    // Ignore fullscreen rejection when browser blocks the request.
  }
}

const handleFabClick = async (): Promise<void> => {
  if (isConnected.value) {
    await disconnectWatch()
    return
  }
  await connectWatch()
}

const handleWindowKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && isAboutModalOpen.value) {
    closeAboutModal()
  }
}

onMounted(() => {
  renderChart()
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleWindowKeydown)
  document.addEventListener('fullscreenchange', syncFullscreenState)
  if (heartViewportRef.value) {
    threeScene = new ThreeScene(heartViewportRef.value)
    threeScene.setPulseEnabled(isConnected.value)
  }
})

watch(samples, () => {
  const latestSample = samples.value[0]
  if (latestSample && threeScene) {
    threeScene.triggerHeartbeat(latestSample.bpm, latestSample.rrMs)
  }
  renderChart()
})

watch(isConnected, (connected) => {
  threeScene?.setPulseEnabled(connected)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleWindowKeydown)
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  if (document.fullscreenElement === visualStageRef.value) {
    void document.exitFullscreen().catch(() => undefined)
  }
  if (bpmChart) {
    bpmChart.dispose()
    bpmChart = null
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
          <p class="brand-subtitle">{{ t('brandSubtitle') }}</p>
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
        <button
          class="chip lang-chip"
          type="button"
          :aria-label="localeToggleAria"
          @click="toggleLocale"
        >
          {{ localeToggleLabel }}
        </button>
        <button
          class="chip about-chip"
          type="button"
          :aria-label="t('aboutBtn')"
          @click="openAboutModal"
        >
          {{ t('aboutBtn') }}
        </button>
      </div>
    </header>

    <div class="hero-grid" :class="{ 'is-visual-fullscreen': isVisualFullscreen }">
      <section
        ref="visualStageRef"
        class="visual-stage"
        :class="{ 'is-fullscreen': isVisualFullscreen }"
      >
        <article class="glass heart-panel">
          <div class="panel-head-row">
            <div class="panel-head">
              <p class="panel-kicker">
                <Sparkles class="label-icon" />
                <span>{{ t('pulseCore') }}</span>
              </p>
              <p class="panel-title">{{ t('heartField') }}</p>
            </div>
            <button
              class="fullscreen-btn"
              type="button"
              :aria-label="fullscreenLabel"
              @click="toggleVisualFullscreen"
            >
              <Minimize2 v-if="isVisualFullscreen" class="fullscreen-icon" />
              <Maximize2 v-else class="fullscreen-icon" />
              <span>{{ fullscreenLabel }}</span>
            </button>
          </div>
          <div ref="heartViewportRef" class="heart-viewport"></div>
          <p class="panel-footnote">
            <Radio class="helper-icon" />
            <span>{{ t('clickHeartRipple') }}</span>
          </p>
        </article>

        <article class="glass trend-panel">
          <div class="trend-grid">
            <div class="trend-card">
              <div class="trend-head">
                <p class="trend-title">
                  <LineChart class="title-icon" />
                  <span>{{ t('ecgWaveform') }}</span>
                </p>
                <p class="trend-subtitle">{{ t('ecgSubtitle') }}</p>
              </div>
              <div ref="chartRef" class="trend-chart"></div>
            </div>
          </div>
        </article>
      </section>

      <div v-if="!isVisualFullscreen" class="metrics-column">
        <article class="glass metric bpm-card">
          <div class="bpm-head">
            <p class="metric-label">
              <HeartPulse class="label-icon" />
              <span>{{ t('liveHeartRate') }}</span>
            </p>
            <span class="zone-pill" :class="bpmZone.className">
              {{ bpmZone.label }} {{ bpmZone.rangeLabel }}
            </span>
          </div>
          <div class="bpm-shell" :class="[bpmZone.className, { 'is-live': currentBpm !== null }]">
            <span class="bpm-value">{{ currentBpm ?? '--' }}</span>
            <span class="bpm-unit">{{ t('bpm') }}</span>
          </div>
          <p class="range-note">{{ t('healthyRange') }}: {{ t('healthyRangeValue') }}</p>
          <p class="range-current">{{ bpmInsight }}</p>
          <div class="range-legend">
            <span class="range-chip zone-low">{{ t('zoneLow') }} {{ t('rangeLow') }}</span>
            <span class="range-chip zone-normal">{{ t('zoneNormal') }} {{ t('rangeNormal') }}</span>
            <span class="range-chip zone-elevated">{{ t('zoneElevated') }} {{ t('rangeElevated') }}</span>
            <span class="range-chip zone-high">{{ t('zoneHigh') }} {{ t('rangeHigh') }}</span>
          </div>
          <p class="metric-helper">
            <Activity class="helper-icon" />
            <span>{{ localizedStatusMessage }}</span>
          </p>
        </article>

        <article class="glass metric">
          <p class="metric-label">
            <Cpu class="label-icon" />
            <span>{{ t('device') }}</span>
          </p>
          <p class="metric-value">{{ deviceName }}</p>
          <ul class="mini-feed">
            <li v-for="sample in recentSamples" :key="sample.timeMs">
              <span>{{ sample.timeLabel }}</span>
              <span>{{ sample.bpm }} {{ t('bpm') }}</span>
            </li>
            <li v-if="!recentSamples.length" class="empty-row">{{ t('noSamplesYet') }}</li>
          </ul>
        </article>
      </div>
    </div>

    <p v-if="needsSecureContext" class="alert">
      <AlertTriangle class="alert-icon" />
      {{ t('secureAlert') }}
    </p>
    <p v-if="!isSupported" class="alert">
      <AlertTriangle class="alert-icon" />
      {{ t('unsupportedAlert') }}
    </p>

    <button class="fab-connect" :disabled="isFabDisabled" @click="handleFabClick">
      <Bluetooth class="fab-icon" />
      <span>{{ fabLabel }}</span>
    </button>

    <Teleport to="body">
      <div v-if="isAboutModalOpen" class="about-modal-mask" @click="closeAboutModal">
        <article class="about-modal glass" role="dialog" aria-modal="true" @click.stop>
          <div class="about-modal-head">
            <h2 class="about-modal-title">{{ t('aboutTitle') }}</h2>
            <button
              class="about-modal-close"
              type="button"
              :aria-label="t('close')"
              @click="closeAboutModal"
            >
              {{ t('close') }}
            </button>
          </div>
          <p class="about-modal-intro">{{ t('aboutIntro') }}</p>

          <div class="about-modal-grid">
            <section class="about-card">
              <h3>{{ t('aboutGoalTitle') }}</h3>
              <p>{{ t('aboutGoalBody') }}</p>
            </section>
            <section class="about-card">
              <h3>{{ t('aboutAbilityTitle') }}</h3>
              <ul>
                <li v-for="ability in aboutAbilities" :key="ability">{{ ability }}</li>
              </ul>
            </section>
            <section class="about-card">
              <h3>{{ t('aboutTechTitle') }}</h3>
              <div class="about-tech">
                <span v-for="tech in aboutTechTags" :key="tech">{{ tech }}</span>
              </div>
            </section>
            <section class="about-card">
              <h3>{{ t('aboutDataTitle') }}</h3>
              <p>{{ t('aboutDataBody') }}</p>
            </section>
            <section class="about-card">
              <h3>{{ t('aboutAuthorTitle') }}</h3>
              <p>{{ t('aboutAuthorBody') }}</p>
              <a
                class="about-link"
                :href="authorProfileUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t('aboutAuthorLinkLabel') }}
              </a>
            </section>
          </div>
        </article>
      </div>
    </Teleport>
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

.lang-chip {
  font: inherit;
  color: #e2e8f0;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.lang-chip:hover {
  border-color: rgba(125, 211, 252, 0.5);
  background: rgba(15, 23, 42, 0.92);
  color: #f8fafc;
}

.about-chip {
  font: inherit;
  color: #bae6fd;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.about-chip:hover {
  border-color: rgba(34, 211, 238, 0.56);
  background: rgba(15, 23, 42, 0.92);
  color: #e0f2fe;
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

.hero-grid.is-visual-fullscreen {
  grid-template-columns: 1fr;
}

.visual-stage {
  display: grid;
  gap: 10px;
  min-width: 0;
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

.panel-head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-head {
  display: grid;
  gap: 2px;
}

.fullscreen-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(56, 189, 248, 0.42);
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(2, 6, 23, 0.62);
  color: #bae6fd;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.fullscreen-btn:hover {
  background: rgba(15, 23, 42, 0.84);
  border-color: rgba(103, 232, 249, 0.72);
  color: #e0f2fe;
}

.fullscreen-icon {
  width: 14px;
  height: 14px;
  stroke-width: 2.2;
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

.bpm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.zone-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
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

.bpm-shell.zone-unknown {
  border-color: rgba(148, 163, 184, 0.36);
  background: radial-gradient(circle at 50% 50%, rgba(148, 163, 184, 0.18), rgba(148, 163, 184, 0.04));
}

.bpm-shell.zone-low {
  border-color: rgba(56, 189, 248, 0.42);
  background: radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.2), rgba(56, 189, 248, 0.05));
}

.bpm-shell.zone-normal {
  border-color: rgba(74, 222, 128, 0.42);
  background: radial-gradient(circle at 50% 50%, rgba(74, 222, 128, 0.2), rgba(74, 222, 128, 0.05));
}

.bpm-shell.zone-elevated {
  border-color: rgba(250, 204, 21, 0.46);
  background: radial-gradient(circle at 50% 50%, rgba(250, 204, 21, 0.2), rgba(250, 204, 21, 0.05));
}

.bpm-shell.zone-high {
  border-color: rgba(248, 113, 113, 0.48);
  background: radial-gradient(circle at 50% 50%, rgba(248, 113, 113, 0.2), rgba(248, 113, 113, 0.05));
}

.zone-pill.zone-unknown {
  color: #cbd5e1;
  border-color: rgba(148, 163, 184, 0.34);
  background: rgba(148, 163, 184, 0.16);
}

.zone-pill.zone-low {
  color: #7dd3fc;
  border-color: rgba(56, 189, 248, 0.44);
  background: rgba(56, 189, 248, 0.16);
}

.zone-pill.zone-normal {
  color: #86efac;
  border-color: rgba(74, 222, 128, 0.46);
  background: rgba(74, 222, 128, 0.16);
}

.zone-pill.zone-elevated {
  color: #fde68a;
  border-color: rgba(250, 204, 21, 0.48);
  background: rgba(250, 204, 21, 0.16);
}

.zone-pill.zone-high {
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.52);
  background: rgba(248, 113, 113, 0.18);
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

.range-note {
  margin: 0;
  font-size: 11px;
  color: #94a3b8;
}

.range-current {
  margin: 0;
  font-size: 11px;
  color: #cbd5e1;
}

.range-legend {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.range-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 4px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  border: 1px solid transparent;
}

.range-chip.zone-low {
  color: #7dd3fc;
  border-color: rgba(56, 189, 248, 0.3);
  background: rgba(56, 189, 248, 0.12);
}

.range-chip.zone-normal {
  color: #86efac;
  border-color: rgba(74, 222, 128, 0.3);
  background: rgba(74, 222, 128, 0.12);
}

.range-chip.zone-elevated {
  color: #fde68a;
  border-color: rgba(250, 204, 21, 0.34);
  background: rgba(250, 204, 21, 0.12);
}

.range-chip.zone-high {
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.35);
  background: rgba(248, 113, 113, 0.12);
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

.visual-stage:fullscreen {
  width: 100vw;
  height: 100vh;
  padding: 14px;
  background:
    radial-gradient(circle at 14% 10%, rgba(56, 189, 248, 0.18), transparent 34%),
    radial-gradient(circle at 88% 90%, rgba(244, 114, 182, 0.16), transparent 38%),
    #020617;
  grid-template-rows: minmax(0, 2.05fr) minmax(0, 1fr);
  align-content: stretch;
}

.visual-stage:fullscreen .heart-panel {
  height: 100%;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.visual-stage:fullscreen .heart-viewport {
  min-height: 0;
  height: 100%;
  aspect-ratio: auto;
}

.visual-stage:fullscreen .trend-panel {
  height: 100%;
  min-height: 0;
  padding: 10px;
}

.visual-stage:fullscreen .trend-grid {
  height: 100%;
  grid-template-rows: minmax(0, 1fr);
}

.visual-stage:fullscreen .trend-card {
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.visual-stage:fullscreen .trend-chart {
  height: 100%;
  min-height: 150px;
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

.about-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 130;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(2, 6, 23, 0.7);
  backdrop-filter: blur(4px);
}

.about-modal {
  width: min(780px, calc(100vw - 24px));
  max-height: min(84vh, 780px);
  overflow: auto;
  padding: 18px;
}

.about-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.about-modal-title {
  margin: 0;
  color: #f8fafc;
  font-size: 24px;
  line-height: 1.2;
}

.about-modal-close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.38);
  background: rgba(2, 6, 23, 0.7);
  color: #bae6fd;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.about-modal-close:hover {
  border-color: rgba(34, 211, 238, 0.62);
  background: rgba(15, 23, 42, 0.9);
}

.about-modal-intro {
  margin: 10px 0 0;
  color: #94a3b8;
  line-height: 1.7;
  font-size: 14px;
}

.about-modal-grid {
  margin-top: 14px;
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.about-card {
  border: 1px solid rgba(56, 189, 248, 0.16);
  border-radius: 12px;
  padding: 12px;
  background: rgba(2, 6, 23, 0.36);
}

.about-card h3 {
  margin: 0;
  color: #e2e8f0;
  font-size: 16px;
}

.about-card p {
  margin: 8px 0 0;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.7;
}

.about-link {
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(34, 211, 238, 0.35);
  color: #67e8f9;
  text-decoration: none;
  font-size: 12px;
  font-weight: 700;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.about-link:hover {
  border-color: rgba(34, 211, 238, 0.72);
  background: rgba(8, 47, 73, 0.5);
  color: #a5f3fc;
}

.about-card ul {
  margin: 8px 0 0;
  padding-left: 18px;
  color: #cbd5e1;
  display: grid;
  gap: 6px;
  font-size: 13px;
}

.about-tech {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.about-tech span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 9px;
  border-radius: 999px;
  border: 1px solid rgba(34, 211, 238, 0.28);
  background: rgba(2, 6, 23, 0.62);
  color: #67e8f9;
  font-size: 12px;
  font-weight: 600;
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

  .panel-head-row {
    align-items: center;
  }

  .trend-grid {
    grid-template-columns: 1fr;
  }

  .about-modal-grid {
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

  .panel-head-row {
    flex-wrap: wrap;
  }

  .fullscreen-btn {
    padding: 7px 10px;
    font-size: 11px;
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
