'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Calendar, AlertTriangle, DollarSign, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { Prediction } from '@/lib/types'

interface MaintenanceTask {
  maintenance_type: string
  component_type: string
  next_due_date: string
  components: string
  days_until: number
}

const TASK_LABELS: Record<string, string> = {
  LAMP_REPLACEMENT: 'UV Lamp Replacement',
  CIP_CYCLE: 'CIP Cycle',
  CIP_PH_CHECK: 'CIP pH Check',
  CIP_LIQUID_REPLACEMENT: 'CIP Liquid Replacement',
  FILTER_INSPECTION: 'Filter Inspection',
  SENSOR_CALIBRATION: 'Sensor Calibration',
  SENSOR_REPLACEMENT: 'Sensor Replacement',
  ANNUAL_INSPECTION: 'Annual Inspection',
  VALVE_OPERATION: 'Valve Check',
  MONTHLY_TESTRUN: 'System Testrun',
}

export default function PredictiveMaintenance() {
  const t = useTranslations('PredictiveMaintenance')
  const tCommon = useTranslations('Common')

  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 16

  useEffect(() => {
    fetch('/api/predictions?limit=100')
      .then(res => res.json())
      .then((data: Prediction[]) => {
        const lampPredictions = data.filter((p: Prediction) => p.component_type === 'UV_LAMP')
        const uniquePredictions = Object.values(
          lampPredictions.reduce((acc: Record<string, Prediction>, pred: Prediction) => {
            const existing = acc[pred.component_id]
            if (!existing || new Date(pred.timestamp) > new Date(existing.timestamp)) {
              acc[pred.component_id] = pred
            }
            return acc
          }, {})
        )
        const sorted = uniquePredictions.sort((a, b) =>
          (b.predictions?.failure_probability || 0) - (a.predictions?.failure_probability || 0)
        )
        setPredictions(sorted)
      })
      .catch(error => console.error('Error fetching predictions:', error))

    fetch('/api/maintenance/upcoming')
      .then(res => res.json())
      .then((data: MaintenanceTask[]) => setMaintenanceTasks(Array.isArray(data) ? data : []))
      .catch(error => console.error('Error fetching maintenance tasks:', error))
  }, [])

  const totalPages = Math.ceil(predictions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentPredictions = predictions.slice(startIndex, endIndex)

  const atRiskCount = predictions.filter(p => p.predictions?.failure_probability >= 0.5).length
  const avgRUL = predictions.length > 0
    ? predictions.reduce((sum, p) => sum + (p.predictions?.remaining_useful_life_hours || 0), 0) / predictions.length
    : 0

  // Next maintenance: soonest future task from DB (days_until > 0)
  const futureTasks = maintenanceTasks.filter(t => t.days_until > 0)
  const nextMaintenanceDays = futureTasks.length > 0
    ? Math.min(...futureTasks.map(t => t.days_until))
    : null
  const hasOverdueTasks = maintenanceTasks.some(t => t.days_until <= 0)

  const getLampStyle = (riskLevel: number) => {
    if (riskLevel >= 0.7) return { gradient: 'from-red-500 to-red-600', glow: 'rgba(239, 68, 68, 0.4)', text: 'text-red-500' }
    if (riskLevel >= 0.5) return { gradient: 'from-orange-500 to-orange-600', glow: 'rgba(249, 115, 22, 0.4)', text: 'text-orange-500' }
    if (riskLevel >= 0.3) return { gradient: 'from-yellow-500 to-yellow-600', glow: 'rgba(234, 179, 8, 0.4)', text: 'text-yellow-600' }
    return { gradient: 'from-green-500 to-green-600', glow: 'rgba(34, 197, 94, 0.4)', text: 'text-emerald-600' }
  }

  const statusLabel = (riskLevel: number) => {
    if (riskLevel >= 0.7) return t('statusCritical')
    if (riskLevel >= 0.5) return t('statusHigh')
    if (riskLevel >= 0.3) return t('statusModerate')
    return t('statusGood')
  }

  return (
    <div className="space-y-8">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-8">
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('nextMaintenance')}</p>
          <div className="flex items-center gap-2">
            <Calendar className={`w-5 h-5 ${hasOverdueTasks ? 'text-orange-500' : 'text-purple-500'}`} />
            <p className={`text-3xl font-light ${hasOverdueTasks ? 'text-orange-500' : 'text-purple-600'}`}>
              {nextMaintenanceDays ?? '--'}
            </p>
          </div>
          <p className="text-slate-400 text-xs">
            {hasOverdueTasks ? 'days · tasks overdue' : tCommon('days')}
          </p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('atRiskComponents')}</p>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-3xl font-light text-red-500">{atRiskCount}</p>
          </div>
          <p className="text-slate-400 text-xs">{t('requiresAttention')}</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('estSavings')}</p>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <p className="text-3xl font-light text-emerald-600">13.5K</p>
          </div>
          <p className="text-slate-400 text-xs">{t('vsReactive')}</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('avgRul')}</p>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <p className="text-3xl font-light text-blue-500">{avgRUL.toFixed(0)}</p>
          </div>
          <p className="text-slate-400 text-xs">{tCommon('hours')}</p>
        </div>
      </div>

      {/* Predictions Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-400 text-[10px] uppercase tracking-wider">{t('componentPredictions')}</p>
          <p className="text-slate-500 text-xs">{t('componentsTracked', { count: predictions.length })}</p>
        </div>

        <div className="bg-white/30 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200/50">
                <th className="text-left text-slate-400 text-[10px] uppercase tracking-wider py-4 px-6">{t('component')}</th>
                <th className="text-left text-slate-400 text-[10px] uppercase tracking-wider py-4 px-6">{t('rulHours')}</th>
                <th className="text-left text-slate-400 text-[10px] uppercase tracking-wider py-4 px-6">{t('failureRisk')}</th>
                <th className="text-left text-slate-400 text-[10px] uppercase tracking-wider py-4 px-6">{t('efficiency')}</th>
                <th className="text-left text-slate-400 text-[10px] uppercase tracking-wider py-4 px-6">{tCommon('status')}</th>
              </tr>
            </thead>
            <tbody>
              {currentPredictions.map((pred, index) => {
                const riskLevel = pred.predictions?.failure_probability || 0
                const style = getLampStyle(riskLevel)

                return (
                  <tr key={index} className="border-b border-slate-100/50 hover:bg-white/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full bg-gradient-to-br ${style.gradient}`}
                          style={{ boxShadow: `0 2px 8px ${style.glow}` }}
                        />
                        <span className="text-slate-700 text-sm font-medium">{pred.component_id}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-700">{pred.predictions?.remaining_useful_life_hours?.toFixed(0) || '--'}</td>
                    <td className={`py-4 px-6 font-medium ${style.text}`}>
                      {((pred.predictions?.failure_probability || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="py-4 px-6 text-slate-700">{pred.predictions?.efficiency_percent?.toFixed(1) || '--'}%</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${style.gradient}`} />
                        <span className={`text-sm ${style.text}`}>{statusLabel(riskLevel)}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-slate-400 text-xs">
              {t('showingRange', { start: startIndex + 1, end: Math.min(endIndex, predictions.length), total: predictions.length })}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg transition-colors ${currentPage === 1 ? 'text-slate-300' : 'text-slate-600 hover:bg-white/50'}`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-slate-600 text-sm">{tCommon('pageOf', { current: currentPage, total: totalPages })}</span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-lg transition-colors ${currentPage === totalPages ? 'text-slate-300' : 'text-slate-600 hover:bg-white/50'}`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row: Maintenance Schedule + Cost Comparison */}
      <div className="grid grid-cols-2 gap-8">
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">{t('upcomingMaintenance')}</p>
          <div className="space-y-3">
            {maintenanceTasks.slice(0, 6).map((task, i) => {
              const overdue = task.days_until <= 0
              const urgent = task.days_until > 0 && task.days_until <= 20
              const label = TASK_LABELS[task.maintenance_type] ?? task.maintenance_type.replace(/_/g, ' ')
              const detail = task.components.length > 30
                ? task.components.slice(0, 28) + '…'
                : task.components
              return (
                <div key={i} className="flex items-center justify-between p-4 bg-white/30 rounded-xl hover:bg-white/50 transition-colors">
                  <div>
                    <p className="text-slate-700 font-medium">{label}</p>
                    <p className="text-slate-400 text-xs">{detail}</p>
                  </div>
                  <div className={`text-sm font-medium whitespace-nowrap ${
                    overdue ? 'text-red-500' : urgent ? 'text-orange-500' : 'text-emerald-600'
                  }`}>
                    {overdue
                      ? `${Math.abs(task.days_until)}d overdue`
                      : `${task.days_until} ${tCommon('days')}`}
                  </div>
                </div>
              )
            })}
            {maintenanceTasks.length === 0 && (
              <div className="p-4 text-slate-400 text-sm">Loading maintenance schedule…</div>
            )}
          </div>
        </div>

        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">{t('costComparison')}</p>
          <div className="bg-white/30 rounded-xl p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm">{t('reactiveMaintenance')}</span>
                <span className="text-red-500 font-semibold">$18,500</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm">{t('predictiveMaintenance')}</span>
                <span className="text-emerald-600 font-semibold">$5,000</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full" style={{ width: '27%' }} />
              </div>
            </div>
            <div className="pt-4 border-t border-slate-200/50">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-medium">{t('annualSavings')}</span>
                <span className="text-2xl font-light text-emerald-600">$13,500</span>
              </div>
              <p className="text-slate-400 text-xs mt-1">{t('costReduction')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
