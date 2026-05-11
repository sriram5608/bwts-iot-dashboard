'use client'

import { useTranslations } from 'next-intl'
import { PlayCircle, Database } from 'lucide-react'
import { useDemoMode } from '@/lib/demo-context'

export default function DemoToggle() {
  const t = useTranslations('DemoControls')
  const { isDemoMode, toggleDemoMode } = useDemoMode()

  return (
    <button
      onClick={toggleDemoMode}
      title={isDemoMode ? t('historical') : t('liveDemo')}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
        isDemoMode
          ? 'bg-emerald-500 text-white shadow-md'
          : 'bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200/50'
      }`}
    >
      {isDemoMode ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <PlayCircle className="w-3.5 h-3.5" />
          {t('liveDemo')}
        </>
      ) : (
        <>
          <Database className="w-3.5 h-3.5" />
          {t('historical')}
        </>
      )}
    </button>
  )
}
