'use client'

import { useTranslations, useLocale } from 'next-intl'
import { AlertTriangle, AlertCircle, Info, CheckCircle, Bell, Clock } from 'lucide-react'
import { useDemoMode } from '@/lib/demo-context'
import type { BwtsAlert } from '@/lib/simulation/alert-engine'

function SeverityBadge({ severity }: { severity: BwtsAlert['severity'] }) {
  if (severity === 'CRITICAL') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold uppercase tracking-wider">
      <AlertTriangle className="w-3 h-3" /> Critical
    </span>
  )
  if (severity === 'WARNING') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-semibold uppercase tracking-wider">
      <AlertCircle className="w-3 h-3" /> Warning
    </span>
  )
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold uppercase tracking-wider">
      <Info className="w-3 h-3" /> Info
    </span>
  )
}

function StatusBadge({ status }: { status: BwtsAlert['status'] }) {
  if (status === 'RESOLVED') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">
      <CheckCircle className="w-3 h-3" /> Resolved
    </span>
  )
  if (status === 'ACKNOWLEDGED') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
      <Clock className="w-3 h-3" /> Acknowledged
    </span>
  )
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-medium animate-pulse">
      <Bell className="w-3 h-3" /> Active
    </span>
  )
}

function AlertCard({ alert, onAck, onResolve }: {
  alert: BwtsAlert
  onAck: (id: string) => void
  onResolve: (id: string) => void
}) {
  const t = useTranslations('AlertsTab')
  const locale = useLocale()

  return (
    <div className={`p-5 rounded-xl border transition-colors ${
      alert.severity === 'CRITICAL'
        ? 'bg-red-50/60 border-red-200/60'
        : 'bg-yellow-50/60 border-yellow-200/60'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5">
            <SeverityBadge severity={alert.severity} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-800 font-medium text-sm">{alert.parameter}</p>
            <p className="text-slate-500 text-xs mt-0.5">
              {t('valueVsThreshold', {
                current: alert.unit === 'bar' ? alert.currentValue.toFixed(3) : alert.currentValue.toFixed(1),
                threshold: alert.unit === 'bar' ? alert.threshold.toFixed(3) : alert.threshold.toFixed(0),
                unit: alert.unit,
                deviation: Math.abs(alert.deviation).toFixed(1),
              })}
            </p>
            <p className="text-slate-600 text-xs mt-2 leading-relaxed">{alert.recommendedAction}</p>
            <p className="text-slate-400 text-[10px] mt-2">
              {new Date(alert.timestamp).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {alert.status === 'ACTIVE' && (
            <button
              onClick={() => onAck(alert.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 text-white hover:bg-slate-800 transition-colors"
            >
              {t('acknowledge')}
            </button>
          )}
          {alert.status !== 'RESOLVED' && (
            <button
              onClick={() => onResolve(alert.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              {t('resolve')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AlertsTab() {
  const t = useTranslations('AlertsTab')
  const locale = useLocale()
  const { isDemoMode, activeAlerts, alertHistory, acknowledgeAlert, resolveAlert } = useDemoMode()

  if (!isDemoMode) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Bell className="w-10 h-10 text-slate-300" />
        <p className="text-slate-400 text-sm">{t('enableDemoMode')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Active Alerts */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <p className="text-slate-400 text-[10px] uppercase tracking-wider">{t('activeAlerts')}</p>
          {activeAlerts.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {activeAlerts.length}
            </span>
          )}
        </div>

        {activeAlerts.length === 0 ? (
          <div className="flex items-center gap-3 p-6 bg-emerald-50/60 rounded-xl border border-emerald-200/60">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <p className="text-emerald-700 text-sm">{t('noActiveAlerts')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAlerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAck={acknowledgeAlert}
                onResolve={resolveAlert}
              />
            ))}
          </div>
        )}
      </div>

      {/* Alert History */}
      <div>
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">{t('alertHistory')}</p>

        {alertHistory.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">{t('noHistory')}</p>
        ) : (
          <div className="bg-white/30 rounded-xl overflow-hidden">
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white/80 backdrop-blur-sm">
                  <tr className="text-slate-400 uppercase text-[9px] tracking-wider">
                    <th className="text-left px-4 py-2.5">{t('historyTime')}</th>
                    <th className="text-left px-3 py-2.5">{t('historySeverity')}</th>
                    <th className="text-left px-3 py-2.5">{t('historyParameter')}</th>
                    <th className="text-right px-3 py-2.5">{t('historyValue')}</th>
                    <th className="text-left px-3 py-2.5">{t('historyStatus')}</th>
                    <th className="text-left px-3 py-2.5">{t('historyResolved')}</th>
                  </tr>
                </thead>
                <tbody>
                  {alertHistory.map((alert, i) => (
                    <tr key={i} className="border-t border-white/20 hover:bg-white/20">
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                        {new Date(alert.timestamp).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2.5"><SeverityBadge severity={alert.severity} /></td>
                      <td className="px-3 py-2.5 text-slate-700 font-medium">{alert.parameter}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500">
                        {alert.unit === 'bar' ? alert.currentValue.toFixed(3) : alert.currentValue.toFixed(1)} {alert.unit}
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={alert.status} /></td>
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                        {alert.resolvedAt
                          ? new Date(alert.resolvedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
