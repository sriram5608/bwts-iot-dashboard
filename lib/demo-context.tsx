'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type { AnomalyType } from '@/lib/simulation/bwts-simulator'
import {
  processReading,
  getActiveAlerts,
  getAlertHistory,
  acknowledgeAlert as engineAck,
  resolveAlert as engineResolve,
  resetAlerts,
  type BwtsAlert,
} from '@/lib/simulation/alert-engine'

type OperationType = 'BALLAST' | 'DEBALLAST'

interface DemoContextType {
  isDemoMode: boolean
  operationType: OperationType
  toggleDemoMode: () => void
  setOperationType: (op: OperationType) => void
  triggerAnomaly: (type: AnomalyType) => void
  acknowledgeAlert: (id: string) => void
  resolveAlert: (id: string) => void
  activeAlerts: BwtsAlert[]
  alertHistory: BwtsAlert[]
}

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  operationType: 'BALLAST',
  toggleDemoMode: () => {},
  setOperationType: () => {},
  triggerAnomaly: () => {},
  acknowledgeAlert: () => {},
  resolveAlert: () => {},
  activeAlerts: [],
  alertHistory: [],
})

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [operationType, setOperationTypeState] = useState<OperationType>('BALLAST')
  const [activeAlerts, setActiveAlerts] = useState<BwtsAlert[]>([])
  const [alertHistory, setAlertHistory] = useState<BwtsAlert[]>([])

  // Load persisted demo mode on mount (client-only)
  useEffect(() => {
    const saved = localStorage.getItem('bwts-demo-mode')
    if (saved === 'true') setIsDemoMode(true)
    const savedOp = localStorage.getItem('bwts-operation-type')
    if (savedOp === 'BALLAST' || savedOp === 'DEBALLAST') setOperationTypeState(savedOp)
  }, [])

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode(prev => {
      const next = !prev
      localStorage.setItem('bwts-demo-mode', String(next))
      if (!next) {
        resetAlerts()
        setActiveAlerts([])
        setAlertHistory([])
      }
      return next
    })
  }, [])

  const setOperationType = useCallback((op: OperationType) => {
    setOperationTypeState(op)
    localStorage.setItem('bwts-operation-type', op)
    fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setOperation', operationType: op }) })
  }, [])

  const triggerAnomaly = useCallback((type: AnomalyType) => {
    fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'anomaly', type }) })
    if (type === 'RESET_STORY') {
      resetAlerts()
      setActiveAlerts([])
      setAlertHistory([])
    }
  }, [])

  const acknowledgeAlert = useCallback((id: string) => {
    engineAck(id)
    setActiveAlerts([...getActiveAlerts()])
  }, [])

  const resolveAlert = useCallback((id: string) => {
    engineResolve(id)
    setActiveAlerts([...getActiveAlerts()])
    setAlertHistory([...getAlertHistory()])
  }, [])

  // Polling ticker to refresh alert state in sync with demo data
  const alertTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!isDemoMode) {
      if (alertTickRef.current) clearInterval(alertTickRef.current)
      return
    }
    alertTickRef.current = setInterval(() => {
      setActiveAlerts([...getActiveAlerts()])
      setAlertHistory([...getAlertHistory()])
    }, 2000)
    return () => { if (alertTickRef.current) clearInterval(alertTickRef.current) }
  }, [isDemoMode])

  return (
    <DemoContext.Provider value={{
      isDemoMode,
      operationType,
      toggleDemoMode,
      setOperationType,
      triggerAnomaly,
      acknowledgeAlert,
      resolveAlert,
      activeAlerts,
      alertHistory,
    }}>
      {children}
    </DemoContext.Provider>
  )
}

export function useDemoMode() {
  return useContext(DemoContext)
}
