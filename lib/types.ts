export interface TelemetryReading {
  _id: string
  timestamp: Date
  system_id: string
  operation_type: 'BALLAST' | 'DEBALLAST'
  location: string
  month: number

  // UV System
  UVR_INTENSITY: number
  UVR_INTENSITY_NORMALIZED: number
  UVR_POWER_OUTPUT: number
  UVR_WATER_TEMP: number
  UVR_LEVEL: string

  // LDC
  LDC_AIR_TEMP: number
  LDC_FAN_SPEED: number
  LDC_FAN_STATUS: string

  // Filter
  FLT_DIFF_PRESSURE: number
  FLT_MOTOR_STATUS: string
  FLT_BACKFLUSH_ACTIVE: boolean
  FLT_BACKFLUSH_COUNT: number

  // Flow & Pressure
  SYS_FLOW_RATE: number
  SYS_PRESSURE: number
  SYS_VALVE_POSITION: number
  SYS_TOTAL_BALLAST_VOL: number
  SYS_TOTAL_DEBALLAST_VOL: number

  // System health
  AVG_LAMP_EFFICIENCY: number
  FAILED_LAMP_COUNT: number
  DEGRADATION_IMPACT_PCT: number
  POWER_COMPENSATION_PCT: number

  // Individual lamps (LAMP_01 through LAMP_16)
  [key: `LAMP_${string}_STATUS`]: string
  [key: `LAMP_${string}_POWER`]: number
  [key: `LAMP_${string}_RUNTIME`]: number
  [key: `LAMP_${string}_EFFICIENCY`]: number
  // Allow dynamic string indexing for lamp fields
  [key: string]: string | number | boolean | Date | undefined
}

export interface HealthScore {
  _id: string
  timestamp: Date
  overall_score: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  month: number
  components: {
    uv_health: number
    power_efficiency: number
    lamp_health: number
    thermal_health: number
  }
}

export interface Prediction {
  _id: string
  timestamp: Date
  component_id: string
  component_type: string
  month: number
  predictions: {
    remaining_useful_life_hours: number
    failure_probability: number
    efficiency_percent: number
  }
  current_state: {
    runtime_hours: number
    efficiency_percent: number
  }
}

export interface Event {
  _id: string
  timestamp: Date
  event_type: 'PROCESS_START' | 'PROCESS_STOP' | 'ALARM_TRIGGERED'
  description: string
  month: number
  data: any
}

export interface LampStatus {
  id: number
  status: string
  power: number
  runtime: number
  efficiency: number
}

// Aggregated telemetry for progressive loading
export interface AggregatedTelemetry {
  timestamp: Date
  UVR_INTENSITY: number
  UVR_POWER_OUTPUT: number
  SYS_FLOW_RATE: number
  SYS_PRESSURE: number
  AVG_LAMP_EFFICIENCY: number
  SYS_TEMP?: number

  // Per-lamp efficiencies
  LAMP_01_EFFICIENCY: number
  LAMP_02_EFFICIENCY: number
  LAMP_03_EFFICIENCY: number
  LAMP_04_EFFICIENCY: number
  LAMP_05_EFFICIENCY: number
  LAMP_06_EFFICIENCY: number
  LAMP_07_EFFICIENCY: number
  LAMP_08_EFFICIENCY: number
  LAMP_09_EFFICIENCY: number
  LAMP_10_EFFICIENCY: number
  LAMP_11_EFFICIENCY: number
  LAMP_12_EFFICIENCY: number
  LAMP_13_EFFICIENCY: number
  LAMP_14_EFFICIENCY: number
  LAMP_15_EFFICIENCY: number
  LAMP_16_EFFICIENCY: number

  // Per-lamp power
  LAMP_01_POWER: number
  LAMP_02_POWER: number
  LAMP_03_POWER: number
  LAMP_04_POWER: number
  LAMP_05_POWER: number
  LAMP_06_POWER: number
  LAMP_07_POWER: number
  LAMP_08_POWER: number
  LAMP_09_POWER: number
  LAMP_10_POWER: number
  LAMP_11_POWER: number
  LAMP_12_POWER: number
  LAMP_13_POWER: number
  LAMP_14_POWER: number
  LAMP_15_POWER: number
  LAMP_16_POWER: number

  // Per-lamp runtime
  LAMP_01_RUNTIME: number
  LAMP_02_RUNTIME: number
  LAMP_03_RUNTIME: number
  LAMP_04_RUNTIME: number
  LAMP_05_RUNTIME: number
  LAMP_06_RUNTIME: number
  LAMP_07_RUNTIME: number
  LAMP_08_RUNTIME: number
  LAMP_09_RUNTIME: number
  LAMP_10_RUNTIME: number
  LAMP_11_RUNTIME: number
  LAMP_12_RUNTIME: number
  LAMP_13_RUNTIME: number
  LAMP_14_RUNTIME: number
  LAMP_15_RUNTIME: number
  LAMP_16_RUNTIME: number

  operation_type?: string
  location?: string
  recordCount: number // Number of raw records aggregated into this bucket
}

// Generic chunked response for paginated data
export interface ChunkedResponse<T> {
  data: T[]
  pagination: {
    offset: number
    limit: number
    total: number
    hasMore: boolean
  }
}

// Loading states for progressive data loading
export type LoadingStage = 'initial' | 'streaming' | 'complete'
