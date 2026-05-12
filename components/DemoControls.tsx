'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Settings2, TrendingDown, Filter, Zap, RefreshCw, RotateCcw } from 'lucide-react'
import { useDemoMode } from '@/lib/demo-context'
import type { AnomalyType } from '@/lib/simulation/bwts-simulator'

export default function DemoControls() {
  const t = useTranslations('DemoControls')
  const { isDemoMode, triggerAnomaly } = useDemoMode()
  const [open, setOpen] = useState(false)
  const [activeScenario, setActiveScenario] = useState<AnomalyType | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!isDemoMode) return null

  const scenarios: {
    label: string
    type: AnomalyType
    icon: React.ReactNode
    color: string
    badge: string
    badgeColor: string
  }[] = [
    {
      label: t('scenarioA'),
      type: 'TRIGGER_UV_DEGRADATION',
      icon: <TrendingDown className="w-3.5 h-3.5" />,
      color: 'text-orange-600',
      badge: 'A',
      badgeColor: 'bg-orange-100 text-orange-700',
    },
    {
      label: t('scenarioB'),
      type: 'TRIGGER_FILTER_CLOG',
      icon: <Filter className="w-3.5 h-3.5" />,
      color: 'text-yellow-600',
      badge: 'B',
      badgeColor: 'bg-yellow-100 text-yellow-700',
    },
    {
      label: t('scenarioC'),
      type: 'TRIGGER_LPS_FAILURE',
      icon: <Zap className="w-3.5 h-3.5" />,
      color: 'text-red-600',
      badge: 'C',
      badgeColor: 'bg-red-100 text-red-700',
    },
    {
      label: t('scenarioD'),
      type: 'TRIGGER_CIP_FAILURE',
      icon: <RefreshCw className="w-3.5 h-3.5" />,
      color: 'text-purple-600',
      badge: 'D',
      badgeColor: 'bg-purple-100 text-purple-700',
    },
  ]

  function handleTrigger(type: AnomalyType) {
    triggerAnomaly(type)
    setActiveScenario(type)
    setOpen(false)
  }

  function handleReset() {
    triggerAnomaly('RESET_STORY')
    setActiveScenario(null)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
          activeScenario
            ? 'bg-orange-50 border-orange-200 text-orange-700'
            : 'bg-white/60 border-slate-200/50 text-slate-600 hover:bg-white/80'
        }`}
      >
        <Settings2 className="w-3.5 h-3.5" />
        {t('demoControls')}
        {activeScenario && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
      </button>

      {open && (
        <div className="absolute top-9 right-0 z-50 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl min-w-[230px] py-1.5 overflow-hidden">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 px-3 pt-1 pb-1.5">Scenarios</p>
          {scenarios.map(s => (
            <button
              key={s.type}
              onClick={() => handleTrigger(s.type)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 transition-colors text-left ${s.color} ${
                activeScenario === s.type ? 'bg-slate-50' : ''
              }`}
            >
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold flex-shrink-0 ${s.badgeColor}`}>
                {s.badge}
              </span>
              {s.icon}
              <span className="flex-1">{s.label}</span>
              {activeScenario === s.type && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse flex-shrink-0" />}
            </button>
          ))}
          <div className="border-t border-slate-100 mt-1 pt-1">
            <button
              onClick={handleReset}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 transition-colors text-left text-slate-500"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('resetDemo')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
