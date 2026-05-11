'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { LoadingStage, ChunkedResponse, TelemetryReading } from '@/lib/types'
import { LOADING_CONFIG } from '@/lib/constants'

interface HealthAggregatedData {
  timestamp: Date
  overall_score: number
  components?: {
    uv_health?: number
    lamp_health?: number
  }
}

interface HealthChartData {
  date: string
  health: number
  uvHealth: number
  lampHealth: number
}

export default function TrendAnalysis() {
  const [healthData, setHealthData] = useState<HealthChartData[]>([])
  const [telemetryData, setTelemetryData] = useState<TelemetryReading[]>([])
  const [runtimeData, setRuntimeData] = useState<TelemetryReading[]>([])
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('initial')
  const [streamProgress, setStreamProgress] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedLampOption1, setSelectedLampOption1] = useState<number>(1)
  const [selectedLampOption3, setSelectedLampOption3] = useState<number>(1)

  // Initialize date range based on actual data
  useEffect(() => {
    const initializeDates = async () => {
      try {
        // Get latest timestamp from database
        const response = await fetch('/api/telemetry/latest')
        const latest = await response.json()
        const latestDate = new Date(latest.timestamp)

        const oneMonthAgo = new Date(latestDate)
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

        setStartDate(oneMonthAgo.toISOString().split('T')[0])
        setEndDate(latestDate.toISOString().split('T')[0])
      } catch (error) {
        console.error('Error initializing dates:', error)
        // Fallback to today's date
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

        // Parallel fetch of daily aggregates using absolute date range
        const [telemetryRes, healthRes] = await Promise.all([
          fetch(`/api/telemetry/aggregated?interval=day&startDate=${start.toISOString()}&endDate=${end.toISOString()}`),
          fetch(`/api/health/aggregated?interval=day&startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
        ])

        const telemetryAgg = await telemetryRes.json()
        const healthAgg = await healthRes.json()

        setTelemetryData(telemetryAgg)

        const formatted = (healthAgg as HealthAggregatedData[]).map((h) => ({
          date: new Date(h.timestamp).toLocaleDateString(),
          health: h.overall_score,
          uvHealth: h.components?.uv_health || 0,
          lampHealth: h.components?.lamp_health || 0,
        }))
        setHealthData(formatted)

        setLoadingStage('streaming')
      } catch (error) {
        console.error('Error fetching initial data:', error)
        setLoadingStage('complete')
      }
    }

    fetchInitialData()
  }, [startDate, endDate])

  // Stage 2: Background stream raw data (if needed for detail)
  useEffect(() => {
    if (loadingStage !== 'streaming') return

    const start = new Date(startDate)
    const end = new Date(endDate)

    const streamDetailedData = async () => {
      try {
        // First, check total record count for the date range
        const checkResponse = await fetch(
          `/api/telemetry/chunked?startDate=${start.toISOString()}&endDate=${end.toISOString()}&offset=0&limit=1`
        )
        const checkData = await checkResponse.json()
        const totalRecords = checkData.pagination?.total || 0

        // Only stream if there are records and it's a reasonable amount (<50k records)
        if (totalRecords === 0 || totalRecords > 50000) {
          setLoadingStage('complete')
          setStreamProgress(100)
          return
        }

        const chunkSize = LOADING_CONFIG.CHUNK_SIZE
        let offset = 0
        let hasMore = true

        while (hasMore) {
          const response = await fetch(
            `/api/telemetry/chunked?startDate=${start.toISOString()}&endDate=${end.toISOString()}&offset=${offset}&limit=${chunkSize}`
          )
          const chunk: ChunkedResponse<TelemetryReading> = await response.json()

          if (chunk.data && chunk.data.length > 0) {
            // Merge chunk into existing data (replace aggregated with raw)
            setTelemetryData(prevData => {
              const chunkStart = new Date(chunk.data[0]?.timestamp)
              const chunkEnd = new Date(chunk.data[chunk.data.length - 1]?.timestamp)

              // Remove aggregated data overlapping with chunk date range
              const filtered = prevData.filter(d => {
                const timestamp = new Date(d.timestamp)
                return timestamp < chunkStart || timestamp > chunkEnd
              })

              // Insert raw chunk data and sort
              return [...filtered, ...chunk.data].sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              )
            })
          }

          // Update progress
          const progress = chunk.pagination ? (chunk.pagination.offset + chunk.pagination.limit) / chunk.pagination.total * 100 : 100
          setStreamProgress(Math.min(progress, 100))

          offset += chunkSize
          hasMore = chunk.pagination?.hasMore || false

          // Delay to avoid overwhelming browser
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

  // Fetch runtime analysis data for Options 1 and 3
  useEffect(() => {
    if (!startDate || !endDate) return

    const fetchRuntimeData = async () => {
      try {
        const start = new Date(startDate)
        const end = new Date(endDate)

        const response = await fetch(
          `/api/telemetry/runtime-analysis?startDate=${start.toISOString()}&endDate=${end.toISOString()}`
        )
        const data = await response.json()
        setRuntimeData(data)
      } catch (error) {
        console.error('Error fetching runtime data:', error)
      }
    }

    fetchRuntimeData()
  }, [startDate, endDate])

  // Memoized calculations
  const stats = useMemo(() => {
    if (telemetryData.length === 0) {
      return { avgUVIntensity: 0, avgEfficiency: 0, healthTrend: 0, dataPoints: 0 }
    }

    const avgUV = telemetryData.reduce((sum, item) => sum + (item.UVR_INTENSITY || 0), 0) / telemetryData.length
    const avgEff = telemetryData.reduce((sum, item) => sum + (item.AVG_LAMP_EFFICIENCY || 0), 0) / telemetryData.length

    const midpoint = Math.floor(healthData.length / 2)
    const firstHalfAvg = healthData.slice(0, midpoint).reduce((sum, h) => sum + h.health, 0) / midpoint || 0
    const secondHalfAvg = healthData.slice(midpoint).reduce((sum, h) => sum + h.health, 0) / (healthData.length - midpoint) || 0
    const healthTrend = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0

    return {
      avgUVIntensity: avgUV,
      avgEfficiency: avgEff,
      healthTrend: healthTrend,
      dataPoints: telemetryData.length
    }
  }, [telemetryData, healthData])

  // Memoized lamp heatmap data
  const lampHeatmapData = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => {
      const lampNum = String(i + 1).padStart(2, '0')
      const lampEfficiencies = telemetryData
        .map(item => item[`LAMP_${lampNum}_EFFICIENCY`])
        .filter(val => val !== undefined && val !== null)
      const avgEfficiency = lampEfficiencies.length > 0
        ? lampEfficiencies.reduce((sum: number, val: number) => sum + val, 0) / lampEfficiencies.length
        : 0
      return { lampNum: i + 1, avgEfficiency }
    })
  }, [telemetryData])

  // Downsample telemetry data for charts
  const downsampledTelemetry = useMemo(() => {
    if (telemetryData.length <= LOADING_CONFIG.MAX_CHART_POINTS) {
      return telemetryData
    }
    const step = Math.ceil(telemetryData.length / LOADING_CONFIG.MAX_CHART_POINTS)
    return telemetryData.filter((_, index) => index % step === 0)
  }, [telemetryData])

  // UV chart data
  const uvChartData = useMemo(() => {
    return downsampledTelemetry.map(item => ({
      time: new Date(item.timestamp).toLocaleDateString(),
      uv: item.UVR_INTENSITY
    }))
  }, [downsampledTelemetry])

  const getLampStyle = useCallback((efficiency: number) => {
    if (efficiency >= 90) return { gradient: 'from-green-500 to-green-600', glow: 'rgba(34, 197, 94, 0.4)' }
    if (efficiency >= 70) return { gradient: 'from-yellow-500 to-yellow-600', glow: 'rgba(234, 179, 8, 0.4)' }
    if (efficiency >= 50) return { gradient: 'from-orange-500 to-orange-600', glow: 'rgba(249, 115, 22, 0.4)' }
    return { gradient: 'from-red-500 to-red-600', glow: 'rgba(239, 68, 68, 0.4)' }
  }, [])

  // Option 1: Lamp Efficiency + Power vs Runtime (single lamp)
  const option1Data = useMemo(() => {
    if (runtimeData.length === 0) return []

    const lampId = String(selectedLampOption1).padStart(2, '0')
    const runtimeGroups: Record<number, { efficiencies: number[], powers: number[] }> = {}

    runtimeData.forEach(record => {
      const runtime = record[`LAMP_${lampId}_RUNTIME`]
      const efficiency = record[`LAMP_${lampId}_EFFICIENCY`]
      const power = record[`LAMP_${lampId}_POWER`]

      if (runtime !== undefined && efficiency !== undefined && power !== undefined &&
          typeof runtime === 'number' && typeof efficiency === 'number' && typeof power === 'number') {
        const bucket = Math.floor(runtime / 10) * 10

        if (!runtimeGroups[bucket]) {
          runtimeGroups[bucket] = { efficiencies: [], powers: [] }
        }
        runtimeGroups[bucket].efficiencies.push(efficiency)
        runtimeGroups[bucket].powers.push(power)
      }
    })

    const sortedBuckets = Object.keys(runtimeGroups)
      .map(Number)
      .sort((a, b) => a - b)

    return sortedBuckets.map(bucket => {
      const data = runtimeGroups[bucket]
      const avgEff = data.efficiencies.reduce((a, b) => a + b, 0) / data.efficiencies.length
      const avgPow = data.powers.reduce((a, b) => a + b, 0) / data.powers.length

      return {
        runtime: bucket,
        efficiency: Number(avgEff.toFixed(1)),
        power: Number(avgPow.toFixed(0))
      }
    })
  }, [runtimeData, selectedLampOption1])

  // Option 3: Lamp Efficiency vs System UV Intensity (single lamp)
  const option3Data = useMemo(() => {
    if (runtimeData.length === 0) return []

    const lampId = String(selectedLampOption3).padStart(2, '0')
    const runtimeGroups: Record<number, { efficiencies: number[], uvIntensities: number[] }> = {}

    runtimeData.forEach(record => {
      const runtime = record[`LAMP_${lampId}_RUNTIME`]
      const efficiency = record[`LAMP_${lampId}_EFFICIENCY`]
      const uvIntensity = record.UVR_INTENSITY

      if (runtime !== undefined && efficiency !== undefined && uvIntensity !== undefined &&
          typeof runtime === 'number' && typeof efficiency === 'number' && typeof uvIntensity === 'number') {
        const bucket = Math.floor(runtime / 10) * 10

        if (!runtimeGroups[bucket]) {
          runtimeGroups[bucket] = { efficiencies: [], uvIntensities: [] }
        }
        runtimeGroups[bucket].efficiencies.push(efficiency)
        runtimeGroups[bucket].uvIntensities.push(uvIntensity)
      }
    })

    const sortedBuckets = Object.keys(runtimeGroups)
      .map(Number)
      .sort((a, b) => a - b)

    return sortedBuckets.map(bucket => {
      const data = runtimeGroups[bucket]
      const avgEff = data.efficiencies.reduce((a, b) => a + b, 0) / data.efficiencies.length
      const avgUV = data.uvIntensities.reduce((a, b) => a + b, 0) / data.uvIntensities.length

      return {
        runtime: bucket,
        efficiency: Number(avgEff.toFixed(1)),
        systemUV: Number(avgUV.toFixed(1))
      }
    })
  }, [runtimeData, selectedLampOption3])

  if (loadingStage === 'initial' && telemetryData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-lg">Loading trend data...</div>
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
            <span className="text-xs text-slate-600">Loading detailed data... {streamProgress.toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Date Range Filter */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Analysis Period</p>
          <p className="text-slate-700 text-lg font-medium">
            {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-8">
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Health Trend</p>
          <div className="flex items-center gap-2">
            {stats.healthTrend >= 0 ? (
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500" />
            )}
            <p className={`text-3xl font-light ${stats.healthTrend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {stats.healthTrend > 0 ? '+' : ''}{stats.healthTrend.toFixed(1)}%
            </p>
          </div>
          <p className="text-slate-400 text-xs">vs previous period</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Avg Efficiency</p>
          <p className="text-3xl font-light text-orange-500">{stats.avgEfficiency.toFixed(1)}%</p>
          <p className="text-slate-400 text-xs">lamp efficiency</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Avg UV Intensity</p>
          <p className="text-3xl font-light text-cyan-600">{stats.avgUVIntensity.toFixed(1)}</p>
          <p className="text-slate-400 text-xs">W/m² average</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Data Points</p>
          <p className="text-3xl font-light text-blue-500">{stats.dataPoints}</p>
          <p className="text-slate-400 text-xs">telemetry records</p>
        </div>
      </div>

      {/* Health Evolution Chart */}
      <div>
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">System Health Evolution</p>
        <div className="bg-white/30 rounded-2xl p-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={healthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f8fafc'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="health" stroke="#9333ea" strokeWidth={2} dot={false} name="Overall Health" />
              <Line type="monotone" dataKey="uvHealth" stroke="#3b82f6" strokeWidth={2} dot={false} name="UV Health" />
              <Line type="monotone" dataKey="lampHealth" stroke="#22c55e" strokeWidth={2} dot={false} name="Lamp Health" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* UV Intensity Chart - Full Width */}
      <div>
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">UV Intensity Over Time</p>
        <div className="bg-white/30 rounded-2xl p-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={uvChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f8fafc'
                }}
              />
              <Line type="monotone" dataKey="uv" stroke="#9333ea" strokeWidth={2} dot={false} name="UV Intensity (W/m²)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lamp Efficiency Heatmap - Full Width */}
      <div>
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">Lamp Efficiency Heatmap (Period Average)</p>
        <div className="bg-white/30 rounded-2xl p-6">
          <div className="grid grid-cols-8 gap-3 max-w-4xl mx-auto">
            {lampHeatmapData.map((lamp, i) => {
              const style = getLampStyle(lamp.avgEfficiency)

              return (
                <div
                  key={i}
                  className={`rounded-xl p-3 flex flex-col items-center justify-center bg-gradient-to-br ${style.gradient} cursor-pointer transition-transform hover:scale-105`}
                  style={{
                    boxShadow: `0 4px 15px ${style.glow}`,
                    opacity: Math.max(0.5, lamp.avgEfficiency / 100),
                  }}
                >
                  <span className="text-white text-xs font-semibold">L{lamp.lampNum}</span>
                  <span className="text-white/80 text-[10px]">{lamp.avgEfficiency.toFixed(0)}%</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200/50">
            <span className="text-slate-400 text-[10px]">Low (&lt;50%)</span>
            <div className="flex gap-1">
              <div className="w-6 h-2 rounded bg-gradient-to-r from-red-500 to-red-600" />
              <div className="w-6 h-2 rounded bg-gradient-to-r from-orange-500 to-orange-600" />
              <div className="w-6 h-2 rounded bg-gradient-to-r from-yellow-500 to-yellow-600" />
              <div className="w-6 h-2 rounded bg-gradient-to-r from-green-500 to-green-600" />
            </div>
            <span className="text-slate-400 text-[10px]">High (90%+)</span>
          </div>
        </div>
      </div>

      {/* Option 1: Lamp Efficiency + Power vs Runtime (Dual Y-axis) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-400 text-[10px] uppercase tracking-wider">Lamp Efficiency & Power vs Runtime</p>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs">Select Lamp:</span>
            <select
              value={selectedLampOption1}
              onChange={(e) => setSelectedLampOption1(Number(e.target.value))}
              className="bg-white/50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              {Array.from({ length: 16 }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>Lamp {num}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white/30 rounded-2xl p-6">
          {option1Data.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={option1Data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="runtime"
                    stroke="#94a3b8"
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Runtime Hours', position: 'insideBottom', offset: -5, fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#9333ea"
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Efficiency (%)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    domain={[80, 100]}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#3b82f6"
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Power (W)', angle: 90, position: 'insideRight', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#f8fafc'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="efficiency"
                    stroke="#9333ea"
                    strokeWidth={2}
                    dot={false}
                    name={`Lamp ${selectedLampOption1} Eff (%)`}
                    connectNulls
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="power"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name={`Lamp ${selectedLampOption1} Power (W)`}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 p-4 bg-white/30 rounded-lg">
                <p className="text-slate-600 text-sm">
                  <span className="font-medium text-slate-700">Analysis:</span>{' '}
                  Solid purple line shows Lamp {selectedLampOption1} efficiency degradation, dashed blue line shows power output changes over runtime hours.
                  Power typically increases to compensate for efficiency loss.
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-slate-400 text-sm">Select lamps to view runtime analysis...</div>
            </div>
          )}
        </div>
      </div>

      {/* Option 3: Lamp Efficiency vs System UV Intensity (Dual Y-axis) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-400 text-[10px] uppercase tracking-wider">Lamp Efficiency vs System UV Intensity</p>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs">Select Lamp:</span>
            <select
              value={selectedLampOption3}
              onChange={(e) => setSelectedLampOption3(Number(e.target.value))}
              className="bg-white/50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              {Array.from({ length: 16 }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>Lamp {num}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white/30 rounded-2xl p-6">
          {option3Data.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={option3Data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="runtime"
                    stroke="#94a3b8"
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Runtime Hours', position: 'insideBottom', offset: -5, fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#9333ea"
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Lamp Efficiency (%)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    domain={[80, 100]}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#06b6d4"
                    tick={{ fontSize: 10 }}
                    label={{ value: 'System UV (W/m²)', angle: 90, position: 'insideRight', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#f8fafc'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="efficiency"
                    stroke="#9333ea"
                    strokeWidth={2}
                    dot={false}
                    name={`Lamp ${selectedLampOption3} Eff (%)`}
                    connectNulls
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="systemUV"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="System UV (W/m²)"
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 p-4 bg-white/30 rounded-lg">
                <p className="text-slate-600 text-sm">
                  <span className="font-medium text-slate-700">Analysis:</span>{' '}
                  Shows correlation between Lamp {selectedLampOption3} efficiency (solid purple line) and overall system UV intensity (dashed cyan line) over runtime.
                  System UV may remain stable despite individual lamp degradation due to power compensation.
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-slate-400 text-sm">Select lamps to view UV correlation...</div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
