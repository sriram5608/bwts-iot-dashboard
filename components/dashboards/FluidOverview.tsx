'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { dateFnsLocaleMap } from '@/lib/dateFnsLocales'
import { format } from 'date-fns'

interface TelemetryReading {
  timestamp: string
  operation_type?: string
  location?: string
  UVR_INTENSITY?: number
  UVR_POWER_OUTPUT?: number
  UVR_WATER_TEMP?: number
  SYS_FLOW_RATE?: number
  SYS_PRESSURE?: number
  FLT_DIFF_PRESSURE?: number
  FLT_BACKFLUSH_ACTIVE?: boolean
  FLT_BACKFLUSH_COUNT?: number
  [key: string]: string | number | boolean | undefined
}

interface HealthScore {
  overall_score: number
  components?: {
    uv_health?: number
    lamp_health?: number
  }
}

interface Event {
  event_type: string
  description: string
  timestamp: string
}

export default function FluidOverview() {
  const t = useTranslations('FluidOverview')
  const tCommon = useTranslations('Common')
  const locale = useLocale()

  const [data, setData] = useState<{
    latestTelemetry: TelemetryReading | null
    latestHealth: HealthScore | null
    recentEvents: Event[]
  }>({
    latestTelemetry: null,
    latestHealth: null,
    recentEvents: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/stats')
        const stats = await response.json()
        setData({
          latestTelemetry: stats.latestTelemetry,
          latestHealth: stats.latestHealth,
          recentEvents: stats.recentEvents || []
        })
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch data:', error)
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-slate-400 text-lg">{tCommon('loading')}</div>
      </div>
    )
  }

  const { latestTelemetry, latestHealth, recentEvents } = data

  const lamps = Array.from({ length: 16 }, (_, i) => {
    const lampNum = String(i + 1).padStart(2, '0')
    return {
      id: i + 1,
      status: (latestTelemetry?.[`LAMP_${lampNum}_STATUS`] as string) || 'UNKNOWN',
      efficiency: (latestTelemetry?.[`LAMP_${lampNum}_EFFICIENCY`] as number) || 0,
      runtime: (latestTelemetry?.[`LAMP_${lampNum}_RUNTIME`] as number) || 0,
    }
  })

  const lampsAtRisk = lamps
    .filter(l => l.efficiency < 75 || l.runtime > 8000)
    .sort((a, b) => a.efficiency - b.efficiency)
    .slice(0, 3)

  const lampLayout = [[1], [2, 3], [4, 5, 6], [7, 8, 9, 10], [11, 12, 13], [14, 15], [16]]

  const getLampStyle = (efficiency: number, status: string) => {
    if (status === 'FAILED') return { gradient: 'from-red-500 to-red-600', glow: 'rgba(239, 68, 68, 0.4)' }
    if (efficiency >= 90) return { gradient: 'from-green-500 to-green-600', glow: 'rgba(34, 197, 94, 0.4)' }
    if (efficiency >= 70) return { gradient: 'from-yellow-500 to-yellow-600', glow: 'rgba(234, 179, 8, 0.4)' }
    if (efficiency >= 50) return { gradient: 'from-orange-500 to-orange-600', glow: 'rgba(249, 115, 22, 0.4)' }
    return { gradient: 'from-red-500 to-red-600', glow: 'rgba(239, 68, 68, 0.4)' }
  }

  const healthScore = latestHealth?.overall_score || 0
  const alarms = recentEvents.filter(e => e.event_type === 'ALARM_TRIGGERED').slice(0, 3)

  const opTypeMap: Record<string, string> = {
    BALLAST: t('operationTypes.BALLAST'),
    DEBALLAST: t('operationTypes.DEBALLAST'),
  }
  const operationLabel = latestTelemetry?.operation_type
    ? (opTypeMap[latestTelemetry.operation_type] ?? latestTelemetry.operation_type)
    : 'N/A'

  const formatTimestamp = (ts: string) => {
    try {
      return format(new Date(ts), 'MMM d, yyyy HH:mm', { locale: dateFnsLocaleMap[locale] })
    } catch {
      return ts
    }
  }

  const legend = [
    { color: 'from-green-500 to-green-600', label: t('legend90Plus') },
    { color: 'from-yellow-500 to-yellow-600', label: t('legend7090') },
    { color: 'from-orange-500 to-orange-600', label: t('legend5070') },
    { color: 'from-red-500 to-red-600', label: t('legendBelow50') },
  ]

  return (
    <div className="min-h-screen overflow-hidden relative">
      {/* Ambient center glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full"
          style={{ background: 'radial-gradient(circle at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.5) 30%, transparent 60%)' }}
        />
      </div>

      {/* CENTER - Diamond Lamp Grid */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <p className="text-center text-slate-400 text-xs font-medium uppercase tracking-widest mb-5">{t('uvLampArray')}</p>

        <div className="flex flex-col items-center gap-2">
          {lampLayout.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-2 justify-center">
              {row.map((lampId) => {
                const lamp = lamps.find(l => l.id === lampId)
                if (!lamp) return null
                const style = getLampStyle(lamp.efficiency, lamp.status as string)

                return (
                  <div
                    key={lampId}
                    className={`w-14 h-14 rounded-full flex flex-col items-center justify-center cursor-pointer
                                transition-all duration-300 hover:scale-110 hover:z-10
                                bg-gradient-to-br ${style.gradient}`}
                    style={{
                      boxShadow: `0 4px 20px ${style.glow}, inset 0 2px 10px rgba(255,255,255,0.3)`,
                      opacity: Math.max(0.6, lamp.efficiency / 100),
                    }}
                    title={t('lampTooltip', { id: lampId, efficiency: lamp.efficiency.toFixed(1), runtime: lamp.runtime.toFixed(0) })}
                  >
                    <span className="text-white text-xs font-semibold">L{lampId}</span>
                    <span className="text-white/80 text-[10px]">{lamp.efficiency.toFixed(0)}%</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-6">
          {legend.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${item.color}`} />
              <span className="text-slate-400 text-[11px]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* TOP LEFT - Alarms */}
      <div className="fixed top-24 left-8 transition-opacity hover:opacity-100 opacity-90">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${alarms.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{t('activeAlarms')}</span>
        </div>

        {alarms.length === 0 ? (
          <p className="text-slate-500 text-sm pl-4">{t('noActiveAlarms')}</p>
        ) : (
          <div className="space-y-3 pl-4">
            {alarms.map((alarm, i) => (
              <div key={i} className="relative">
                <div className={`absolute -left-4 top-1/2 w-3 h-px ${
                  alarm.description.toLowerCase().includes('critical')
                    ? 'bg-gradient-to-r from-red-400/50 to-transparent'
                    : 'bg-gradient-to-r from-amber-400/50 to-transparent'
                }`} />
                <p className="text-slate-700 text-sm font-medium">{alarm.description}</p>
                <p className="text-slate-400 text-xs">
                  {new Date(alarm.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TOP CENTER - Timestamp */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 text-center transition-opacity hover:opacity-100 opacity-90">
        <p className="text-slate-400 text-[10px] uppercase tracking-wider">{tCommon('lastUpdated')}</p>
        <p className="text-slate-600 text-sm font-medium">
          {latestTelemetry?.timestamp ? formatTimestamp(latestTelemetry.timestamp) : '--'}
        </p>
      </div>

      {/* TOP RIGHT - Health Score */}
      <div className="fixed top-24 right-8 text-right transition-opacity hover:opacity-100 opacity-90">
        <div className="flex items-center gap-2 justify-end mb-6">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{t('systemHealth')}</span>
          <div className={`w-2 h-2 rounded-full ${healthScore >= 80 ? 'bg-emerald-500' : healthScore >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`} />
        </div>

        <div className="relative w-32 h-20 ml-auto">
          <svg viewBox="0 0 100 60" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <path d="M 5 50 A 40 40 0 0 1 95 50" fill="none" stroke="#e2e8f0" strokeWidth="6" strokeLinecap="round" />
            <path
              d="M 5 50 A 40 40 0 0 1 95 50"
              fill="none"
              stroke={healthScore >= 80 ? '#22c55e' : healthScore >= 60 ? '#3b82f6' : '#f97316'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(healthScore / 100) * 132} 132`}
            />
          </svg>
        </div>

        <p className={`text-4xl font-light -mt-2 ${
          healthScore >= 80 ? 'text-emerald-600' : healthScore >= 60 ? 'text-blue-600' : 'text-orange-500'
        }`}>
          {healthScore.toFixed(1)}<span className="text-lg">{tCommon('unitPercent')}</span>
        </p>
        <p className="text-slate-400 text-xs">{tCommon('overallScore')}</p>
      </div>

      {/* LEFT SIDE - Key Metrics */}
      <div className="fixed left-8 top-[55%] -translate-y-1/2 transition-opacity hover:opacity-100 opacity-90">
        <div className="space-y-10">
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('uvIntensity')}</p>
            <p className="text-3xl font-light text-purple-600">{latestTelemetry?.UVR_INTENSITY?.toFixed(1) || '--'}</p>
            <p className="text-slate-400 text-xs">{tCommon('unitWm2')}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('powerOutput')}</p>
            <p className="text-3xl font-light text-orange-500">{latestTelemetry?.UVR_POWER_OUTPUT?.toFixed(1) || '--'}<span className="text-lg">{tCommon('unitPercent')}</span></p>
            <p className="text-slate-400 text-xs">{t('lpsCapacity')}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('flowRate')}</p>
            <p className="text-3xl font-light text-blue-500">{latestTelemetry?.SYS_FLOW_RATE?.toFixed(0) || '--'}</p>
            <p className="text-slate-400 text-xs">{tCommon('unitM3h')}</p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Operation */}
      <div className="fixed right-8 top-[55%] -translate-y-1/2 text-right transition-opacity hover:opacity-100 opacity-90">
        <div className="space-y-10">
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('operation')}</p>
            <p className="text-xl font-medium text-slate-700">{operationLabel}</p>
            <p className="text-slate-400 text-xs">{t('inProgress')}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('location')}</p>
            <p className="text-xl font-medium text-slate-700">{latestTelemetry?.location?.split(',')[0] || 'N/A'}</p>
            <p className="text-slate-400 text-xs">{latestTelemetry?.location?.split(',')[1]?.trim() || ''}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('temperature')}</p>
            <p className="text-3xl font-light text-slate-600">{latestTelemetry?.UVR_WATER_TEMP?.toFixed(1) || '--'}{tCommon('unitDegree')}</p>
            <p className="text-slate-400 text-xs">{t('waterTemp')}</p>
          </div>
        </div>
      </div>

      {/* BOTTOM LEFT - Lamps at Risk */}
      <div className="fixed bottom-8 left-8 transition-opacity hover:opacity-100 opacity-90">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${lampsAtRisk.length > 0 ? 'bg-orange-500' : 'bg-emerald-500'}`} />
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{t('maintenanceRequired')}</span>
        </div>

        {lampsAtRisk.length === 0 ? (
          <p className="text-emerald-600 text-sm">{t('allLampsHealthy')}</p>
        ) : (
          <div className="flex gap-4">
            {lampsAtRisk.map((lamp) => {
              const style = getLampStyle(lamp.efficiency, lamp.status as string)
              return (
                <div key={lamp.id} className="text-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold mx-auto mb-1 bg-gradient-to-br ${style.gradient}`}
                    style={{ boxShadow: `0 2px 10px ${style.glow}` }}
                  >
                    L{lamp.id}
                  </div>
                  <p className="text-slate-600 text-xs font-medium">{lamp.efficiency.toFixed(0)}{tCommon('unitPercent')}</p>
                  <p className="text-slate-400 text-[10px]">{lamp.runtime.toFixed(0)}h</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* BOTTOM CENTER - System Pressure */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-center transition-opacity hover:opacity-100 opacity-90">
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('systemPressure')}</p>
        <p className="text-4xl font-light text-slate-600">
          {latestTelemetry?.SYS_PRESSURE?.toFixed(2) || '--'} <span className="text-lg">{tCommon('unitBar')}</span>
        </p>
      </div>

      {/* BOTTOM RIGHT - Filter System */}
      <div className="fixed bottom-8 right-8 text-right transition-opacity hover:opacity-100 opacity-90">
        <div className="flex items-center gap-2 justify-end mb-3">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{t('filterSystem')}</span>
          <div className={`w-2 h-2 rounded-full ${latestTelemetry?.FLT_BACKFLUSH_ACTIVE ? 'bg-orange-500' : 'bg-emerald-500'}`} />
        </div>

        <div className="flex gap-6 justify-end">
          <div className="text-center">
            <p className="text-2xl font-light text-slate-600">{latestTelemetry?.FLT_DIFF_PRESSURE?.toFixed(2) || '--'}</p>
            <p className="text-slate-400 text-[10px]">{t('deltaPBar')}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-light text-slate-600">{latestTelemetry?.FLT_BACKFLUSH_COUNT || '--'}</p>
            <p className="text-slate-400 text-[10px]">{t('backflush')}</p>
          </div>
          <div className="text-center">
            <p className={`text-sm font-medium px-2 py-1 rounded-full ${
              latestTelemetry?.FLT_BACKFLUSH_ACTIVE
                ? 'text-orange-600 bg-orange-50'
                : 'text-emerald-600 bg-emerald-50'
            }`}>
              {latestTelemetry?.FLT_BACKFLUSH_ACTIVE ? t('filterStatusActive') : t('filterStatusIdle')}
            </p>
            <p className="text-slate-400 text-[10px] mt-1">{tCommon('status')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
