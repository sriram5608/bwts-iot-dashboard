'use client'

import { useTranslations } from 'next-intl'
import { Droplets, ArrowUp } from 'lucide-react'
import { useDemoMode } from '@/lib/demo-context'

export default function OperationToggle() {
  const t = useTranslations('DemoControls')
  const { isDemoMode, operationType, setOperationType } = useDemoMode()

  if (!isDemoMode) return null

  return (
    <div className="flex items-center gap-0.5 bg-white/60 border border-slate-200/50 rounded-full p-0.5">
      <button
        onClick={() => setOperationType('BALLAST')}
        title={t('ballast')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
          operationType === 'BALLAST'
            ? 'bg-blue-500 text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <Droplets className="w-3 h-3" />
        {t('ballast')}
      </button>
      <button
        onClick={() => setOperationType('DEBALLAST')}
        title={t('deballast')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
          operationType === 'DEBALLAST'
            ? 'bg-orange-500 text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <ArrowUp className="w-3 h-3" />
        {t('deballast')}
      </button>
    </div>
  )
}
