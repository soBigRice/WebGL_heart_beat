<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { useHeartBluetooth } from '../composables/useHeartBluetooth'

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

let bpmChart: any = null

const renderChart = () => {
  if (!chartRef.value) {
    return
  }

  if (!bpmChart) {
    bpmChart = echarts.init(chartRef.value)
  }

  const orderedSamples = [...samples.value].reverse()

  bpmChart.setOption({
    grid: { left: 45, right: 16, top: 28, bottom: 32 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: orderedSamples.map((sample) => sample.timeLabel),
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    yAxis: {
      type: 'value',
      min: (value: { min: number }) => Math.max(0, Math.floor(value.min - 5)),
      axisLine: { show: true, lineStyle: { color: '#cbd5e1' } },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
      name: 'BPM',
      nameTextStyle: { color: '#64748b' },
    },
    series: [
      {
        name: 'Heart Rate',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3, color: '#dc2626' },
        itemStyle: { color: '#dc2626' },
        areaStyle: { color: 'rgba(220, 38, 38, 0.12)' },
        data: orderedSamples.map((sample) => sample.bpm),
      },
    ],
  })
}

const handleResize = () => {
  bpmChart?.resize()
}

onMounted(() => {
  renderChart()
  window.addEventListener('resize', handleResize)
})

watch(samples, () => {
  renderChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (bpmChart) {
    bpmChart.dispose()
    bpmChart = null
  }
})
</script>

<template>
  <section class="view">
    <h2>HeartTest</h2>
    <p class="hint">
      Connect a watch or heart-rate broadcast device (for example
      <code>xinlvguangbo-iPhone</code> from your guide) and stream live BPM.
    </p>

    <div class="actions">
      <button
        class="btn primary"
        :disabled="isConnecting || isConnected"
        @click="connectWatch"
      >
        {{ isConnecting ? 'Connecting...' : 'Connect Watch' }}
      </button>
      <button class="btn ghost" :disabled="!isConnected" @click="disconnectWatch">
        Disconnect
      </button>
    </div>

    <div class="status-grid">
      <div class="card">
        <p class="label">Device</p>
        <p class="value">{{ deviceName }}</p>
      </div>
      <div class="card">
        <p class="label">Live BPM</p>
        <p class="bpm">{{ currentBpm ?? '--' }}</p>
      </div>
      <div class="card">
        <p class="label">RR interval</p>
        <p class="value">
          {{ currentRrMs !== null ? `${currentRrMs} ms` : '--' }}
          <span v-if="currentRrEstimated" class="estimated-tag">(est.)</span>
        </p>
      </div>
      <div class="card">
        <p class="label">Last update</p>
        <p class="value">{{ latestAt || '--' }}</p>
      </div>
    </div>

    <p class="status">{{ statusMessage }}</p>

    <div class="chart-section">
      <p class="chart-title">Heart Rate Trend</p>
      <div ref="chartRef" class="chart-container"></div>
    </div>

    <div class="history">
      <p class="chart-title">Recent samples</p>
      <div class="history-panel">
        <ul v-if="samples.length" class="sample-list">
          <li v-for="sample in samples" :key="sample.timeMs">
            <span>{{ sample.timeLabel }}</span>
            <span>{{ sample.bpm }} bpm</span>
            <span>
              {{ sample.rrMs !== null ? `${sample.rrMs} ms` : '--' }}
              {{ sample.rrEstimated ? ' (est.)' : '' }}
            </span>
          </li>
        </ul>
        <p v-else class="empty">No heart-rate sample yet.</p>
      </div>
    </div>

    <p v-if="needsSecureContext" class="warn">
      This feature only works in secure context (HTTPS or localhost).
    </p>
    <p v-if="!isSupported" class="warn">
      Your browser does not support Web Bluetooth.
    </p>
  </section>
</template>

<style scoped>
.view {
  padding: 24px;
  border-radius: 12px;
  background-color: #ffffff;
  display: grid;
  gap: 14px;
}

h2,
p {
  margin: 0;
}

.hint {
  color: #334155;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.btn {
  padding: 8px 12px;
  border-radius: 8px;
  border: 0;
  cursor: pointer;
  font: inherit;
}

.btn.primary {
  background-color: #2563eb;
  color: #ffffff;
}

.btn.ghost {
  background-color: #e2e8f0;
  color: #0f172a;
}

.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.status-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
  background-color: #f8fafc;
}

.label {
  color: #64748b;
  font-size: 13px;
}

.value {
  margin-top: 6px;
  font-weight: 600;
}

.estimated-tag {
  margin-left: 6px;
  color: #64748b;
  font-size: 12px;
}

.bpm {
  margin-top: 6px;
  font-size: 30px;
  font-weight: 700;
  color: #dc2626;
  line-height: 1;
}

.status {
  padding: 10px 12px;
  border-radius: 8px;
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e3a8a;
}

.history {
  display: grid;
  gap: 8px;
}

.chart-section {
  display: grid;
  gap: 8px;
}

.chart-title {
  color: #334155;
  font-weight: 600;
}

.chart-container {
  width: 100%;
  height: 280px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 6px;
}

.history-panel {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  height: 260px;
  overflow-y: auto;
}

.sample-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sample-list li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 14px;
  padding: 8px 10px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
}

.sample-list li:last-child {
  border-bottom: 0;
}

.empty {
  color: #64748b;
}

.warn {
  color: #9f1239;
  background-color: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 8px;
  padding: 8px 10px;
}
</style>
