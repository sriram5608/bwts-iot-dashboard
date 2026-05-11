'use client'

import { useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip,
} from 'recharts'
import { useDemoMode } from '@/lib/demo-context'
import { computeAnalysisScores, type AnalysisScore } from '@/lib/simulation/alert-engine'
import { AlertTriangle, CheckCircle, Activity } from 'lucide-react'

interface Reading {
  time: string
  uv: number
  flow: number
  filterDp: number
  lampEff: number
}

interface LampSnapshot {
  id: number
  efficiency: number
  status: string
}

interface HealthSegment {
  time: string
  level: 'NORMAL' | 'WARNING' | 'CRITICAL'
}

export default function AnalysisTab() {
  const t = useTranslations('AnalysisTab')
  const { isDemoMode } = useDemoMode()

  const [history, setHistory] = useState<Reading[]>([])
  const [lamps, setLamps] = useState<LampSnapshot[]>([])
  const [scores, setScores] = useState<AnalysisScore[]>([])
  const [healthTimeline, setHealthTimeline] = useState<HealthSegment[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const fetchAndProcess = async () => {
      try {
        const url = isDemoMode ? '/api/stats?source=demo' : '/api/stats'
        const res = await fetch(url)
        const stats = await res.json()
        const t = stats.latestTelemetry
        if (!t) return

        const timeLabel = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

        const reading: Reading = {
          time: timeLabel,
          uv: parseFloat((t.UVR_INTENSITY || 0).toFixed(1)),
          flow: parseFloat((t.SYS_FLOW_RATE || 0).toFixed(1)),
          filterDp: parseFloat((t.FLT_DIFF_PRESSURE || 0).toFixed(3)),
          lampEff: parseFloat((t.AVG_LAMP_EFFICIENCY || 0).toFixed(1)),
        }

        setHistory(prev => {
          const updated = [...prev, reading]
          return updated.slice(-30)
        })

        const lampSnaps: LampSnapshot[] = Array.from({ length: 16 }, (_, i) => {
          const id = String(i + 1).padStart(2, '0')
          return {
            id: i + 1,
            efficiency: (t[`LAMP_${id}_EFFICIENCY`] as number) || 0,
            status: (t[`LAMP_${id}_STATUS`] as string) || 'OK',
          }
        })
        setLamps(lampSnaps)

        if (isDemoMode) {
          const s = computeAnalysisScores({
            uvIntensity: t.UVR_INTENSITY || 0,
            flowRate: t.SYS_FLOW_RATE || 0,
            filterPressure: t.FLT_DIFF_PRESSURE || 0,
            lampEfficiency: t.AVG_LAMP_EFFICIENCY || 0,
          })
          setScores(s)

          // Health timeline segment
          const hasCritical = s.some(x => x.isAlerting && x.parameter === 'UV Intensity')
          const hasWarning = s.some(x => x.isAlerting)
          const level: HealthSegment['level'] = hasCritical ? 'CRITICAL' : hasWarning ? 'WARNING' : 'NORMAL'
          setHealthTimeline(prev => {
            const updated = [...prev, { time: timeLabel, level }]
            return updated.slice(-60)
          })
        }

        setLoading(false)
      } catch {
        setLoading(false)
      }
    }

    fetchAndProcess()
    intervalRef.current = setInterval(fetchAndProcess, isDemoMode ? 2000 : 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode])

  const getLampColor = (eff: number, status: string) => {
    if (status === 'FAILED') return 'bg-red-500 text-white'
    if (eff >= 90) return 'bg-emerald-500 text-white'
    if (eff >= 70) return 'bg-yellow-500 text-white'
    if (eff >= 50) return 'bg-orange-500 text-white'
    return 'bg-red-500 text-white'
  }

  const getSegmentColor = (level: HealthSegment['level']) => {
    if (level === 'CRITICAL') return 'bg-red-500'
    if (level === 'WARNING') return 'bg-yellow-500'
    return 'bg-emerald-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-lg">{t('loading')}</div>
      </div>
    )
  }

  if (!isDemoMode) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Activity className="w-10 h-10 text-slate-300" />
        <p className="text-slate-400 text-sm">{t('enableDemoMode')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-8">
        {/* Section 1: Real-time Parameter Charts */}
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">{t('parameterCharts')}</p>
          <div className="space-y-4">
            {/* UV Intensity */}
            <div className="bg-white/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs">{t('uvIntensity')}</span>
                <span className={`text-sm font-medium ${(history[history.length - 1]?.uv || 0) >= 380 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {history[history.length - 1]?.uv || '-'} W/m²
                </span>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={history}>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[200, 800]} hide />
                  <Tooltip
                    contentStyle={{ fontSize: 11, background: 'rgba(255,255,255,0.9)', border: '1px solid #e2e8f0' }}
                    formatter={(v: number | undefined) => [v != null ? `${v} W/m²` : '-', 'UV']}
                  />
                  <ReferenceLine y={380} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'IMO', position: 'right', fontSize: 9, fill: '#ef4444' }} />
                  <ReferenceLine y={772} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'USCG', position: 'right', fontSize: 9, fill: '#f97316' }} />
                  <Line type="monotone" dataKey="uv" stroke="#06b6d4" dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Flow Rate */}
            <div className="bg-white/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs">{t('flowRate')}</span>
                <span className="text-sm font-medium text-blue-600">
                  {history[history.length - 1]?.flow || '-'} m³/h
                </span>
              </div>
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={history}>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 600]} hide />
                  <Tooltip
                    contentStyle={{ fontSize: 11, background: 'rgba(255,255,255,0.9)', border: '1px solid #e2e8f0' }}
                    formatter={(v: number | undefined) => [v != null ? `${v} m³/h` : '-', 'Flow']}
                  />
                  <ReferenceLine y={165} stroke="#f59e0b" strokeDasharray="2 2" strokeWidth={1} />
                  <Line type="monotone" dataKey="flow" stroke="#3b82f6" dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Filter ΔP */}
            <div className="bg-white/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs">{t('filterDp')}</span>
                <span className={`text-sm font-medium ${(history[history.length - 1]?.filterDp || 0) > 0.50 ? 'text-orange-500' : 'text-slate-600'}`}>
                  {history[history.length - 1]?.filterDp?.toFixed(3) || '-'} bar
                </span>
              </div>
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={history}>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 1]} hide />
                  <Tooltip
                    contentStyle={{ fontSize: 11, background: 'rgba(255,255,255,0.9)', border: '1px solid #e2e8f0' }}
                    formatter={(v: number | undefined) => [v != null ? `${v.toFixed(3)} bar` : '-', 'Filter ΔP']}
                  />
                  <ReferenceLine y={0.50} stroke="#f59e0b" strokeDasharray="2 2" strokeWidth={1} />
                  <Line type="monotone" dataKey="filterDp" stroke="#a78bfa" dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Section 2: Anomaly Detection Scores */}
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">{t('anomalyScores')}</p>
          <div className="bg-white/30 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/40 text-slate-400 uppercase text-[9px] tracking-wider">
                  <th className="text-left px-4 py-2">{t('tableParameter')}</th>
                  <th className="text-right px-3 py-2">{t('tableCurrent')}</th>
                  <th className="text-right px-3 py-2">{t('tableDeviation')}</th>
                  <th className="text-right px-3 py-2">{t('tableRate')}</th>
                  <th className="text-right px-3 py-2">{t('tableTimeToAlert')}</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score, i) => (
                  <tr
                    key={i}
                    className={`border-t border-white/20 transition-colors ${score.isAlerting ? 'bg-red-50/60' : 'hover:bg-white/20'}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        {score.isAlerting
                          ? <AlertTriangle className="w-3 h-3 text-red-500" />
                          : <CheckCircle className="w-3 h-3 text-emerald-500" />}
                        {score.parameter}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600">
                      {score.current.toFixed(score.unit === 'bar' ? 3 : 1)} {score.unit}
                    </td>
                    <td className={`px-3 py-3 text-right font-medium ${score.deviation < -5 ? 'text-red-500' : score.deviation > 10 ? 'text-orange-500' : 'text-slate-500'}`}>
                      {score.deviation > 0 ? '+' : ''}{score.deviation.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right text-slate-500">
                      {score.ratePerMin === 0 ? '—' : `${score.ratePerMin > 0 ? '+' : ''}${score.ratePerMin.toFixed(2)}/min`}
                    </td>
                    <td className={`px-3 py-3 text-right font-medium ${score.isAlerting ? 'text-red-500' : score.timeToAlert < 5 ? 'text-orange-500' : score.timeToAlert < 15 ? 'text-yellow-600' : 'text-slate-400'}`}>
                      {score.isAlerting ? t('alerting')
                        : isFinite(score.timeToAlert) ? `${score.timeToAlert.toFixed(1)} min`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 3: Health Timeline */}
          <div className="mt-6">
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-3">{t('healthTimeline')}</p>
            <div className="bg-white/30 rounded-xl p-4">
              {healthTimeline.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-4">{t('timelineWaiting')}</p>
              ) : (
                <div className="flex gap-0.5 h-8 rounded-lg overflow-hidden">
                  {healthTimeline.map((seg, i) => (
                    <div
                      key={i}
                      className={`flex-1 ${getSegmentColor(seg.level)} transition-colors`}
                      title={`${seg.time} — ${seg.level}`}
                    />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 mt-2 justify-end">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-500" /><span className="text-[10px] text-slate-400">{t('levelNormal')}</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-500" /><span className="text-[10px] text-slate-400">{t('levelWarning')}</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500" /><span className="text-[10px] text-slate-400">{t('levelCritical')}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Lamp Status Heatmap */}
      <div>
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">{t('lampHeatmap')}</p>
        <div className="grid grid-cols-8 gap-2">
          {lamps.map(lamp => (
            <div
              key={lamp.id}
              className={`rounded-lg p-2 text-center ${getLampColor(lamp.efficiency, lamp.status)}`}
              title={`Lamp ${lamp.id}: ${lamp.status} — ${lamp.efficiency.toFixed(1)}%`}
            >
              <p className="text-[10px] font-medium opacity-80">{t('lampLabel', { id: lamp.id })}</p>
              {lamp.status === 'FAILED' ? (
                <p className="text-sm font-bold">✕</p>
              ) : (
                <p className="text-sm font-bold">{lamp.efficiency.toFixed(0)}%</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
