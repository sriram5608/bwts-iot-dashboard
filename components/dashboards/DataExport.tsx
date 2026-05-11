'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { FileSpreadsheet, FileText, Filter as FilterIcon, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Papa from 'papaparse'
import { LoadingStage, ChunkedResponse, TelemetryReading } from '@/lib/types'
import { LOADING_CONFIG } from '@/lib/constants'

interface ColumnFilter {
  column: string
  type: 'text' | 'number' | 'date'
  textValue?: string
  numberCondition1?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  numberValue1?: number
  numberCondition2?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  numberValue2?: number
  dateCondition1?: 'gt' | 'lt' | 'eq'
  dateValue1?: string
  dateCondition2?: 'gt' | 'lt' | 'eq'
  dateValue2?: string
}

export default function DataExport() {
  const t = useTranslations('DataExport')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
  const colLabel = (col: string) => t(`columns.${col}`)

  const [data, setData] = useState<TelemetryReading[]>([])
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('initial')
  const [streamProgress, setStreamProgress] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [recordsPerPage, setRecordsPerPage] = useState(25)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([])
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null)
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'timestamp', 'operation_type', 'location', 'UVR_INTENSITY', 'UVR_POWER_OUTPUT',
    'SYS_FLOW_RATE', 'SYS_PRESSURE', 'AVG_LAMP_EFFICIENCY', 'FAILED_LAMP_COUNT'
  ])

  const allColumns = [
    'timestamp', 'system_id', 'operation_type', 'location', 'month',
    'UVR_INTENSITY', 'UVR_INTENSITY_NORMALIZED', 'UVR_POWER_OUTPUT', 'UVR_WATER_TEMP', 'UVR_LEVEL',
    'LDC_AIR_TEMP', 'LDC_FAN_SPEED', 'LDC_FAN_STATUS',
    'FLT_DIFF_PRESSURE', 'FLT_MOTOR_STATUS', 'FLT_BACKFLUSH_ACTIVE', 'FLT_BACKFLUSH_COUNT',
    'SYS_FLOW_RATE', 'SYS_PRESSURE', 'SYS_VALVE_POSITION', 'SYS_TOTAL_BALLAST_VOL', 'SYS_TOTAL_DEBALLAST_VOL',
    'AVG_LAMP_EFFICIENCY', 'FAILED_LAMP_COUNT', 'DEGRADATION_IMPACT_PCT', 'POWER_COMPENSATION_PCT'
  ]

  const getColumnType = (column: string): 'text' | 'number' | 'date' => {
    if (column === 'timestamp') return 'date'
    if (['operation_type', 'location', 'system_id', 'UVR_LEVEL', 'LDC_FAN_STATUS', 'FLT_MOTOR_STATUS'].includes(column)) return 'text'
    return 'number'
  }

  // Stage 1: Load aggregated data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoadingStage('initial')
        setStreamProgress(0)

        const latestRes = await fetch('/api/telemetry/latest')
        const latest = await latestRes.json()
        const latestDate = new Date(latest.timestamp)

        const response = await fetch('/api/telemetry/aggregated?interval=day&hours=8760')
        const aggregatedData = await response.json()

        setData(aggregatedData)

        if (aggregatedData.length > 0) {
          const dates = aggregatedData.map((r: TelemetryReading) => new Date(r.timestamp))
          const minDate = new Date(Math.min(...dates.map((d: Date) => d.getTime())))
          setStartDate(minDate.toISOString().split('T')[0])
          setEndDate(latestDate.toISOString().split('T')[0])
        }

        setLoadingStage('streaming')
      } catch (error) {
        console.error('Error fetching initial data:', error)
        setLoadingStage('complete')
      }
    }

    fetchInitialData()
  }, [])

  // Stage 2: Stream full raw data
  useEffect(() => {
    if (loadingStage !== 'streaming') return

    const streamDetailedData = async () => {
      try {
        const latestRes = await fetch('/api/telemetry/latest')
        const latest = await latestRes.json()
        const endDate = new Date(latest.timestamp)

        const startDate = new Date(endDate)
        startDate.setFullYear(startDate.getFullYear() - 1)

        const chunkSize = LOADING_CONFIG.CHUNK_SIZE
        let offset = 0
        let hasMore = true

        while (hasMore) {
          const response = await fetch(
            `/api/telemetry/chunked?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&offset=${offset}&limit=${chunkSize}`
          )
          const chunk: ChunkedResponse<TelemetryReading> = await response.json()

          if (chunk.data && chunk.data.length > 0) {
            setData(prevData => {
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
        console.error('Error streaming data:', error)
        setLoadingStage('complete')
      }
    }

    streamDetailedData()
  }, [loadingStage])

  const filteredData = useMemo(() => {
    let filtered = [...data]

    if (startDate && endDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)

      filtered = filtered.filter(item => {
        const itemDate = new Date(item.timestamp)
        return itemDate >= start && itemDate <= end
      })
    }

    columnFilters.forEach(filter => {
      if (filter.type === 'text' && filter.textValue) {
        filtered = filtered.filter(item => {
          const value = String(item[filter.column as keyof TelemetryReading] || '')
          return value.toLowerCase().includes(filter.textValue!.toLowerCase())
        })
      } else if (filter.type === 'number') {
        filtered = filtered.filter(item => {
          const value = Number(item[filter.column as keyof TelemetryReading])
          if (isNaN(value)) return true

          let passes = true
          if (filter.numberCondition1 && filter.numberValue1 !== undefined) {
            passes = passes && evaluateNumberCondition(value, filter.numberCondition1, filter.numberValue1)
          }
          if (filter.numberCondition2 && filter.numberValue2 !== undefined) {
            passes = passes && evaluateNumberCondition(value, filter.numberCondition2, filter.numberValue2)
          }
          return passes
        })
      }
    })

    return filtered
  }, [data, startDate, endDate, columnFilters])

  const evaluateNumberCondition = (value: number, condition: string, target: number): boolean => {
    switch (condition) {
      case 'gt': return value > target
      case 'lt': return value < target
      case 'eq': return value === target
      case 'gte': return value >= target
      case 'lte': return value <= target
      default: return true
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1)
  }, [filteredData.length, recordsPerPage])

  const totalPages = Math.ceil(filteredData.length / recordsPerPage)
  const indexOfLastRecord = currentPage * recordsPerPage
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage
  const currentRecords = filteredData.slice(indexOfFirstRecord, indexOfLastRecord)

  const formatValue = (value: TelemetryReading[keyof TelemetryReading], column: string) => {
    if (value === undefined || value === null) return '-'
    if (column === 'timestamp') return new Date(value as string | number | Date).toLocaleString(locale)
    if (typeof value === 'number') return value.toFixed(2)
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return String(value)
  }

  const exportToCSV = () => {
    const exportData = filteredData.map(row => {
      const filtered: Record<string, string> = {}
      selectedColumns.forEach(col => {
        filtered[col] = formatValue(row[col as keyof TelemetryReading], col)
      })
      return filtered
    })
    const csv = Papa.unparse(exportData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `bwts_telemetry_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const exportToPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(t('pdfTitle'), 14, 15)
    doc.setFontSize(10)
    doc.text(t('pdfGenerated', { datetime: new Date().toLocaleString(locale) }), 14, 22)
    doc.text(t('pdfPeriod', { from: startDate, to: endDate }), 14, 28)
    doc.text(t('pdfTotalRecords', { n: filteredData.length }), 14, 34)

    const tableData = filteredData.slice(0, 100).map(row =>
      selectedColumns.map(col => formatValue(row[col as keyof TelemetryReading], col))
    )

    autoTable(doc, {
      head: [selectedColumns.map(col => colLabel(col))],
      body: tableData,
      startY: 40,
      styles: { fontSize: 6, cellPadding: 1 },
      headStyles: { fillColor: [51, 65, 85] }
    })

    doc.save(`bwts_telemetry_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const toggleColumn = (column: string) => {
    setSelectedColumns(prev =>
      prev.includes(column) ? prev.filter(c => c !== column) : [...prev, column]
    )
  }

  const addColumnFilter = (column: string) => {
    const type = getColumnType(column)
    const existing = columnFilters.find(f => f.column === column)
    if (!existing) {
      setColumnFilters([...columnFilters, { column, type }])
    }
    setActiveFilterColumn(column)
  }

  const removeColumnFilter = (column: string) => {
    setColumnFilters(columnFilters.filter(f => f.column !== column))
    if (activeFilterColumn === column) {
      setActiveFilterColumn(null)
    }
  }

  const updateColumnFilter = (column: string, updates: Partial<ColumnFilter>) => {
    setColumnFilters(columnFilters.map(f =>
      f.column === column ? { ...f, ...updates } : f
    ))
  }

  const getActiveFilter = (column: string) => {
    return columnFilters.find(f => f.column === column)
  }

  if (loadingStage === 'initial' && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-lg">{t('loadingData')}</div>
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

      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-8">
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('totalRecords')}</p>
          <p className="text-3xl font-light text-blue-500">{data.length}</p>
          <p className="text-slate-400 text-xs">{t('inDatabase')}</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('filteredRecords')}</p>
          <p className="text-3xl font-light text-purple-600">{filteredData.length}</p>
          <p className="text-slate-400 text-xs">{t('matchingCriteria')}</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('dateRange')}</p>
          <p className="text-xl font-light text-slate-600">
            {new Date(startDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' })} - {new Date(endDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
          </p>
          <p className="text-slate-400 text-xs">{t('selectedPeriod')}</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('columnsSelected')}</p>
          <p className="text-3xl font-light text-emerald-600">{selectedColumns.length}</p>
          <p className="text-slate-400 text-xs">{t('ofNAvailable', { n: allColumns.length })}</p>
        </div>
      </div>

      {/* Filters and Export */}
      <div className="flex items-start justify-between gap-8">
        <div className="flex-1 space-y-4">
          {/* Date Range */}
          <div className="flex items-center gap-4">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="text-slate-400">{tCommon('to')}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Active Column Filters */}
          {columnFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {columnFilters.map(filter => (
                <div key={filter.column} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                  <span className="text-xs font-medium text-blue-700">{colLabel(filter.column)}</span>
                  {filter.type === 'text' && filter.textValue && (
                    <span className="text-xs text-blue-600">contains &quot;{filter.textValue}&quot;</span>
                  )}
                  {filter.type === 'number' && (filter.numberValue1 !== undefined || filter.numberValue2 !== undefined) && (
                    <span className="text-xs text-blue-600">
                      {filter.numberCondition1 && filter.numberValue1 !== undefined && `${filter.numberCondition1} ${filter.numberValue1}`}
                      {filter.numberCondition2 && filter.numberValue2 !== undefined && ` & ${filter.numberCondition2} ${filter.numberValue2}`}
                    </span>
                  )}
                  <button onClick={() => removeColumnFilter(filter.column)} className="text-blue-700 hover:text-blue-900">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-lg font-medium text-sm hover:shadow-lg hover:shadow-emerald-500/25 transition-shadow"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {t('exportCsv')}
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg font-medium text-sm hover:shadow-lg hover:shadow-red-500/25 transition-shadow"
          >
            <FileText className="w-4 h-4" />
            {t('exportPdf')}
          </button>
        </div>
      </div>

      {/* Column Selector */}
      <div>
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-3">{t('selectColumns')}</p>
        <div className="flex flex-wrap gap-2">
          {allColumns.map(column => (
            <button
              key={column}
              onClick={() => toggleColumn(column)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedColumns.includes(column)
                  ? 'bg-slate-800 text-white'
                  : 'bg-white/50 text-slate-600 hover:bg-white/80'
              }`}
            >
              {colLabel(column)}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-400 text-[10px] uppercase tracking-wider">{t('dataPreview')}</p>
          <div className="flex items-center gap-4">
            <select
              value={recordsPerPage}
              onChange={(e) => setRecordsPerPage(Number(e.target.value))}
              className="bg-white/50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
            >
              <option value={25}>{t('perPage25')}</option>
              <option value={50}>{t('perPage50')}</option>
              <option value={100}>{t('perPage100')}</option>
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg transition-colors ${currentPage === 1 ? 'text-slate-300' : 'text-slate-600 hover:bg-white/50'}`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-slate-600 text-sm">{tCommon('pageOf', { current: currentPage, total: totalPages || 1 })}</span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className={`p-2 rounded-lg transition-colors ${currentPage === totalPages ? 'text-slate-300' : 'text-slate-600 hover:bg-white/50'}`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/30 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200/50">
                  {selectedColumns.map(column => {
                    const activeFilter = getActiveFilter(column)
                    return (
                      <th key={column} className="text-left text-slate-400 text-[10px] uppercase tracking-wider py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 group">
                          <span>{colLabel(column)}</span>
                          <button
                            onClick={() => activeFilter ? setActiveFilterColumn(column) : addColumnFilter(column)}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity ${activeFilter ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            <FilterIcon className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Filter Dropdown */}
                        {activeFilterColumn === column && (
                          <div className="absolute z-10 mt-2 bg-white rounded-lg shadow-lg border border-slate-200 p-4 w-64" onClick={(e) => e.stopPropagation()}>
                            {getColumnType(column) === 'text' && (
                              <div>
                                <input
                                  type="text"
                                  placeholder={t('searchPlaceholder')}
                                  value={activeFilter?.textValue || ''}
                                  onChange={(e) => updateColumnFilter(column, { textValue: e.target.value })}
                                  className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-slate-700"
                                  autoFocus
                                />
                              </div>
                            )}
                            {getColumnType(column) === 'number' && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <select
                                    value={activeFilter?.numberCondition1 || 'gt'}
                                    onChange={(e) => updateColumnFilter(column, { numberCondition1: e.target.value as 'gt' | 'lt' | 'eq' | 'gte' | 'lte' })}
                                    className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-700"
                                  >
                                    <option value="gt">&gt;</option>
                                    <option value="gte">&gt;=</option>
                                    <option value="lt">{'<'}</option>
                                    <option value="lte">{'<='}</option>
                                    <option value="eq">=</option>
                                  </select>
                                  <input
                                    type="number"
                                    placeholder={t('valuePlaceholder')}
                                    value={activeFilter?.numberValue1 ?? ''}
                                    onChange={(e) => updateColumnFilter(column, { numberValue1: e.target.value ? Number(e.target.value) : undefined })}
                                    className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm text-slate-700"
                                  />
                                </div>
                                <div className="text-xs text-slate-500 text-center">{t('andLabel')}</div>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={activeFilter?.numberCondition2 || 'lt'}
                                    onChange={(e) => updateColumnFilter(column, { numberCondition2: e.target.value as 'gt' | 'lt' | 'eq' | 'gte' | 'lte' })}
                                    className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-700"
                                  >
                                    <option value="gt">&gt;</option>
                                    <option value="gte">&gt;=</option>
                                    <option value="lt">{'<'}</option>
                                    <option value="lte">{'<='}</option>
                                    <option value="eq">=</option>
                                  </select>
                                  <input
                                    type="number"
                                    placeholder={t('valuePlaceholder')}
                                    value={activeFilter?.numberValue2 ?? ''}
                                    onChange={(e) => updateColumnFilter(column, { numberValue2: e.target.value ? Number(e.target.value) : undefined })}
                                    className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm text-slate-700"
                                  />
                                </div>
                              </div>
                            )}
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => setActiveFilterColumn(null)}
                                className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-xs text-slate-700"
                              >
                                {t('closeButton')}
                              </button>
                              <button
                                onClick={() => removeColumnFilter(column)}
                                className="flex-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs"
                              >
                                {t('clearButton')}
                              </button>
                            </div>
                          </div>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {currentRecords.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100/50 hover:bg-white/30 transition-colors">
                    {selectedColumns.map(column => (
                      <td key={column} className="py-3 px-4 text-slate-700 text-sm whitespace-nowrap">
                        {formatValue(row[column as keyof TelemetryReading], column)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {currentRecords.length === 0 && (
              <div className="text-center text-slate-400 py-8">
                {t('noRecordsFound')}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-between text-slate-400 text-xs">
          <span>{t('showingRecords', { start: indexOfFirstRecord + 1, end: Math.min(indexOfLastRecord, filteredData.length), total: filteredData.length })}</span>
          <span>{t('totalInDatabase', { total: data.length })}</span>
        </div>
      </div>

      {/* Click outside to close filter dropdown */}
      {activeFilterColumn && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setActiveFilterColumn(null)}
        />
      )}
    </div>
  )
}
