import { cookies } from 'next/headers'

export const SUPPORTED_LOCALES = ['en', 'ja', 'ko', 'es', 'pt'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]
export const DEFAULT_LOCALE: Locale = 'en'

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const val = cookieStore.get('BWTS_LOCALE')?.value
  return (val && SUPPORTED_LOCALES.includes(val as Locale)) ? (val as Locale) : DEFAULT_LOCALE
}
