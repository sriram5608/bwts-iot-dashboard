/**
 * Builds a SELECT column list that aliases PostgreSQL column names
 * (e.g. LAMP01STATUS) to the frontend-expected format (LAMP_01_STATUS).
 */
export function buildTelemetrySelect(): string {
  const cols: string[] = [
    'timestamp',
    '"systemId" AS "system_id"',
    '"operationType" AS "operation_type"',
    'location',
    'month',
    // UV system
    '"UVRINTENSITY" AS "UVR_INTENSITY"',
    '"UVRINTENSITYNORMALIZED" AS "UVR_INTENSITY_NORMALIZED"',
    '"UVRPOWEROUTPUT" AS "UVR_POWER_OUTPUT"',
    '"UVRPOWERSETPOINT" AS "UVR_POWER_SETPOINT"',
    '"UVRWATERTEMP" AS "UVR_WATER_TEMP"',
    '"UVRLEVEL" AS "UVR_LEVEL"',
    // LDC
    '"LDCAIRTEMP" AS "LDC_AIR_TEMP"',
    '"LDCFANSPEED" AS "LDC_FAN_SPEED"',
    '"LDCFANSTATUS" AS "LDC_FAN_STATUS"',
    '"LDCWATERALARM" AS "LDC_WATER_ALARM"',
    // Filter
    '"FLTDIFFPRESSURE" AS "FLT_DIFF_PRESSURE"',
    '"FLTMOTORSTATUS" AS "FLT_MOTOR_STATUS"',
    '"FLTBACKFLUSHACTIVE" AS "FLT_BACKFLUSH_ACTIVE"',
    '"FLTBACKFLUSHCOUNT" AS "FLT_BACKFLUSH_COUNT"',
    // Flow & pressure
    '"SYSFLOWRATE" AS "SYS_FLOW_RATE"',
    '"SYSPRESSURE" AS "SYS_PRESSURE"',
    '"SYSVALVEPOSITION" AS "SYS_VALVE_POSITION"',
    '"SYSTOTALBALLASTVOL" AS "SYS_TOTAL_BALLAST_VOL"',
    '"SYSTOTALDEBALLASTVOL" AS "SYS_TOTAL_DEBALLAST_VOL"',
    '"SYSEXTERNALFEED" AS "SYS_EXTERNAL_FEED"',
    // CIP
    '"CIPHOURSSINCELAST" AS "CIP_HOURS_SINCE_LAST"',
    // PLC
    '"PLCCPUUSAGE" AS "PLC_CPU_USAGE"',
    '"PLCRAMUSAGE" AS "PLC_RAM_USAGE"',
    '"PLCCPUTEMP" AS "PLC_CPU_TEMP"',
    // Process state
    '"PROCESSSTATE" AS "PROCESS_STATE"',
    '"COMPLIANCEMODE" AS "COMPLIANCE_MODE"',
    '"WATERQUALITY" AS "WATER_QUALITY"',
    '"WATERQUALITYFACTOR" AS "WATER_QUALITY_FACTOR"',
    // Lamp summary
    '"AVGLAMPEFFICIENCY" AS "AVG_LAMP_EFFICIENCY"',
    '"FAILEDLAMPCOUNT" AS "FAILED_LAMP_COUNT"',
    '"DEGRADATIONIMPACTPCT" AS "DEGRADATION_IMPACT_PCT"',
    '"POWERCOMPENSATIONPCT" AS "POWER_COMPENSATION_PCT"',
  ]
  for (let i = 1; i <= 16; i++) {
    const id = String(i).padStart(2, '0')
    cols.push(`"LAMP${id}STATUS" AS "LAMP_${id}_STATUS"`)
    cols.push(`"LAMP${id}EFFICIENCY" AS "LAMP_${id}_EFFICIENCY"`)
    cols.push(`"LAMP${id}RUNTIME" AS "LAMP_${id}_RUNTIME"`)
    cols.push(`"LAMP${id}POWER" AS "LAMP_${id}_POWER"`)
  }
  return cols.join(', ')
}
