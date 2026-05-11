'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function ComplianceMonitoring() {
  const [latestTelemetry, setLatestTelemetry] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/telemetry/latest').then(res => res.json()),
      fetch('/api/events?limit=20').then(res => res.json())
    ])
      .then(([telemetry, eventsData]) => {
        setLatestTelemetry(telemetry)
        setEvents(eventsData)
        setLoading(false)
      })
      .catch(error => {
        console.error('Error fetching compliance data:', error)
        setLoading(false)
      })
  }, [])

  const calculateCompliance = () => {
    if (!latestTelemetry) return []

    const lastCheckDate = new Date(latestTelemetry.timestamp).toLocaleDateString()
    const imoCompliant = latestTelemetry.UVR_INTENSITY >= 252
    const uscgCompliant = latestTelemetry.UVR_INTENSITY >= 530
    const treatmentEffective = latestTelemetry.AVG_LAMP_EFFICIENCY >= 70
    const maintenanceOk = latestTelemetry.FAILED_LAMP_COUNT === 0

    return [
      {
        name: 'IMO D-2 Standard',
        status: imoCompliant ? 'compliant' : 'non-compliant',
        lastCheck: lastCheckDate,
        detail: `UV: ${latestTelemetry.UVR_INTENSITY?.toFixed(1)} W/m² (min: 252)`
      },
      {
        name: 'USCG Type Approval',
        status: uscgCompliant ? 'compliant' : 'warning',
        lastCheck: lastCheckDate,
        detail: `UV: ${latestTelemetry.UVR_INTENSITY?.toFixed(1)} W/m² (min: 530)`
      },
      {
        name: 'Treatment Effectiveness',
        status: treatmentEffective ? 'compliant' : 'warning',
        lastCheck: lastCheckDate,
        detail: `Lamp Efficiency: ${latestTelemetry.AVG_LAMP_EFFICIENCY?.toFixed(1)}%`
      },
      {
        name: 'Maintenance Records',
        status: maintenanceOk ? 'compliant' : 'warning',
        lastCheck: lastCheckDate,
        detail: `Failed Lamps: ${latestTelemetry.FAILED_LAMP_COUNT}`
      },
      {
        name: 'Certification Validity',
        status: 'compliant',
        lastCheck: '2026-01-01',
        detail: 'Valid until 2027-01-01'
      },
    ]
  }

  const complianceItems = calculateCompliance()
  const compliantCount = complianceItems.filter(item => item.status === 'compliant').length
  const complianceRate = complianceItems.length > 0 ? ((compliantCount / complianceItems.length) * 100).toFixed(0) : 0

  const auditTrail = events
    .slice(0, 8)
    .map(event => ({
      date: new Date(event.timestamp).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }),
      action: event.description || event.event_type,
      result: event.event_type === 'ALARM_TRIGGERED' ? 'ALERT' : 'PASS',
    }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-lg">Loading compliance data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-8">
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Compliance Rate</p>
          <p className={`text-4xl font-light ${Number(complianceRate) >= 80 ? 'text-emerald-600' : 'text-orange-500'}`}>
            {complianceRate}%
          </p>
          <p className="text-slate-400 text-xs">all standards</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Active Certifications</p>
          <p className="text-4xl font-light text-blue-500">{complianceItems.length}</p>
          <p className="text-slate-400 text-xs">{compliantCount} compliant</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Latest Check</p>
          <p className="text-2xl font-light text-slate-600">
            {latestTelemetry ? new Date(latestTelemetry.timestamp).toLocaleDateString() : '-'}
          </p>
          <p className="text-slate-400 text-xs">last update</p>
        </div>
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Issues</p>
          <p className={`text-4xl font-light ${complianceItems.filter(i => i.status !== 'compliant').length > 0 ? 'text-orange-500' : 'text-emerald-600'}`}>
            {complianceItems.filter(item => item.status !== 'compliant').length}
          </p>
          <p className="text-slate-400 text-xs">requires attention</p>
        </div>
      </div>

      {/* Compliance Status */}
      <div>
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">Compliance Status</p>
        <div className="space-y-3">
          {complianceItems.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-5 bg-white/30 rounded-xl hover:bg-white/50 transition-colors">
              <div className="flex items-center gap-4">
                {item.status === 'compliant' ? (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center" style={{ boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)' }}>
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                ) : item.status === 'warning' ? (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center" style={{ boxShadow: '0 4px 15px rgba(234, 179, 8, 0.3)' }}>
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center" style={{ boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}>
                    <XCircle className="w-5 h-5 text-white" />
                  </div>
                )}
                <div>
                  <p className="text-slate-700 font-medium">{item.name}</p>
                  <p className="text-slate-400 text-xs">{item.detail}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    item.status === 'compliant' ? 'bg-emerald-500' : 
                    item.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span className={`text-sm font-medium ${
                    item.status === 'compliant' ? 'text-emerald-600' : 
                    item.status === 'warning' ? 'text-yellow-600' : 'text-red-500'
                  }`}>
                    {item.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-1">Last: {item.lastCheck}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Row: Treatment Effectiveness + Audit Trail */}
      <div className="grid grid-cols-2 gap-8">
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">Treatment Effectiveness</p>
          <div className="bg-white/30 rounded-xl p-6 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm">IMO D-2 Compliance (≥252 W/m²)</span>
                <span className={`font-medium ${latestTelemetry?.UVR_INTENSITY >= 252 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {latestTelemetry ? (latestTelemetry.UVR_INTENSITY >= 252 ? 'PASS' : 'FAIL') : '-'}
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${latestTelemetry?.UVR_INTENSITY >= 252 ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-red-500 to-orange-500'}`}
                  style={{ width: latestTelemetry ? `${Math.min(100, (latestTelemetry.UVR_INTENSITY / 252) * 100)}%` : '0%' }}
                />
              </div>
              <p className="text-slate-400 text-xs mt-1">Current: {latestTelemetry?.UVR_INTENSITY?.toFixed(1) || '-'} W/m²</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm">USCG Compliance (≥530 W/m²)</span>
                <span className={`font-medium ${latestTelemetry?.UVR_INTENSITY >= 530 ? 'text-emerald-600' : 'text-yellow-600'}`}>
                  {latestTelemetry ? (latestTelemetry.UVR_INTENSITY >= 530 ? 'PASS' : 'MARGINAL') : '-'}
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${latestTelemetry?.UVR_INTENSITY >= 530 ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-yellow-500 to-orange-500'}`}
                  style={{ width: latestTelemetry ? `${Math.min(100, (latestTelemetry.UVR_INTENSITY / 530) * 100)}%` : '0%' }}
                />
              </div>
              <p className="text-slate-400 text-xs mt-1">Current: {latestTelemetry?.UVR_INTENSITY?.toFixed(1) || '-'} W/m²</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm">Avg Lamp Efficiency (≥70%)</span>
                <span className={`font-medium ${latestTelemetry?.AVG_LAMP_EFFICIENCY >= 70 ? 'text-emerald-600' : 'text-yellow-600'}`}>
                  {latestTelemetry?.AVG_LAMP_EFFICIENCY?.toFixed(1) || '-'}%
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${latestTelemetry?.AVG_LAMP_EFFICIENCY >= 70 ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-yellow-500 to-orange-500'}`}
                  style={{ width: `${latestTelemetry?.AVG_LAMP_EFFICIENCY || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-4">Audit Trail</p>
          <div className="bg-white/30 rounded-xl p-4 space-y-2 max-h-[300px] overflow-y-auto">
            {auditTrail.map((entry, index) => (
              <div key={index} className="flex items-start gap-3 p-3 hover:bg-white/30 rounded-lg transition-colors">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${entry.result === 'PASS' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 text-sm truncate">{entry.action}</p>
                  <p className="text-slate-400 text-xs">{entry.date}</p>
                </div>
                <span className={`text-xs font-medium ${entry.result === 'PASS' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {entry.result}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
