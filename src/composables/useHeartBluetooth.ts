import { ref } from 'vue'

export type HeartSample = {
  bpm: number
  rrMs: number | null
  rrEstimated: boolean
  timeLabel: string
  timeMs: number
}

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

  let rrMs: number | null = null
  if (hasRrInterval && value.byteLength >= index + 2) {
    const rrRaw = value.getUint16(index, true)
    rrMs = Math.round((rrRaw / 1024) * 1000)
  }

  return { bpm, rrMs }
}

const pushSample = (bpm: number, rrMs: number | null, rrEstimated: boolean) => {
  const now = Date.now()
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

  const { bpm, rrMs: rawRrMs } = parseHeartRateMeasurement(value)
  const rrMs = rawRrMs ?? (bpm > 0 ? Math.round(60000 / bpm) : null)
  const rrEstimated = rawRrMs === null && rrMs !== null

  currentBpm.value = bpm
  currentRrMs.value = rrMs
  currentRrEstimated.value = rrEstimated
  latestAt.value = new Date().toLocaleTimeString()
  pushSample(bpm, rrMs, rrEstimated)
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

    const device = await bluetooth.requestDevice({
      filters: [
        { services: ['heart_rate'] },
        { namePrefix: 'xinlvguangbo' },
        { namePrefix: 'xinlv' },
      ],
      optionalServices: ['battery_service', 'device_information'],
    })

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
      heartRateCharacteristic.removeEventListener(
        'characteristicvaluechanged',
        onHeartRateChanged,
      )
      try {
        await heartRateCharacteristic.stopNotifications()
      } catch {
        // Ignore notification stop errors during disconnect.
      }
    }
  } finally {
    heartRateCharacteristic = null
  }

  if (bluetoothDevice) {
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
