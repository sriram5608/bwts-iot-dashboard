'use client'

import { useState } from 'react'
import FluidOverview from '@/components/dashboards/FluidOverview'
import PredictiveMaintenance from '@/components/dashboards/PredictiveMaintenance'
import TrendAnalysis from '@/components/dashboards/TrendAnalysis'
import ComplianceMonitoring from '@/components/dashboards/ComplianceMonitoring'
import ComparativeAnalysis from '@/components/dashboards/ComparativeAnalysis'
import DataExport from '@/components/dashboards/DataExport'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'predictive', label: 'Predictive' },
  { id: 'trends', label: 'Trends' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'comparative', label: 'Comparative' },
  { id: 'export', label: 'Export' },
]

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div 
      className="min-h-screen relative"
      style={{ 
        background: 'radial-gradient(ellipse at center, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)' 
      }}
    >
      {/* Floating Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm border border-slate-200/50 shadow-lg rounded-full px-2 py-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab Content */}
      {activeTab === 'overview' && <FluidOverview />}
      
      {activeTab === 'predictive' && (
        <div className="pt-24 px-8 pb-8">
          <PredictiveMaintenance />
        </div>
      )}
      
      {activeTab === 'trends' && (
        <div className="pt-24 px-8 pb-8">
          <TrendAnalysis />
        </div>
      )}
      
      {activeTab === 'compliance' && (
        <div className="pt-24 px-8 pb-8">
          <ComplianceMonitoring />
        </div>
      )}
      
      {activeTab === 'comparative' && (
        <div className="pt-24 px-8 pb-8">
          <ComparativeAnalysis />
        </div>
      )}
      
      {activeTab === 'export' && (
        <div className="pt-24 px-8 pb-8">
          <DataExport />
        </div>
      )}
    </div>
  )
}
