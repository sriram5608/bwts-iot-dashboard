'use client'

import { useEffect, useState } from 'react'

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
  [key: string]: any
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
        <div className="text-slate-400 text-lg">Loading...</div>
      </div>
    )
  }

  const { latestTelemetry, latestHealth, recentEvents } = data

  // Get lamp data
  const lamps = Array.from({ length: 16 }, (_, i) => {
    const lampNum = String(i + 1).padStart(2, '0')
    return {
      id: i + 1,
      status: latestTelemetry?.[`LAMP_${lampNum}_STATUS`] || 'UNKNOWN',
      efficiency: (latestTelemetry?.[`LAMP_${lampNum}_EFFICIENCY`] as number) || 0,
      runtime: (latestTelemetry?.[`LAMP_${lampNum}_RUNTIME`] as number) || 0,
    }
  })

  // Lamps needing attention
  const lampsAtRisk = lamps
    .filter(l => l.efficiency < 75 || l.runtime > 8000)
    .sort((a, b) => a.efficiency - b.efficiency)
    .slice(0, 3)

  // Diamond layout
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

  return (
    <div className="min-h-screen overflow-hidden relative">
      {/* Ambient center glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full"
          style={{ background: 'radial-gradient(circle at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.5) 30%, transparent 60%)' }}
        />
      </div>

      {/* ============ FIXED CENTER - Diamond Lamp Grid ============ */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <p className="text-center text-slate-400 text-xs font-medium uppercase tracking-widest mb-5">UV Lamp Array</p>
        
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
                    title={`Lamp ${lampId}: ${lamp.efficiency.toFixed(1)}% | ${lamp.runtime.toFixed(0)}h runtime`}
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
          {[
            { color: 'from-green-500 to-green-600', label: '90%+' },
            { color: 'from-yellow-500 to-yellow-600', label: '70-90%' },
            { color: 'from-orange-500 to-orange-600', label: '50-70%' },
            { color: 'from-red-500 to-red-600', label: '<50%' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${item.color}`} />
              <span className="text-slate-400 text-[11px]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ============ SURROUNDING DATA - All Fixed Position ============ */}

      {/* TOP LEFT - Alarms */}
      <div className="fixed top-24 left-8 transition-opacity hover:opacity-100 opacity-90">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${alarms.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Active Alarms</span>
        </div>
        
        {alarms.length === 0 ? (
          <p className="text-slate-500 text-sm pl-4">No active alarms</p>
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
                  {new Date(alarm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TOP CENTER - Timestamp */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 text-center transition-opacity hover:opacity-100 opacity-90">
        <p className="text-slate-400 text-[10px] uppercase tracking-wider">Last Updated</p>
        <p className="text-slate-600 text-sm font-medium">
          {latestTelemetry?.timestamp 
            ? new Date(latestTelemetry.timestamp).toLocaleString([], { 
                month: 'short', day: 'numeric', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            : '--'
          }
        </p>
      </div>

      {/* TOP RIGHT - Health Score */}
      <div className="fixed top-24 right-8 text-right transition-opacity hover:opacity-100 opacity-90">
        <div className="flex items-center gap-2 justify-end mb-6">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">System Health</span>
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
          {healthScore.toFixed(1)}<span className="text-lg">%</span>
        </p>
        <p className="text-slate-400 text-xs">Overall Score</p>
      </div>

      {/* LEFT SIDE - Key Metrics (Vertically Centered) */}
      <div className="fixed left-8 top-[55%] -translate-y-1/2 transition-opacity hover:opacity-100 opacity-90">
        <div className="space-y-10">
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">UV Intensity</p>
            <p className="text-3xl font-light text-purple-600">{latestTelemetry?.UVR_INTENSITY?.toFixed(1) || '--'}</p>
            <p className="text-slate-400 text-xs">W/m²</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Power Output</p>
            <p className="text-3xl font-light text-orange-500">{latestTelemetry?.UVR_POWER_OUTPUT?.toFixed(1) || '--'}<span className="text-lg">%</span></p>
            <p className="text-slate-400 text-xs">LPS capacity</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Flow Rate</p>
            <p className="text-3xl font-light text-blue-500">{latestTelemetry?.SYS_FLOW_RATE?.toFixed(0) || '--'}</p>
            <p className="text-slate-400 text-xs">m³/h</p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Operation (Vertically Centered) */}
      <div className="fixed right-8 top-[55%] -translate-y-1/2 text-right transition-opacity hover:opacity-100 opacity-90">
        <div className="space-y-10">
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Operation</p>
            <p className="text-xl font-medium text-slate-700">{latestTelemetry?.operation_type || 'N/A'}</p>
            <p className="text-slate-400 text-xs">In progress</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Location</p>
            <p className="text-xl font-medium text-slate-700">{latestTelemetry?.location?.split(',')[0] || 'N/A'}</p>
            <p className="text-slate-400 text-xs">{latestTelemetry?.location?.split(',')[1]?.trim() || ''}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Temperature</p>
            <p className="text-3xl font-light text-slate-600">{latestTelemetry?.UVR_WATER_TEMP?.toFixed(1) || '--'}°</p>
            <p className="text-slate-400 text-xs">Water temp</p>
          </div>
        </div>
      </div>

      {/* BOTTOM LEFT - Lamps at Risk */}
      <div className="fixed bottom-8 left-8 transition-opacity hover:opacity-100 opacity-90">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${lampsAtRisk.length > 0 ? 'bg-orange-500' : 'bg-emerald-500'}`} />
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Maintenance Required</span>
        </div>
        
        {lampsAtRisk.length === 0 ? (
          <p className="text-emerald-600 text-sm">All lamps healthy</p>
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
                  <p className="text-slate-600 text-xs font-medium">{lamp.efficiency.toFixed(0)}%</p>
                  <p className="text-slate-400 text-[10px]">{lamp.runtime.toFixed(0)}h</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* BOTTOM CENTER - System Pressure */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-center transition-opacity hover:opacity-100 opacity-90">
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">System Pressure</p>
        <p className="text-4xl font-light text-slate-600">
          {latestTelemetry?.SYS_PRESSURE?.toFixed(2) || '--'} <span className="text-lg">bar</span>
        </p>
      </div>

      {/* BOTTOM RIGHT - Filter System */}
      <div className="fixed bottom-8 right-8 text-right transition-opacity hover:opacity-100 opacity-90">
        <div className="flex items-center gap-2 justify-end mb-3">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Filter System</span>
          <div className={`w-2 h-2 rounded-full ${latestTelemetry?.FLT_BACKFLUSH_ACTIVE ? 'bg-orange-500' : 'bg-emerald-500'}`} />
        </div>
        
        <div className="flex gap-6 justify-end">
          <div className="text-center">
            <p className="text-2xl font-light text-slate-600">{latestTelemetry?.FLT_DIFF_PRESSURE?.toFixed(2) || '--'}</p>
            <p className="text-slate-400 text-[10px]">ΔP bar</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-light text-slate-600">{latestTelemetry?.FLT_BACKFLUSH_COUNT || '--'}</p>
            <p className="text-slate-400 text-[10px]">Backflush</p>
          </div>
          <div className="text-center">
            <p className={`text-sm font-medium px-2 py-1 rounded-full ${
              latestTelemetry?.FLT_BACKFLUSH_ACTIVE 
                ? 'text-orange-600 bg-orange-50' 
                : 'text-emerald-600 bg-emerald-50'
            }`}>
              {latestTelemetry?.FLT_BACKFLUSH_ACTIVE ? 'Active' : 'Idle'}
            </p>
            <p className="text-slate-400 text-[10px] mt-1">Status</p>
          </div>
        </div>
      </div>
    </div>
  )
}
