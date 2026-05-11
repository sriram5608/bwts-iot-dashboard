'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Settings2, Zap, Filter, Wind, RotateCcw } from 'lucide-react'
import { useDemoMode } from '@/lib/demo-context'
import type { AnomalyType } from '@/lib/simulation/bwts-simulator'

export default function DemoControls() {
  const t = useTranslations('DemoControls')
  const { isDemoMode, triggerAnomaly } = useDemoMode()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!isDemoMode) return null

  const actions: { label: string; type: AnomalyType; icon: React.ReactNode; color: string }[] = [
    { label: t('triggerLampFailure'), type: 'TRIGGER_LAMP_FAILURE', icon: <Zap className="w-3.5 h-3.5" />, color: 'text-orange-600' },
    { label: t('triggerFilterClog'), type: 'TRIGGER_FILTER_CLOG', icon: <Filter className="w-3.5 h-3.5" />, color: 'text-yellow-600' },
    { label: t('triggerFlowDeviation'), type: 'TRIGGER_FLOW_DEVIATION', icon: <Wind className="w-3.5 h-3.5" />, color: 'text-blue-600' },
    { label: t('resetDemo'), type: 'RESET_STORY', icon: <RotateCcw className="w-3.5 h-3.5" />, color: 'text-slate-500' },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-white/60 border border-slate-200/50 text-slate-600 hover:bg-white/80 transition-all"
      >
        <Settings2 className="w-3.5 h-3.5" />
        {t('demoControls')}
      </button>

      {open && (
        <div className="absolute top-9 right-0 z-50 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl min-w-[200px] py-1.5 overflow-hidden">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 px-3 pt-1 pb-1.5">Demo Controls</p>
          {actions.map(action => (
            <button
              key={action.type}
              onClick={() => { triggerAnomaly(action.type); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 transition-colors text-left ${action.color}`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
