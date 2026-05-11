export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO'
export type AlertType =
  | 'UV_BELOW_IMO'
  | 'UV_BELOW_USCG'
  | 'LAMP_FAILURE'
  | 'FILTER_HIGH_DP'
  | 'FLOW_DEVIATION'

export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'

export interface BwtsAlert {
  id: string
  timestamp: Date
  severity: AlertSeverity
  type: AlertType
  parameter: string
  currentValue: number
  threshold: number
  unit: string
  deviation: number        // % from threshold (negative = below)
  rateOfChange: number     // units per minute
  timeToThreshold: number  // minutes, NaN if already breached
  recommendedAction: string
  status: AlertStatus
  acknowledgedAt?: Date
  resolvedAt?: Date
}

export interface AnalysisScore {
  parameter: string
  current: number
  baseline: number
  deviation: number       // %
  ratePerMin: number
  timeToAlert: number     // minutes, Infinity if safe
  unit: string
  isAlerting: boolean
}

// IMO/USCG thresholds — Alfa Laval PureBallast operating spec
const IMO_MIN = 380
const USCG_MIN = 772
const FILTER_DP_LIMIT = 0.50
const FLOW_MIN = 165
const FLOW_MAX = 750

// Baseline values (normal operation)
const BASELINES = {
  uvIntensity: 800,
  flowRate: 325,
  filterPressure: 0.15,
  lampEfficiency: 83,
}

// Rolling history for rate-of-change calculation (client-side only)
const history: {
  uvIntensity: number[]
  flowRate: number[]
  filterPressure: number[]
  lampEfficiency: number[]
  timestamps: number[]
} = {
  uvIntensity: [],
  flowRate: [],
  filterPressure: [],
  lampEfficiency: [],
  timestamps: [],
}
const HISTORY_LEN = 10

let activeAlerts: BwtsAlert[] = []
let alertHistory: BwtsAlert[] = []
let idCounter = 0

function makeId(): string {
  return `alert-${Date.now()}-${++idCounter}`
}

function rateOfChange(values: number[], timestamps: number[]): number {
  if (values.length < 2) return 0
  const dt = (timestamps[timestamps.length - 1] - timestamps[0]) / 60000 // minutes
  if (dt <= 0) return 0
  return (values[values.length - 1] - values[0]) / dt
}

function timeToThreshold(current: number, threshold: number, rate: number): number {
  if (rate === 0) return Infinity
  const gap = current - threshold
  if (gap <= 0) return 0
  const t = -(gap / rate)
  return t > 0 ? t : Infinity
}

function ensureAlert(
  type: AlertType,
  severity: AlertSeverity,
  parameter: string,
  currentValue: number,
  threshold: number,
  unit: string,
  deviation: number,
  ratePerMin: number,
  recommendedAction: string,
) {
  const existing = activeAlerts.find(a => a.type === type && a.status !== 'RESOLVED')
  if (!existing) {
    const alert: BwtsAlert = {
      id: makeId(),
      timestamp: new Date(),
      severity,
      type,
      parameter,
      currentValue,
      threshold,
      unit,
      deviation,
      rateOfChange: ratePerMin,
      timeToThreshold: 0,
      recommendedAction,
      status: 'ACTIVE',
    }
    activeAlerts.push(alert)
  } else {
    existing.currentValue = currentValue
    existing.deviation = deviation
    existing.rateOfChange = ratePerMin
  }
}

function clearAlert(type: AlertType) {
  activeAlerts = activeAlerts.filter(a => {
    if (a.type === type && a.status === 'ACTIVE') {
      alertHistory.unshift({ ...a, status: 'RESOLVED', resolvedAt: new Date() })
      return false
    }
    return true
  })
}

export function processReading(params: {
  uvIntensity: number
  flowRate: number
  filterPressure: number
  lampEfficiency: number
  lampStatuses: string[]
  lampEfficiencies: number[]
  timestamp: number
}): void {
  const { uvIntensity, flowRate, filterPressure, lampEfficiency, lampStatuses, lampEfficiencies, timestamp } = params

  // Update history
  history.uvIntensity.push(uvIntensity)
  history.flowRate.push(flowRate)
  history.filterPressure.push(filterPressure)
  history.lampEfficiency.push(lampEfficiency)
  history.timestamps.push(timestamp)
  if (history.uvIntensity.length > HISTORY_LEN) {
    history.uvIntensity.shift()
    history.flowRate.shift()
    history.filterPressure.shift()
    history.lampEfficiency.shift()
    history.timestamps.shift()
  }

  const uvRate = rateOfChange(history.uvIntensity, history.timestamps)
  const flowRate_ = rateOfChange(history.flowRate, history.timestamps)
  const dpRate = rateOfChange(history.filterPressure, history.timestamps)

  // UV below IMO
  if (uvIntensity < IMO_MIN) {
    const dev = ((uvIntensity - IMO_MIN) / IMO_MIN) * 100
    ensureAlert(
      'UV_BELOW_IMO', 'CRITICAL', 'UV Intensity', uvIntensity, IMO_MIN, 'W/m²', dev, uvRate,
      'Stop ballasting immediately. Inspect UV lamps and replace any failed units. Verify reactor quartz window for fouling. Do not resume treatment until UV exceeds 380 W/m².'
    )
  } else {
    clearAlert('UV_BELOW_IMO')
  }

  // UV below USCG
  if (uvIntensity < USCG_MIN) {
    const dev = ((uvIntensity - USCG_MIN) / USCG_MIN) * 100
    ensureAlert(
      'UV_BELOW_USCG', 'WARNING', 'UV Intensity (USCG)', uvIntensity, USCG_MIN, 'W/m²', dev, uvRate,
      'UV intensity below USCG operating target. Monitor lamp efficiency and filter condition. Consider reducing flow rate to increase UV dose.'
    )
  } else {
    clearAlert('UV_BELOW_USCG')
  }

  // Lamp failures
  const failedLamps = lampStatuses
    .map((s, i) => ({ lamp: i + 1, status: s, eff: lampEfficiencies[i] }))
    .filter(l => l.status === 'FAILED')

  if (failedLamps.length > 0) {
    const lampList = failedLamps.map(l => `Lamp ${l.lamp} (${l.eff.toFixed(0)}%)`).join(', ')
    ensureAlert(
      'LAMP_FAILURE', 'WARNING', 'UV Lamp Status', failedLamps.length, 0, 'failed lamps',
      -100, 0,
      `Replace ${lampList}. Efficiency has dropped to critical level. Check LPS unit and wiring before replacement.`
    )
  } else {
    clearAlert('LAMP_FAILURE')
  }

  // Filter high DP
  if (filterPressure > FILTER_DP_LIMIT) {
    const dev = ((filterPressure - FILTER_DP_LIMIT) / FILTER_DP_LIMIT) * 100
    ensureAlert(
      'FILTER_HIGH_DP', 'WARNING', 'Filter Differential Pressure', filterPressure, FILTER_DP_LIMIT, 'bar', dev, dpRate,
      'Initiate manual backflush cycle. If pressure remains high after backflush, inspect filter element for fouling or damage. Check strainer and clean if required.'
    )
  } else {
    clearAlert('FILTER_HIGH_DP')
  }

  // Flow deviation
  if (flowRate < FLOW_MIN || flowRate > FLOW_MAX) {
    const threshold = flowRate < FLOW_MIN ? FLOW_MIN : FLOW_MAX
    const dev = ((flowRate - threshold) / threshold) * 100
    ensureAlert(
      'FLOW_DEVIATION', 'WARNING', 'System Flow Rate', flowRate, threshold, 'm³/h', dev, flowRate_,
      'Flow rate outside certified treatment range. Check pump performance, valve position and strainer. If below minimum, UV dose may be insufficient for treatment.'
    )
  } else {
    clearAlert('FLOW_DEVIATION')
  }
}

export function computeAnalysisScores(params: {
  uvIntensity: number
  flowRate: number
  filterPressure: number
  lampEfficiency: number
}): AnalysisScore[] {
  const uvRate = rateOfChange(history.uvIntensity, history.timestamps)
  const flowRate_ = rateOfChange(history.flowRate, history.timestamps)
  const dpRate = rateOfChange(history.filterPressure, history.timestamps)

  const uvDev = ((params.uvIntensity - BASELINES.uvIntensity) / BASELINES.uvIntensity) * 100
  // UV falls toward IMO threshold: time = (current - threshold) / (-rate) when rate is negative
  const uvTTA = params.uvIntensity <= IMO_MIN ? 0
    : uvRate >= 0 ? Infinity
    : (params.uvIntensity - IMO_MIN) / (-uvRate)

  const flowDev = ((params.flowRate - BASELINES.flowRate) / BASELINES.flowRate) * 100
  const flowTTA = params.flowRate < FLOW_MIN ? 0 : Infinity

  const dpDev = ((params.filterPressure - BASELINES.filterPressure) / BASELINES.filterPressure) * 100
  // Filter DP rises toward limit: time = (threshold - current) / rate when rate is positive
  const dpTTA = params.filterPressure >= FILTER_DP_LIMIT ? 0
    : dpRate <= 0 ? Infinity
    : (FILTER_DP_LIMIT - params.filterPressure) / dpRate

  const effDev = ((params.lampEfficiency - BASELINES.lampEfficiency) / BASELINES.lampEfficiency) * 100

  return [
    {
      parameter: 'UV Intensity',
      current: params.uvIntensity,
      baseline: BASELINES.uvIntensity,
      deviation: uvDev,
      ratePerMin: uvRate,
      timeToAlert: uvTTA,
      unit: 'W/m²',
      isAlerting: activeAlerts.some(a => a.type === 'UV_BELOW_IMO'),
    },
    {
      parameter: 'Flow Rate',
      current: params.flowRate,
      baseline: BASELINES.flowRate,
      deviation: flowDev,
      ratePerMin: flowRate_,
      timeToAlert: flowTTA,
      unit: 'm³/h',
      isAlerting: activeAlerts.some(a => a.type === 'FLOW_DEVIATION'),
    },
    {
      parameter: 'Filter ΔP',
      current: params.filterPressure,
      baseline: BASELINES.filterPressure,
      deviation: dpDev,
      ratePerMin: dpRate,
      timeToAlert: dpTTA,
      unit: 'bar',
      isAlerting: activeAlerts.some(a => a.type === 'FILTER_HIGH_DP'),
    },
    {
      parameter: 'Avg Lamp Efficiency',
      current: params.lampEfficiency,
      baseline: BASELINES.lampEfficiency,
      deviation: effDev,
      ratePerMin: 0,
      timeToAlert: Infinity,
      unit: '%',
      isAlerting: activeAlerts.some(a => a.type === 'LAMP_FAILURE'),
    },
  ]
}

export function getActiveAlerts(): BwtsAlert[] {
  return activeAlerts
}

export function getAlertHistory(): BwtsAlert[] {
  return alertHistory
}

export function acknowledgeAlert(id: string): void {
  const alert = activeAlerts.find(a => a.id === id)
  if (alert && alert.status === 'ACTIVE') {
    alert.status = 'ACKNOWLEDGED'
    alert.acknowledgedAt = new Date()
  }
}

export function resolveAlert(id: string): void {
  activeAlerts = activeAlerts.filter(a => {
    if (a.id === id) {
      alertHistory.unshift({ ...a, status: 'RESOLVED', resolvedAt: new Date() })
      return false
    }
    return true
  })
}

export function resetAlerts(): void {
  activeAlerts = []
  alertHistory = []
  history.uvIntensity.length = 0
  history.flowRate.length = 0
  history.filterPressure.length = 0
  history.lampEfficiency.length = 0
  history.timestamps.length = 0
}
