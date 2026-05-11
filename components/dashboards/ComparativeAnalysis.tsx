'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts'
import { TrendingUp, Clock, Zap, Calendar } from 'lucide-react'
import { LoadingStage, ChunkedResponse, TelemetryReading } from '@/lib/types'
import { LOADING_CONFIG } from '@/lib/constants'

interface HourlyGroup {
  date: string
  timestamp: number
  lamp1Values: number[]
  lamp2Values: number[]
  allLampValues: number[]
}

interface LampComparisonData {
  date: string
  lamp1: number
  lamp2: number
  avgAll: number
}

export default function ComparativeAnalysis() {
  const t = useTranslations('ComparativeAnalysis')
  const tCommon = useTranslations('Common')
  const locale = useLocale()

  const [lamp1, setLamp1] = useState(1)
  const [lamp2, setLamp2] = useState(16)
  const [telemetryData, setTelemetryData] = useState<TelemetryReading[]>([])
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('initial')
  const [streamProgress, setStreamProgress] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Initialize date range based on actual data
  useEffect(() => {
    const initializeDates = async () => {
      try {
        const response = await fetch('/api/telemetry/latest')
        const latest = await response.json()
        const latestDate = new Date(latest.timestamp)

        const oneMonthAgo = new Date(latestDate)
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

        setStartDate(oneMonthAgo.toISOString().split('T')[0])
        setEndDate(latestDate.toISOString().split('T')[0])
      } catch (error) {
        console.error('Error initializing dates:', error)
        const today = new Date()
        const oneMonthAgo = new Date(today)
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
        setStartDate(oneMonthAgo.toISOString().split('T')[0])
        setEndDate(today.toISOString().split('T')[0])
      }
    }

    initializeDates()
  }, [])

  // Stage 1: Load aggregated data (instant)
  useEffect(() => {
    if (!startDate || !endDate) return

    const fetchInitialData = async () => {
      try {
        setLoadingStage('initial')
        setStreamProgress(0)

        const start = new Date(startDate)
        const end = new Date(endDate)

        const response = await fetch(`/api/telemetry/aggregated?interval=day&startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
        const aggregatedData = await response.json()

        setTelemetryData(aggregatedData)
        setLoadingStage('streaming')
      } catch (error) {
        console.error('Error fetching initial data:', error)
        setLoadingStage('complete')
      }
    }

    fetchInitialData()
  }, [startDate, endDate])

  // Stage 2: Background stream raw data
  useEffect(() => {
    if (loadingStage !== 'streaming' || !startDate || !endDate) return

    const streamDetailedData = async () => {
      try {
        const start = new Date(startDate)
        const end = new Date(endDate)

        const chunkSize = LOADING_CONFIG.CHUNK_SIZE
        let offset = 0
        let hasMore = true

        while (hasMore) {
          const response = await fetch(
            `/api/telemetry/chunked?startDate=${start.toISOString()}&endDate=${end.toISOString()}&offset=${offset}&limit=${chunkSize}`
          )
          const chunk: ChunkedResponse<TelemetryReading> = await response.json()

          if (chunk.data && chunk.data.length > 0) {
            setTelemetryData(prevData => {
              const chunkStart = new Date(chunk.data[0]?.timestamp)
              const chunkEnd = new Date(chunk.data[chunk.data.length - 1]?.timestamp)

              const filtered = prevData.filter(d => {
                const timestamp = new Date(d.timestamp)
                return timestamp < chunkStart || timestamp > chunkEnd
              })

              return [...filtered, ...chunk.data].sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              )
            })
          }

          const progress = chunk.pagination ? (chunk.pagination.offset + chunk.pagination.limit) / chunk.pagination.total * 100 : 100
          setStreamProgress(Math.min(progress, 100))

          offset += chunkSize
          hasMore = chunk.pagination?.hasMore || false

          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, LOADING_CONFIG.STREAM_DELAY))
          }
        }

        setLoadingStage('complete')
        setStreamProgress(100)
      } catch (error) {
        console.error('Error streaming detailed data:', error)
        setLoadingStage('complete')
      }
    }

    streamDetailedData()
  }, [loadingStage, startDate, endDate])

  const daysAnalyzed = useMemo(() => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }, [startDate, endDate])

  const lampComparison = useMemo(() => {
    if (telemetryData.length === 0) return []

    const hourlyGroups: Record<string, HourlyGroup> = {}

    telemetryData.forEach((item) => {
      const timestamp = new Date(item.timestamp)
      const hourKey = `${timestamp.getMonth() + 1}/${timestamp.getDate()} ${timestamp.getHours()}:00`
      const displayDate = timestamp.toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        hour12: false
      })

      if (!hourlyGroups[hourKey]) {
        hourlyGroups[hourKey] = {
          date: displayDate,
          timestamp: timestamp.getTime(),
          lamp1Values: [],
          lamp2Values: [],
          allLampValues: []
        }
      }

      const lamp1Key = `LAMP_${String(lamp1).padStart(2, '0')}_EFFICIENCY`
      const lamp2Key = `LAMP_${String(lamp2).padStart(2, '0')}_EFFICIENCY`

      const lamp1Val = item[lamp1Key]
      const lamp2Val = item[lamp2Key]
      if (lamp1Val !== undefined && typeof lamp1Val === 'number') hourlyGroups[hourKey].lamp1Values.push(lamp1Val)
      if (lamp2Val !== undefined && typeof lamp2Val === 'number') hourlyGroups[hourKey].lamp2Values.push(lamp2Val)

      let lampSum = 0, lampCount = 0
      for (let i = 1; i <= 16; i++) {
        const key = `LAMP_${String(i).padStart(2, '0')}_EFFICIENCY`
        const val = item[key]
        if (val !== undefined && typeof val === 'number') { lampSum += val; lampCount++ }
      }
      if (lampCount > 0) hourlyGroups[hourKey].allLampValues.push(lampSum / lampCount)
    })

    const comparisonData: LampComparisonData[] = Object.values(hourlyGroups)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((group) => ({
        date: group.date,
        lamp1: group.lamp1Values.length > 0 ? group.lamp1Values.reduce((a, b) => a + b, 0) / group.lamp1Values.length : 0,
        lamp2: group.lamp2Values.length > 0 ? group.lamp2Values.reduce((a, b) => a + b, 0) / group.lamp2Values.length : 0,
        avgAll: group.allLampValues.length > 0 ? group.allLampValues.reduce((a, b) => a + b, 0) / group.allLampValues.length : 0
      }))

    if (comparisonData.length <= 300) return comparisonData
    const step = Math.ceil(comparisonData.length / 300)
    return comparisonData.filter((_, index) => index % step === 0)
  }, [lamp1, lamp2, telemetryData, locale])

  if (loadingStage === 'initial' && telemetryData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-lg">{t('loadingComparisonData')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Streaming Progress Indicator */}
      {loadingStage === 'streaming' && streamProgress < 100 && (
        <div className="fixed bottom-4 right-4 bg-white/80 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg z-50">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-xs text-slate-600">{tCommon('loadingDetailedData', { n: streamProgress.toFixed(0) })}</span>
          </div>
        </div>
      )}

      {/* Stats Row with Date Filters */}
      <div className="flex items-start justify-between gap-8">
        <div className="grid grid-cols-3 gap-8 flex-1">
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('totalLamps')}</p>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-500" />
              <p className="text-3xl font-light text-purple-600">16</p>
            </div>
            <p className="text-slate-400 text-xs">{t('activeUvLamps')}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('dataPoints')}</p>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <p className="text-3xl font-light text-blue-600">{telemetryData.length}</p>
            </div>
            <p className="text-slate-400 text-xs">{t('telemetryRecords')}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('timePeriod')}</p>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <p className="text-3xl font-light text-orange-600">{daysAnalyzed}</p>
            </div>
            <p className="text-slate-400 text-xs">{t('daysAnalyzed')}</p>
          </div>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <p className="text-slate-400 text-[10px] uppercase tracking-wider">{t('dateRange')}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs">{t('from')}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white/50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs">{t('to')}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white/50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lamp Efficiency Comparison */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-400 text-[10px] uppercase tracking-wider">{t('lampEfficiencyComparison')}</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs">{t('lamp1Label')}</span>
              <select
                value={lamp1}
                onChange={(e) => setLamp1(Number(e.target.value))}
                className="bg-white/50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                {Array.from({ length: 16 }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>{t('lampOption', { num })}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs">{t('lamp2Label')}</span>
              <select
                value={lamp2}
                onChange={(e) => setLamp2(Number(e.target.value))}
                className="bg-white/50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                {Array.from({ length: 16 }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>{t('lampOption', { num })}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white/30 rounded-2xl p-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lampComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f8fafc'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="lamp1" stroke="#9333ea" strokeWidth={2} dot={false} name={t('lampSeriesLabel', { num: lamp1 })} />
              <Line type="monotone" dataKey="lamp2" stroke="#ef4444" strokeWidth={2} dot={false} name={t('lampSeriesLabel', { num: lamp2 })} />
              <Line type="monotone" dataKey="avgAll" stroke="#3b82f6" strokeWidth={2} dot={false} name={t('averageAll')} />
            </LineChart>
          </ResponsiveContainer>
          {lampComparison.length > 0 && (
            <div className="mt-4 p-4 bg-white/30 rounded-lg">
              <p className="text-slate-600 text-sm">
                <span className="font-medium text-slate-700">{t('analysisPrefix')}</span>{' '}
                {t('analysisLampDiff', {
                  lamp1,
                  lamp2,
                  diff: Math.abs(
                    ((lampComparison[lampComparison.length - 1]?.lamp1 - lampComparison[lampComparison.length - 1]?.lamp2) /
                      lampComparison[lampComparison.length - 1]?.lamp1) * 100
                  ).toFixed(0)
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
