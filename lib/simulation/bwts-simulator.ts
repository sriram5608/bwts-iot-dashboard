import type { TelemetryReading, HealthScore, Event } from '@/lib/types'

export type AnomalyType =
  | 'TRIGGER_UV_DEGRADATION'  // Scenario A — gradual UV drop: lamp aging + quartz fouling
  | 'TRIGGER_FILTER_CLOG'     // Scenario B — filter DP rising, ballast mode only
  | 'TRIGGER_LPS_FAILURE'     // Scenario C — LPS undervoltage, lamp cluster 09-11
  | 'TRIGGER_CIP_FAILURE'     // Scenario D — CIP doesn't recover UV
  | 'TRIGGER_LAMP_FAILURE'    // Legacy — immediate single lamp failure
  | 'TRIGGER_FLOW_DEVIATION'  // Legacy — flow rate drop
  | 'RESET_STORY'

type StoryPhase =
  | 'NORMAL'
  | 'UV_DEGRADING'
  | 'COMPLIANCE_BREACH'
  | 'FILTER_CLOG'
  | 'LPS_FAILURE'
  | 'CIP_FAILURE'

type OperationType = 'BALLAST' | 'DEBALLAST'
type OpPhase = 'RUNNING' | 'COMPLETING' | 'STARTING'

const PORTS = ['Port Hedland', 'Dampier', 'Fremantle', 'Singapore', 'Karratha', 'Brisbane']

// Lamp baselines — updated 2026-05-12 to match fill data ending state
// Index 0 = LAMP-01, index 12 = LAMP-13, index 14 = LAMP-15 (most degraded)
const LAMP_EFFICIENCY_BASE = [86.5, 87.6, 100, 76.08, 75.68, 83.99, 68.76, 90.8, 69.7, 85.5, 82.3, 100, 59.92, 95.2, 46.14, 85.1]
const LAMP_RUNTIME_BASE    = [3238.3, 3179.8, 1015.2, 3423.3, 3428.5, 3320.8, 3388.6, 3021.3, 3482.7, 3286, 3348, 473.4, 3566, 2696.3, 3588.6, 3305.5]
const LAMP_POWER_BASE      = [420, 420, 421, 414, 416, 417, 413, 421, 410, 419, 418, 421, 402, 421, 395, 418]

// CIP last performed 2026-03-26 — 47 days ago (47 × 24 = 1128 hours)
const CIP_HOURS_SINCE_LAST_BASE = 1128

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
  uvDegradationActive: boolean
  lpsFailureActive: boolean
  lpsFailureLamps: number[]
  cipFailureActive: boolean
  filterClogActive: boolean
  flowDeviationActive: boolean
  flowDeviationCallsLeft: number
  cipHoursSinceLast: number
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
    filterPressure: 0.18,
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
    uvDegradationActive: false,
    lpsFailureActive: false,
    lpsFailureLamps: [],
    cipFailureActive: false,
    filterClogActive: false,
    flowDeviationActive: false,
    flowDeviationCallsLeft: 0,
    cipHoursSinceLast: CIP_HOURS_SINCE_LAST_BASE,
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
    // Reset filter state on mode switch
    if (op === 'DEBALLAST') {
      state.filterPressure = 0.02  // filter bypassed in deballast
      state.backflushActive = false
      state.filterClogActive = false
    } else {
      state.filterPressure = 0.18  // filter active in ballast
    }
  }
}

function noise(base: number, pct: number): number {
  return base * (1 + (Math.random() - 0.5) * 2 * pct)
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function processAnomalyQueue() {
  while (anomalyQueue.length > 0) {
    const anomaly = anomalyQueue.shift()!
    switch (anomaly) {

      // ── Scenario A: UV Degradation ─────────────────────────────────────
      // LAMP-13 (index 12) and LAMP-15 (index 14) past 3,000h rated life.
      // Quartz sleeve fouled — CIP overdue 47 days. UV drops gradually.
      case 'TRIGGER_UV_DEGRADATION':
        state.uvDegradationActive = true
        state.storyPhase = 'UV_DEGRADING'
        state.cipHoursSinceLast = CIP_HOURS_SINCE_LAST_BASE
        state.recentEvents.unshift({
          event_type: 'ALARM_TRIGGERED',
          description: 'UV_LOW: UV intensity declining — lamp aging (L13, L15) + CIP overdue 47 days',
          timestamp: new Date(),
        })
        break

      // ── Scenario B: Filter Clog ────────────────────────────────────────
      // High turbidity water — filter DP climbing, backwash not clearing.
      // Only meaningful in ballasting (filter is bypassed during deballast).
      case 'TRIGGER_FILTER_CLOG':
        if (state.operationType === 'BALLAST') {
          state.filterClogActive = true
          state.filterPressure = 0.65
          state.storyPhase = 'FILTER_CLOG'
          state.recentEvents.unshift({
            event_type: 'ALARM_TRIGGERED',
            description: 'FILTER_HIGH_DP: Filter ΔP rising — high turbidity intake, clogging faster than backwash clearance',
            timestamp: new Date(),
          })
        }
        break

      // ── Scenario C: LPS Failure ────────────────────────────────────────
      // Lamp Power Supply undervoltage for cluster LAMP-09/10/11 (indices 8/9/10).
      // Lamp power drops → UV intensity reduced.
      case 'TRIGGER_LPS_FAILURE':
        state.lpsFailureActive = true
        state.lpsFailureLamps = [8, 9, 10]  // LAMP-09, LAMP-10, LAMP-11
        state.storyPhase = 'LPS_FAILURE'
        state.recentEvents.unshift({
          event_type: 'ALARM_TRIGGERED',
          description: 'LPS_FAULT: Lamp Power Supply undervoltage — LAMP-09/10/11 cluster power reduced',
          timestamp: new Date(),
        })
        break

      // ── Scenario D: CIP Failure ────────────────────────────────────────
      // CIP cycle completed but UV does not recover — severe quartz fouling,
      // manual cleaning required.
      case 'TRIGGER_CIP_FAILURE':
        state.cipFailureActive = true
        state.storyPhase = 'CIP_FAILURE'
        state.uvDropOffset = Math.max(state.uvDropOffset, 90)
        state.recentEvents.unshift({
          event_type: 'ALARM_TRIGGERED',
          description: 'CIP_NO_RECOVERY: CIP cycle completed — UV intensity did not recover. Severe quartz fouling. Manual sleeve clean required.',
          timestamp: new Date(),
        })
        break

      // ── Legacy: Immediate lamp failure ────────────────────────────────
      case 'TRIGGER_LAMP_FAILURE':
        state.lampStatuses[12] = 'FAILED'
        state.lampEfficiencies[12] = 15 + Math.random() * 10
        state.recentEvents.unshift({
          event_type: 'ALARM_TRIGGERED',
          description: 'LAMP_FAILURE: LAMP-13 failed — efficiency critical, lamp output lost',
          timestamp: new Date(),
        })
        break

      // ── Legacy: Flow deviation ─────────────────────────────────────────
      case 'TRIGGER_FLOW_DEVIATION':
        state.flowDeviationActive = true
        state.flowDeviationCallsLeft = 150
        state.recentEvents.unshift({
          event_type: 'ALARM_TRIGGERED',
          description: 'FLOW_DEVIATION: Flow rate dropped outside certified operating range',
          timestamp: new Date(),
        })
        break

      case 'RESET_STORY':
        const savedOp = state.operationType
        state = makeInitialState()
        state.operationType = savedOp
        if (savedOp === 'DEBALLAST') {
          state.filterPressure = 0.02
          state.backflushActive = false
        }
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

  const isDeballast = state.operationType === 'DEBALLAST'

  // ── Operation phase transitions ──────────────────────────────────────────
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

  // ── Scenario A: UV degradation progression ──────────────────────────────
  // ~3 W/m² per call → breaches USCG threshold (660-530 = 130) after ~44 calls
  if (state.uvDegradationActive) {
    state.uvDropOffset = Math.min(state.uvDropOffset + 3, 210)
    if (state.lampEfficiencies[12] > 50) {
      state.lampEfficiencies[12] = Math.max(50, state.lampEfficiencies[12] - 0.25)
    }
    if (state.lampEfficiencies[14] > 38) {
      state.lampEfficiencies[14] = Math.max(38, state.lampEfficiencies[14] - 0.18)
    }
    if (state.uvDropOffset >= 130) state.storyPhase = 'COMPLIANCE_BREACH'
  }

  // ── Scenario C: LPS failure progression ─────────────────────────────────
  if (state.lpsFailureActive) {
    for (const idx of state.lpsFailureLamps) {
      if (state.lampEfficiencies[idx] > 28) {
        state.lampEfficiencies[idx] = Math.max(28, state.lampEfficiencies[idx] - 1.2)
        state.lampPowers[idx] = Math.max(180, state.lampPowers[idx] - 4)
      }
    }
    state.uvDropOffset = Math.min(state.uvDropOffset + 1.5, 140)
    if (state.uvDropOffset >= 130) state.storyPhase = 'COMPLIANCE_BREACH'
  }

  // ── Scenario D: CIP failure progression ─────────────────────────────────
  if (state.cipFailureActive) {
    state.uvDropOffset = Math.min(state.uvDropOffset + 1.5, 190)
    if (state.uvDropOffset >= 130) state.storyPhase = 'COMPLIANCE_BREACH'
  }

  // ── Natural lamp efficiency drift ────────────────────────────────────────
  for (let i = 0; i < 16; i++) {
    if (state.lampStatuses[i] !== 'FAILED' && !state.lpsFailureLamps.includes(i)) {
      state.lampEfficiencies[i] = clamp(
        state.lampEfficiencies[i] + (Math.random() - 0.5) * 0.06,
        LAMP_EFFICIENCY_BASE[i] - 3,
        LAMP_EFFICIENCY_BASE[i] + 0.5
      )
      state.lampRuntimes[i] += timeDeltaSeconds / 3600
    } else if (state.lampStatuses[i] !== 'FAILED') {
      state.lampRuntimes[i] += timeDeltaSeconds / 3600
    }
  }

  // ── Filter — MODE SPECIFIC ───────────────────────────────────────────────
  if (isDeballast) {
    // Filter BYPASSED in deballasting — DP near zero, motor on standby
    state.filterPressure = noise(0.03, 0.15)
    state.backflushActive = false
  } else if (state.filterClogActive) {
    // BALLAST + CLOGGED: pressure climbs fast, backwash only partially clears
    if (state.backflushActive) {
      state.backflushCount++
      state.filterPressure = Math.max(0.52, state.filterPressure - 0.04)
      if (state.backflushCount >= 5) {
        state.backflushActive = false
        state.backflushCount = 0
        if (state.filterPressure > 0.90) {
          state.recentEvents.unshift({
            event_type: 'ALARM_TRIGGERED',
            description: `FILTER_ALARM: ΔP ${state.filterPressure.toFixed(2)} bar — backwash ineffective, manual inspection required`,
            timestamp: new Date(),
          })
        }
      }
    } else {
      state.filterPressure += 0.014
      if (state.filterPressure >= 0.80) {
        state.backflushActive = true
        state.backflushCount = 0
      }
    }
  } else {
    // BALLAST normal: 0.18 → 0.45 bar cycle with clean backwash
    if (state.backflushActive) {
      state.backflushCount++
      state.filterPressure = Math.max(0.15, state.filterPressure - 0.10)
      if (state.backflushCount >= 3) {
        state.backflushActive = false
        state.backflushCount = 0
        state.filterPressure = 0.18
      }
    } else {
      state.filterPressure += 0.003
      if (state.filterPressure >= 0.45) {
        state.backflushActive = true
        state.backflushCount = 0
      }
    }
  }

  // ── Flow rate — MODE SPECIFIC ────────────────────────────────────────────
  if (state.flowDeviationActive) {
    state.flowDeviationCallsLeft--
    if (state.flowDeviationCallsLeft <= 0) state.flowDeviationActive = false
  }
  // Deballast slightly faster than ballast (gravity-assisted discharge)
  const baseFlow = isDeballast ? 950 : 850
  const flowMultiplier = state.flowDeviationActive ? 0.35 : 1.0
  const phaseMultiplier = state.opPhase === 'RUNNING' ? 1.0 : state.opPhase === 'COMPLETING' ? 0.3 : 0.6
  const flowRate = noise(baseFlow * flowMultiplier * phaseMultiplier, 0.015)

  if (state.operationType === 'BALLAST') {
    state.totalBallastVol += flowRate * (timeDeltaSeconds / 3600)
  } else {
    state.totalDeballastVol += flowRate * (timeDeltaSeconds / 3600)
  }

  // ── UV intensity ─────────────────────────────────────────────────────────
  // Base 521 W/m² reflects current lamp state on 2026-05-12:
  // - LAMP-13 at 59.9%, LAMP-15 at 46.1% are most degraded (past 3000h rated life)
  // - Many lamps past 3000h — system UV already below USCG 530 threshold
  // - TRIGGER_UV_DEGRADATION pushes it further below (toward ~430 W/m²)
  const uvBase = 521 - state.uvDropOffset
  const uvIntensity = clamp(noise(uvBase, 0.02), 200, 750)

  // ── Other derived values ─────────────────────────────────────────────────
  // Deballast: water temp slightly higher (water has been sitting in tanks)
  const waterTemp = noise(isDeballast ? 30.5 : 28.0, 0.01)
  // Deballast: lower system pressure (pumping out vs pumping in)
  const pressure = noise(isDeballast ? 3.8 : 4.8, 0.02)
  const ldcAirTemp = noise(36, 0.02)
  const ldcFanSpeed = noise(1450, 0.01)
  const valvePosition = state.opPhase === 'RUNNING' ? noise(78, 0.03) : 25

  const failedLampCount = state.lampStatuses.filter(s => s === 'FAILED').length
  const avgEfficiency = state.lampEfficiencies.reduce((a, b) => a + b, 0) / 16
  const degradationImpact = Math.max(0, (100 - avgEfficiency) * 0.5)
  const powerCompensation = Math.min(30, degradationImpact * 1.2)
  const uvrPowerOutput = state.lpsFailureActive ? noise(71, 0.03) : noise(87, 0.02)

  // ── Health score ─────────────────────────────────────────────────────────
  const uvHealth = Math.min(100, (uvIntensity / 720) * 100)
  const lampHealth = avgEfficiency
  const thermalHealth = Math.max(0, 100 - Math.max(0, waterTemp - 25) * 5)
  const powerEff = Math.max(0, 100 - powerCompensation * 2)
  const overallScore = Math.round(uvHealth * 0.35 + lampHealth * 0.35 + thermalHealth * 0.15 + powerEff * 0.15)
  const riskLevel = overallScore >= 80 ? 'LOW' : overallScore >= 60 ? 'MEDIUM' : overallScore >= 40 ? 'HIGH' : 'CRITICAL'

  // ── Telemetry object ─────────────────────────────────────────────────────
  const telemetry: Record<string, unknown> = {
    _id: `sim-${now}`,
    timestamp: new Date(),
    system_id: 'BWTS-SIM-001',
    operation_type: state.operationType,
    location: state.location,
    month: new Date().getMonth() + 1,
    UVR_INTENSITY:            parseFloat(uvIntensity.toFixed(2)),
    UVR_INTENSITY_NORMALIZED: parseFloat((uvIntensity / 720 * 100).toFixed(2)),
    UVR_POWER_OUTPUT:         parseFloat(uvrPowerOutput.toFixed(2)),
    UVR_WATER_TEMP:           parseFloat(waterTemp.toFixed(2)),
    UVR_LEVEL:                'OPERATIONAL',
    LDC_AIR_TEMP:             parseFloat(ldcAirTemp.toFixed(2)),
    LDC_FAN_SPEED:            parseFloat(ldcFanSpeed.toFixed(0)),
    LDC_FAN_STATUS:           'RUNNING',
    FLT_DIFF_PRESSURE:        parseFloat(state.filterPressure.toFixed(3)),
    FLT_MOTOR_STATUS:         isDeballast ? 'STANDBY' : (state.backflushActive ? 'BACKFLUSHING' : 'NORMAL'),
    FLT_BACKFLUSH_ACTIVE:     isDeballast ? false : state.backflushActive,
    FLT_BACKFLUSH_COUNT:      isDeballast ? 0 : Math.floor(state.backflushCount),
    SYS_FLOW_RATE:            parseFloat(flowRate.toFixed(1)),
    SYS_PRESSURE:             parseFloat(pressure.toFixed(2)),
    SYS_VALVE_POSITION:       parseFloat(valvePosition.toFixed(1)),
    SYS_TOTAL_BALLAST_VOL:    parseFloat(state.totalBallastVol.toFixed(1)),
    SYS_TOTAL_DEBALLAST_VOL:  parseFloat(state.totalDeballastVol.toFixed(1)),
    CIP_HOURS_SINCE_LAST:     state.cipHoursSinceLast,
    AVG_LAMP_EFFICIENCY:      parseFloat(avgEfficiency.toFixed(2)),
    FAILED_LAMP_COUNT:        failedLampCount,
    DEGRADATION_IMPACT_PCT:   parseFloat(degradationImpact.toFixed(2)),
    POWER_COMPENSATION_PCT:   parseFloat(powerCompensation.toFixed(2)),
  }

  for (let i = 0; i < 16; i++) {
    const id = String(i + 1).padStart(2, '0')
    const inLpsFault = state.lpsFailureLamps.includes(i)
    telemetry[`LAMP_${id}_STATUS`]     = state.lampStatuses[i]
    telemetry[`LAMP_${id}_EFFICIENCY`] = parseFloat(state.lampEfficiencies[i].toFixed(2))
    telemetry[`LAMP_${id}_RUNTIME`]    = parseFloat(state.lampRuntimes[i].toFixed(1))
    telemetry[`LAMP_${id}_POWER`]      = state.lampStatuses[i] === 'FAILED' ? 0
      : inLpsFault
        ? parseFloat(noise(state.lampPowers[i] * 0.42, 0.05).toFixed(1))
        : parseFloat(noise(state.lampPowers[i], 0.01).toFixed(1))
  }

  const health: HealthScore = {
    _id: `sim-health-${now}`,
    timestamp: new Date(),
    overall_score: overallScore,
    risk_level: riskLevel as HealthScore['risk_level'],
    month: new Date().getMonth() + 1,
    components: {
      uv_health:        parseFloat(uvHealth.toFixed(1)),
      power_efficiency: parseFloat(powerEff.toFixed(1)),
      lamp_health:      parseFloat(lampHealth.toFixed(1)),
      thermal_health:   parseFloat(thermalHealth.toFixed(1)),
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

  return { latestTelemetry: telemetry as unknown as TelemetryReading, latestHealth: health, recentEvents: events }
}

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
    cipHoursSinceLast: state.cipHoursSinceLast,
    uvDegradationActive: state.uvDegradationActive,
    lpsFailureActive: state.lpsFailureActive,
    cipFailureActive: state.cipFailureActive,
    filterClogActive: state.filterClogActive,
  }
}
