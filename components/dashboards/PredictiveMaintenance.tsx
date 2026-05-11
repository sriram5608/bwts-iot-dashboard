'use client'

import { useEffect, useState } from 'react'
import { Calendar, AlertTriangle, DollarSign, Clock, ChevronLeft, ChevronRight } from 'lucide-react'

export default function PredictiveMaintenance() {
  const [predictions, setPredictions] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 16

  useEffect(() => {
    fetch('/api/predictions?limit=100')
      .then(res => res.json())
      .then(data => {
        const lampPredictions = data.filter((p: any) => p.component_type === 'UV_LAMP')
        const uniquePredictions = Object.values(
          lampPredictions.reduce((acc: any, pred: any) => {
            const existing = acc[pred.component_id]
            if (!existing || new Date(pred.timestamp) > new Date(existing.timestamp)) {
              acc[pred.component_id] = pred
            }
            return acc
          }, {})
        )
        const sorted = (uniquePredictions as any[]).sort((a, b) =>
          (b.predictions?.failure_probability || 0) - (a.predictions?.failure_probability || 0)
        )
        setPredictions(sorted)
      })
      .catch(error => console.error('Error fetching predictions:', error))
  }, [])

  const totalPages = Math.ceil(predictions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentPredictions = predictions.slice(startIndex, endIndex)

  const atRiskCount = predictions.filter(p => p.predictions?.failure_probability >= 0.5).length
  const avgRUL = predictions.length > 0 
    ? predictions.reduce((sum, p) => sum + (p.predictions?.remaining_useful_life_hours || 0), 0) / predictions.length
    : 0

  const getLampStyle = (riskLevel: number) => {
    if (riskLevel >= 0.7) return { gradient: 'from-red-500 to-red-600', glow: 'rgba(239, 68, 68, 0.4)', text: 'text-red-500' }
    if (riskLevel >= 0.5) return { gradient: 'from-orange-500 to-orange-600', glow: 'rgba(249, 115, 22, 0.4)', text: 'text-orange-500' }
    if (riskLevel >= 0.3) return { gradient: 'from-yellow-500 to-yellow-600', glow: 'rgba(234, 179, 8, 0.4)', text: 'text-yellow-600' }
    return { gradient: 'from-green-500 to-green-600', glow: 'rgba(34, 197, 94, 0.4)', text: 'text-emerald-600' }
  }

  return (
    <div className="space-y-8">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-8">
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Next Maintenance</p>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-500" />
            <p className="text-3xl font-light text-purple-600">15</p>
          </div>
          <p className="text-slate-400 text-xs">days</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">At Risk Components</p>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-3xl font-light text-red-500">{atRiskCount}</p>
          </div>
          <p className="text-slate-400 text-xs">requires attention</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Est. Savings</p>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <p className="text-3xl font-light text-emerald-600">13.5K</p>
          </div>
          <p className="text-slate-400 text-xs">vs reactive</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Avg RUL</p>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <p className="text-3xl font-light text-blue-500">{avgRUL.toFixed(0)}</p>
          </div>
          <p className="text-slate-400 text-xs">hours</p>
        </div>
      </div>

      {/* Predictions Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-400 text-[10px] uppercase tracking-wider">Component Predictions</p>
          <p className="text-slate-500 text-xs">{predictions.length} components tracked</p>
        </div>
        
        <div className="bg-white/30 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200/50">
                <th className="text-left text-slate-400 text-[10px] uppercase tracking-wider py-4 px-6">Component</th>
                <th className="text-left text-slate-400 text-[10px] uppercase tracking-wider py-4 px-6">RUL (hours)</th>
                <th className="text-left text-slate-400 text-[10px] uppercase tracking-wider py-4 px-6">Failure Risk</th>
                <th className="text-left text-slate-400 text-[10px] uppercase tracking-wider py-4 px-6">Efficiency</th>
                <th className="text-left text-slate-400 text-[10px] uppercase tracking-wider py-4 px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {currentPredictions.map((pred, index) => {
                const riskLevel = pred.predictions?.failure_probability || 0
                const style = getLampStyle(riskLevel)
                const statusText = riskLevel >= 0.7 ? 'Critical' : riskLevel >= 0.5 ? 'High' : riskLevel >= 0.3 ? 'Moderate' : 'Good'

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
                        <span className={`text-sm ${style.text}`}>{statusText}</span>
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
              Showing {startIndex + 1}-{Math.min(endIndex, predictions.length)} of {predictions.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg transition-colors ${currentPage === 1 ? 'text-slate-300' : 'text-slate-600 hover:bg-white/50'}`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-slate-600 text-sm">Page {currentPage} of {totalPages}</span>
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
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">Upcoming Maintenance</p>
          <div className="space-y-3">
            {[
              { task: 'UV Lamp Replacement', detail: 'Lamps 3, 7, 12', days: 15, urgent: true },
              { task: 'Filter Cleaning', detail: 'Backflush cycle', days: 45, urgent: false },
              { task: 'LDC Fan Service', detail: 'Inspection & cleaning', days: 60, urgent: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white/30 rounded-xl hover:bg-white/50 transition-colors">
                <div>
                  <p className="text-slate-700 font-medium">{item.task}</p>
                  <p className="text-slate-400 text-xs">{item.detail}</p>
                </div>
                <div className={`text-sm font-medium ${item.urgent ? 'text-orange-500' : 'text-emerald-600'}`}>
                  {item.days} days
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">Cost Comparison</p>
          <div className="bg-white/30 rounded-xl p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm">Reactive Maintenance</span>
                <span className="text-red-500 font-semibold">$18,500</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm">Predictive Maintenance</span>
                <span className="text-emerald-600 font-semibold">$5,000</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full" style={{ width: '27%' }} />
              </div>
            </div>
            <div className="pt-4 border-t border-slate-200/50">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-medium">Annual Savings</span>
                <span className="text-2xl font-light text-emerald-600">$13,500</span>
              </div>
              <p className="text-slate-400 text-xs mt-1">73% cost reduction</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
