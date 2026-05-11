'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import FluidOverview from '@/components/dashboards/FluidOverview'
import PredictiveMaintenance from '@/components/dashboards/PredictiveMaintenance'
import TrendAnalysis from '@/components/dashboards/TrendAnalysis'
import ComplianceMonitoring from '@/components/dashboards/ComplianceMonitoring'
import ComparativeAnalysis from '@/components/dashboards/ComparativeAnalysis'
import DataExport from '@/components/dashboards/DataExport'
import AnalysisTab from '@/components/dashboards/AnalysisTab'
import AlertsTab from '@/components/dashboards/AlertsTab'
import { useDemoMode } from '@/lib/demo-context'
import DemoControls from '@/components/DemoControls'
import OperationToggle from '@/components/OperationToggle'
import DemoToggle from '@/components/DemoToggle'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function DashboardPage() {
  const t = useTranslations('Navigation')
  const [activeTab, setActiveTab] = useState('overview')
  const { activeAlerts } = useDemoMode()

  const alertCount = activeAlerts.length

  const tabs = [
    { id: 'overview', label: t('overview') },
    { id: 'predictive', label: t('predictive') },
    { id: 'trends', label: t('trends') },
    { id: 'compliance', label: t('compliance') },
    { id: 'comparative', label: t('comparative') },
    { id: 'export', label: t('export') },
    { id: 'analysis', label: t('analysis') },
    { id: 'alerts', label: t('alerts'), badge: alertCount > 0 ? alertCount : undefined },
  ]

  return (
    <div
      className="min-h-screen relative"
      style={{
        background: 'radial-gradient(ellipse at center, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)'
      }}
    >
      {/* Full-width Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/40 shadow-sm">
        <div className="flex items-center h-full px-4 gap-4">
          {/* Left spacer — mirrors right controls width to keep tabs visually centred */}
          <div className="flex-1" />

          {/* Centre: tab pill */}
          <div className="flex items-center gap-0.5 bg-white/60 backdrop-blur-sm border border-slate-200/50 shadow-md rounded-full px-2 py-1 shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right: demo controls + language — flex-1 keeps tabs centred */}
          <div className="flex-1 flex items-center justify-end gap-2">
            <DemoControls />
            <OperationToggle />
            <DemoToggle />
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      {/* Tab Content */}
      {activeTab === 'overview' && <FluidOverview />}

      {activeTab === 'predictive' && (
        <div className="pt-20 px-8 pb-8">
          <PredictiveMaintenance />
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="pt-20 px-8 pb-8">
          <TrendAnalysis />
        </div>
      )}

      {activeTab === 'compliance' && (
        <div className="pt-20 px-8 pb-8">
          <ComplianceMonitoring />
        </div>
      )}

      {activeTab === 'comparative' && (
        <div className="pt-20 px-8 pb-8">
          <ComparativeAnalysis />
        </div>
      )}

      {activeTab === 'export' && (
        <div className="pt-20 px-8 pb-8">
          <DataExport />
        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="pt-20 px-8 pb-8">
          <AnalysisTab />
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="pt-20 px-8 pb-8">
          <AlertsTab />
        </div>
      )}
    </div>
  )
}
