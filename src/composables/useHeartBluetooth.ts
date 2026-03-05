import { ref } from 'vue'

// 统一的心率样本结构，供 UI 展示和历史趋势使用。
export type HeartSample = {
  bpm: number
  rrMs: number | null
  rrEstimated: boolean
  timeLabel: string
  timeMs: number
}

// Web Bluetooth 必须可用，并且页面需运行在安全上下文（HTTPS/localhost）。
const isSupported =
  typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'bluetooth' in navigator
const needsSecureContext =
  typeof window !== 'undefined' && !window.isSecureContext

const isConnecting = ref(false)
const isConnected = ref(false)
const deviceName = ref('Not connected')
const statusMessage = ref('Ready to connect.')

const currentBpm = ref<number | null>(null)
const currentRrMs = ref<number | null>(null)
const currentRrEstimated = ref(false)
const latestAt = ref('')
const samples = ref<HeartSample[]>([])

let bluetoothDevice: any = null
let heartRateCharacteristic: any = null

// 解析蓝牙标准 Heart Rate Measurement 特征（0x2A37）。
const parseHeartRateMeasurement = (value: DataView) => {
  const flags = value.getUint8(0)
  const isHeartRate16Bit = (flags & 0x01) !== 0
  const hasEnergyExpended = (flags & 0x08) !== 0
  const hasRrInterval = (flags & 0x10) !== 0

  let index = 1
  const bpm = isHeartRate16Bit
    ? value.getUint16(index, true)
    : value.getUint8(index)
  index += isHeartRate16Bit ? 2 : 1

  if (hasEnergyExpended) {
    index += 2
  }

  const rrMsList: number[] = []
  if (hasRrInterval) {
    while (value.byteLength >= index + 2) {
      const rrRaw = value.getUint16(index, true)
      rrMsList.push(Math.round((rrRaw / 1024) * 1000))
      index += 2
    }
  }

  return { bpm, rrMsList }
}

const pushSample = (bpm: number, rrMs: number | null, rrEstimated: boolean) => {
  const now = Date.now()
  // 样本按“最新在前”保存，并限制最大数量避免内存持续增长。
  samples.value = [
    {
      bpm,
      rrMs,
      rrEstimated,
      timeLabel: new Date(now).toLocaleTimeString(),
      timeMs: now,
    },
    ...samples.value,
  ].slice(0, 300)
}

const onHeartRateChanged = (event: Event) => {
  const target = event.target as { value?: DataView } | null
  const value = target?.value
  if (!value) {
    return
  }

  const { bpm, rrMsList } = parseHeartRateMeasurement(value)
  const latestRrMs = rrMsList.length ? (rrMsList[rrMsList.length - 1] ?? null) : null

  currentBpm.value = bpm
  currentRrMs.value = latestRrMs
  currentRrEstimated.value = false
  latestAt.value = new Date().toLocaleTimeString()

  if (rrMsList.length) {
    rrMsList.forEach((rrMs) => {
      pushSample(bpm, rrMs, false)
    })
    return
  }

  pushSample(bpm, null, false)
}

const onDisconnected = () => {
  isConnected.value = false
  statusMessage.value = 'Device disconnected.'
  deviceName.value = 'Not connected'
  currentRrEstimated.value = false
}

const connectWatch = async () => {
  if (!isSupported || needsSecureContext) {
    statusMessage.value =
      'Web Bluetooth requires a supported browser and secure context (HTTPS/localhost).'
    return
  }

  if (isConnected.value && bluetoothDevice?.gatt?.connected) {
    statusMessage.value = 'Already connected.'
    return
  }

  // 连接流程进行中时锁定 UI 状态，避免重复点击。
  isConnecting.value = true
  statusMessage.value = 'Requesting Bluetooth device...'

  try {
    const bluetooth = (
      navigator as Navigator & {
        bluetooth?: { requestDevice: (options: unknown) => Promise<any> }
      }
    ).bluetooth
    if (!bluetooth) {
      throw new Error('Web Bluetooth API is unavailable.')
    }

    // 优先匹配标准 heart_rate 服务，同时兼容已知设备名前缀。
    const device = await bluetooth.requestDevice({
      filters: [
        { services: ['heart_rate'] },
        { namePrefix: 'xinlvguangbo' },
        { namePrefix: 'xinlv' },
      ],
      optionalServices: ['battery_service', 'device_information'],
    })

    // 重连新设备前先解绑旧监听，避免重复回调。
    if (bluetoothDevice) {
      bluetoothDevice.removeEventListener('gattserverdisconnected', onDisconnected)
    }

    bluetoothDevice = device
    bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected)
    deviceName.value = device.name ?? 'Unknown device'

    statusMessage.value = 'Connecting GATT server...'
    const server = await device.gatt?.connect()
    if (!server) {
      throw new Error('GATT server is unavailable.')
    }

    const heartRateService = await server.getPrimaryService('heart_rate')
    const nextCharacteristic = await heartRateService.getCharacteristic(
      'heart_rate_measurement',
    )

    // 绑定新特征通知前，先清理旧特征监听。
    if (heartRateCharacteristic) {
      heartRateCharacteristic.removeEventListener(
        'characteristicvaluechanged',
        onHeartRateChanged,
      )
    }

    heartRateCharacteristic = nextCharacteristic
    await heartRateCharacteristic.startNotifications()
    heartRateCharacteristic.addEventListener(
      'characteristicvaluechanged',
      onHeartRateChanged,
    )

    isConnected.value = true
    statusMessage.value = 'Connected. Waiting for heart rate data...'
  } catch (error) {
    // 尽量保留原始错误信息，方便定位连接问题。
    statusMessage.value =
      error instanceof Error ? error.message : 'Bluetooth connection failed.'
    isConnected.value = false
  } finally {
    isConnecting.value = false
  }
}

const disconnectWatch = async () => {
  try {
    if (heartRateCharacteristic) {
      // 先停止通知，再清理引用，避免断开过程中仍触发回调。
      heartRateCharacteristic.removeEventListener(
        'characteristicvaluechanged',
        onHeartRateChanged,
      )
      try {
        await heartRateCharacteristic.stopNotifications()
      } catch {
        // 断开时停止通知失败可忽略，不影响最终释放连接。
      }
    }
  } finally {
    heartRateCharacteristic = null
  }

  if (bluetoothDevice) {
    // 断开前先移除监听，防止残留回调污染状态。
    bluetoothDevice.removeEventListener('gattserverdisconnected', onDisconnected)
    if (bluetoothDevice.gatt?.connected) {
      bluetoothDevice.gatt.disconnect()
    }
  }

  bluetoothDevice = null
  isConnected.value = false
  deviceName.value = 'Not connected'
  statusMessage.value = 'Disconnected.'
  currentRrEstimated.value = false
}

export const useHeartBluetooth = () => ({
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
})
