'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

const LOCALES = [
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'ja', label: 'Japanese',   flag: '🇯🇵' },
  { code: 'ko', label: 'Korean',     flag: '🇰🇷' },
  { code: 'es', label: 'Spanish',    flag: '🇪🇸' },
  { code: 'pt', label: 'Portuguese', flag: '🇧🇷' },
]

export default function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleChange = (locale: string) => {
    document.cookie = `BWTS_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`
    startTransition(() => router.refresh())
  }

  return (
    <div className="relative inline-block">
      <select
        value={currentLocale}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="appearance-none bg-white/80 backdrop-blur-sm border border-slate-200/50 shadow-lg rounded-full
                   pl-4 pr-8 py-2 text-xs font-medium text-slate-700 cursor-pointer
                   focus:outline-none focus:ring-2 focus:ring-slate-300
                   disabled:opacity-60 disabled:cursor-wait"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>
    </div>
  )
}
