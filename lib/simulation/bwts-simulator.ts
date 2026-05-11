import type { TelemetryReading, HealthScore, Event } from '@/lib/types'

export type AnomalyType =
  | 'TRIGGER_LAMP_FAILURE'
  | 'TRIGGER_FILTER_CLOG'
  | 'TRIGGER_FLOW_DEVIATION'
  | 'RESET_STORY'

type StoryPhase = 'NORMAL' | 'LAMP_DEGRADING' | 'LAMP_FAILED' | 'UV_DROPPING' | 'COMPLIANCE_BREACH'
type OperationType = 'BALLAST' | 'DEBALLAST'
type OpPhase = 'RUNNING' | 'COMPLETING' | 'STARTING'

const PORTS = ['Port Hedland', 'Dampier', 'Fremantle', 'Singapore', 'Karratha', 'Brisbane']

// Baseline lamp efficiencies for 16 lamps (index 0 = Lamp 1)
// Lamp 7 (index 6) = 74% — watchlist, story arc target
// Lamp 13 (index 12) = 73% — watchlist
// Lamp 16 (index 15) = 65% — already orange
const LAMP_EFFICIENCY_BASE = [95, 90, 87, 84, 81, 78, 74, 82, 86, 83, 80, 77, 73, 92, 88, 65]
const LAMP_RUNTIME_BASE = [1200, 1450, 800, 2100, 950, 1680, 2200, 1100, 1350, 1900, 760, 2400, 2350, 880, 1550, 2800]
const LAMP_POWER_BASE = [420, 415, 418, 410, 416, 412, 405, 419, 413, 408, 421, 403, 402, 420, 414, 395]

interface SimulatorState {
  operationType: OperationType
  location: string
  opPhase: OpPhase
  opPhaseCount: number
  storyPhase: StoryPhase
  totalBallastVol: number
  totalDeballastVol: number
  filterPressure: number
  backflushActive: boolean
  backflushCount: number
  callCount: number
  startTime: number
  lastUpdate: number
  lampEfficiencies: number[]
  lampStatuses: string[]
  lampRuntimes: number[]
  lampPowers: number[]
  uvDropOffset: number
  flowDeviationActive: boolean
  flowDeviationCallsLeft: number
  filterClogActive: boolean
  recentEvents: Array<{ event_type: string; description: string; timestamp: Date }>
}

function makeInitialState(): SimulatorState {
  return {
    operationType: 'BALLAST',
    location: PORTS[0],
    opPhase: 'RUNNING',
    opPhaseCount: 0,
    storyPhase: 'NORMAL',
    totalBallastVol: 0,
    totalDeballastVol: 0,
    filterPressure: 0.15,
    backflushActive: false,
    backflushCount: 0,
    callCount: 0,
    startTime: Date.now(),
    lastUpdate: Date.now(),
    lampEfficiencies: [...LAMP_EFFICIENCY_BASE],
    lampStatuses: Array(16).fill('OK'),
    lampRuntimes: [...LAMP_RUNTIME_BASE],
    lampPowers: [...LAMP_POWER_BASE],
    uvDropOffset: 0,
    flowDeviationActive: false,
    flowDeviationCallsLeft: 0,
    filterClogActive: false,
    recentEvents: [],
  }
}

let state: SimulatorState = makeInitialState()
const anomalyQueue: AnomalyType[] = []

export function queueAnomaly(type: AnomalyType) {
  anomalyQueue.push(type)
}

export function setOperationType(op: OperationType) {
  if (state.operationType !== op) {
    state.operationType = op
    state.opPhase = 'COMPLETING'
    state.opPhaseCount = 0
    state.location = PORTS[Math.floor(Math.random() * PORTS.length)]
  }
}

function noise(base: number, pct: number): number {
  return base * (1 + (Math.random() - 0.5) * 2 * pct)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function processAnomalyQueue() {
  while (anomalyQueue.length > 0) {
    const anomaly = anomalyQueue.shift()!
    switch (anomaly) {
      case 'TRIGGER_LAMP_FAILURE':
        // Immediately fail Lamp 13 (index 12)
        state.lampStatuses[12] = 'FAILED'
        state.lampEfficiencies[12] = 20 + Math.random() * 10
        state.recentEvents.unshift({
          event_type: 'ALARM_TRIGGERED',
          description: 'LAMP_FAILURE: Lamp 13 failed — efficiency critical',
          timestamp: new Date(),
        })
        break
      case 'TRIGGER_FILTER_CLOG':
        state.filterClogActive = true
        state.filterPressure = 0.62
        state.recentEvents.unshift({
          event_type: 'ALARM_TRIGGERED',
          description: 'FILTER_HIGH_DP: Filter differential pressure exceeded limit',
          timestamp: new Date(),
        })
        break
      case 'TRIGGER_FLOW_DEVIATION':
        state.flowDeviationActive = true
        state.flowDeviationCallsLeft = 150 // ~5 min at 2s polling
        state.recentEvents.unshift({
          event_type: 'ALARM_TRIGGERED',
          description: 'FLOW_DEVIATION: Flow rate dropped outside certified range',
          timestamp: new Date(),
        })
        break
      case 'RESET_STORY':
        const savedOp = state.operationType
        state = makeInitialState()
        state.operationType = savedOp
        break
    }
  }
}

export function generateBWTSData(): {
  latestTelemetry: TelemetryReading
  latestHealth: HealthScore
  recentEvents: Event[]
} {
  const now = Date.now()
  const timeDeltaSeconds = Math.min((now - state.lastUpdate) / 1000, 10)
  state.lastUpdate = now
  state.callCount++

  processAnomalyQueue()

  // Operation phase transitions
  if (state.opPhase !== 'RUNNING') {
    state.opPhaseCount++
    if (state.opPhaseCount >= 5) {
      state.opPhase = state.opPhase === 'COMPLETING' ? 'STARTING' : 'RUNNING'
      state.opPhaseCount = 0
      if (state.opPhase === 'RUNNING') {
        state.recentEvents.unshift({
          event_type: 'PROCESS_START',
          description: `${state.operationType} process started at ${state.location}`,
          timestamp: new Date(),
        })
      }
    }
  }

  // Story arc progression
  if (state.storyPhase === 'NORMAL' && state.callCount >= 90) {
    state.storyPhase = 'LAMP_DEGRADING'
  }
  if (state.storyPhase === 'LAMP_DEGRADING' && state.callCount >= 150) {
    state.storyPhase = 'LAMP_FAILED'
    state.lampStatuses[6] = 'FAILED'
    state.recentEvents.unshift({
      event_type: 'ALARM_TRIGGERED',
      description: 'LAMP_FAILURE: Lamp 7 failed — efficiency below critical threshold',
      timestamp: new Date(),
    })
  }
  if (state.storyPhase === 'LAMP_FAILED') {
    state.storyPhase = 'UV_DROPPING'
  }

  // Lamp 7 degradation during LAMP_DEGRADING and all subsequent phases
  if (state.storyPhase !== 'NORMAL') {
    if (state.lampEfficiencies[6] > 30 && state.lampStatuses[6] !== 'FAILED') {
      state.lampEfficiencies[6] = Math.max(30, state.lampEfficiencies[6] - 2)
    }
  }

  // UV drop after lamp failure
  if (state.storyPhase === 'UV_DROPPING' || state.storyPhase === 'COMPLIANCE_BREACH') {
    state.uvDropOffset = Math.min(state.uvDropOffset + 15, 400)
  }
  if (state.uvDropOffset >= 340) {
    state.storyPhase = 'COMPLIANCE_BREACH'
  }

  // Lamp efficiency drift (barely perceptible)
  for (let i = 0; i < 16; i++) {
    if (state.lampStatuses[i] !== 'FAILED') {
      state.lampEfficiencies[i] = clamp(
        state.lampEfficiencies[i] + (Math.random() - 0.5) * 0.06,
        LAMP_EFFICIENCY_BASE[i] - 3,
        LAMP_EFFICIENCY_BASE[i] + 1
      )
      // Update runtime
      state.lampRuntimes[i] += timeDeltaSeconds / 3600
    }
  }

  // Filter pressure cycle
  if (!state.filterClogActive) {
    if (state.backflushActive) {
      state.backflushCount++
      state.filterPressure = Math.max(0.15, state.filterPressure - 0.10)
      if (state.backflushCount >= 3) {
        state.backflushActive = false
        state.backflushCount = 0
        state.filterPressure = 0.15
      }
    } else {
      state.filterPressure += 0.003
      if (state.filterPressure >= 0.45) {
        state.backflushActive = true
        state.backflushCount = 0
      }
    }
  }

  // Flow deviation countdown
  if (state.flowDeviationActive) {
    state.flowDeviationCallsLeft--
    if (state.flowDeviationCallsLeft <= 0) {
      state.flowDeviationActive = false
    }
  }

  // Volume accumulation
  const baseFlow = state.operationType === 'BALLAST' ? 350 : 300
  const flowMultiplier = state.flowDeviationActive ? 0.35 : 1.0
  const phaseMultiplier = state.opPhase === 'RUNNING' ? 1 : state.opPhase === 'COMPLETING' ? 0.3 : 0.6
  const flowRate = noise(baseFlow * flowMultiplier * phaseMultiplier, 0.015)

  if (state.operationType === 'BALLAST') {
    state.totalBallastVol += flowRate * (timeDeltaSeconds / 3600)
  } else {
    state.totalDeballastVol += flowRate * (timeDeltaSeconds / 3600)
  }

  // Derived values
  const uvBase = 800 - state.uvDropOffset
  const uvIntensity = clamp(noise(uvBase, 0.02), 200, 780)
  const waterTemp = noise(28, 0.01)
  const pressure = noise(state.operationType === 'BALLAST' ? 4.8 : 4.6, 0.02)
  const ldcAirTemp = noise(35, 0.02)
  const ldcFanSpeed = noise(1450, 0.01)
  const valvePosition = state.opPhase === 'RUNNING' ? noise(75, 0.03) : 30

  const failedLampCount = state.lampStatuses.filter(s => s === 'FAILED').length
  const avgEfficiency = state.lampEfficiencies.reduce((a, b) => a + b, 0) / 16
  const degradationImpact = Math.max(0, (100 - avgEfficiency) * 0.5)
  const powerCompensation = Math.min(30, degradationImpact * 1.2)

  // Health score
  const uvHealth = Math.min(100, (uvIntensity / 720) * 100)
  const lampHealth = avgEfficiency
  const thermalHealth = Math.max(0, 100 - (waterTemp - 25) * 5)
  const powerEff = Math.max(0, 100 - powerCompensation * 2)
  const overallScore = Math.round(uvHealth * 0.35 + lampHealth * 0.35 + thermalHealth * 0.15 + powerEff * 0.15)
  const riskLevel = overallScore >= 80 ? 'LOW' : overallScore >= 60 ? 'MEDIUM' : overallScore >= 40 ? 'HIGH' : 'CRITICAL'

  // Build telemetry object
  const telemetry: Record<string, unknown> = {
    _id: `sim-${now}`,
    timestamp: new Date(),
    system_id: 'BWTS-SIM-001',
    operation_type: state.operationType,
    location: state.location,
    month: new Date().getMonth() + 1,
    UVR_INTENSITY: parseFloat(uvIntensity.toFixed(2)),
    UVR_INTENSITY_NORMALIZED: parseFloat((uvIntensity / 720 * 100).toFixed(2)),
    UVR_POWER_OUTPUT: parseFloat(noise(85, 0.02).toFixed(2)),
    UVR_WATER_TEMP: parseFloat(waterTemp.toFixed(2)),
    UVR_LEVEL: 'OPERATIONAL',
    LDC_AIR_TEMP: parseFloat(ldcAirTemp.toFixed(2)),
    LDC_FAN_SPEED: parseFloat(ldcFanSpeed.toFixed(0)),
    LDC_FAN_STATUS: 'RUNNING',
    FLT_DIFF_PRESSURE: parseFloat(state.filterPressure.toFixed(3)),
    FLT_MOTOR_STATUS: state.backflushActive ? 'BACKFLUSHING' : 'NORMAL',
    FLT_BACKFLUSH_ACTIVE: state.backflushActive,
    FLT_BACKFLUSH_COUNT: Math.floor(state.backflushCount),
    SYS_FLOW_RATE: parseFloat(flowRate.toFixed(1)),
    SYS_PRESSURE: parseFloat(pressure.toFixed(2)),
    SYS_VALVE_POSITION: parseFloat(valvePosition.toFixed(1)),
    SYS_TOTAL_BALLAST_VOL: parseFloat(state.totalBallastVol.toFixed(1)),
    SYS_TOTAL_DEBALLAST_VOL: parseFloat(state.totalDeballastVol.toFixed(1)),
    AVG_LAMP_EFFICIENCY: parseFloat(avgEfficiency.toFixed(2)),
    FAILED_LAMP_COUNT: failedLampCount,
    DEGRADATION_IMPACT_PCT: parseFloat(degradationImpact.toFixed(2)),
    POWER_COMPENSATION_PCT: parseFloat(powerCompensation.toFixed(2)),
  }

  // Individual lamp data
  for (let i = 0; i < 16; i++) {
    const id = String(i + 1).padStart(2, '0')
    telemetry[`LAMP_${id}_STATUS`] = state.lampStatuses[i]
    telemetry[`LAMP_${id}_EFFICIENCY`] = parseFloat(state.lampEfficiencies[i].toFixed(2))
    telemetry[`LAMP_${id}_RUNTIME`] = parseFloat(state.lampRuntimes[i].toFixed(1))
    telemetry[`LAMP_${id}_POWER`] = state.lampStatuses[i] === 'FAILED'
      ? 0
      : parseFloat(noise(state.lampPowers[i], 0.01).toFixed(1))
  }

  const health: HealthScore = {
    _id: `sim-health-${now}`,
    timestamp: new Date(),
    overall_score: overallScore,
    risk_level: riskLevel as HealthScore['risk_level'],
    month: new Date().getMonth() + 1,
    components: {
      uv_health: parseFloat(uvHealth.toFixed(1)),
      power_efficiency: parseFloat(powerEff.toFixed(1)),
      lamp_health: parseFloat(lampHealth.toFixed(1)),
      thermal_health: parseFloat(thermalHealth.toFixed(1)),
    },
  }

  const events: Event[] = state.recentEvents.slice(0, 8).map((e, i) => ({
    _id: `sim-evt-${i}`,
    timestamp: e.timestamp,
    event_type: e.event_type as Event['event_type'],
    description: e.description,
    month: new Date().getMonth() + 1,
    data: null,
  }))

  return {
    latestTelemetry: telemetry as unknown as TelemetryReading,
    latestHealth: health,
    recentEvents: events,
  }
}

// Expose current simulator state for client-side Analysis tab
export function getSimulatorSnapshot() {
  return {
    storyPhase: state.storyPhase,
    operationType: state.operationType,
    callCount: state.callCount,
    lampEfficiencies: [...state.lampEfficiencies],
    lampStatuses: [...state.lampStatuses],
    lampRuntimes: [...state.lampRuntimes],
    filterPressure: state.filterPressure,
    backflushActive: state.backflushActive,
    uvDropOffset: state.uvDropOffset,
    location: state.location,
  }
}
