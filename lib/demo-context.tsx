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
    // Capture alert type before engine changes state
    const alert = getActiveAlerts().find(a => a.id === id)
    engineAck(id)
    setActiveAlerts([...getActiveAlerts()])
    // Persist to DB
    if (alert) {
      const instanceId = instanceIds.current.get(alert.type)
      if (instanceId) {
        fetch(`/api/alert-instances/${instanceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
        }).catch(() => {})
      }
    }
  }, [])

  const resolveAlert = useCallback((id: string) => {
    // Capture alert before engine changes state
    const alert = [...getActiveAlerts(), ...getAlertHistory()].find(a => a.id === id)
    engineResolve(id)
    setActiveAlerts([...getActiveAlerts()])
    setAlertHistory([...getAlertHistory()])
    // Persist to DB
    if (alert) {
      const instanceId = instanceIds.current.get(alert.type)
      if (instanceId) {
        fetch(`/api/alert-instances/${instanceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'RESOLVED' }),
        }).catch(() => {})
      }
    }
  }, [])

  // Polling ticker to refresh alert state in sync with demo data
  // Track which alert types have already triggered an email this demo session
  const emailedTypes = useRef<Set<string>>(new Set())
  // Map alert.type → DB instance id (so acknowledge/resolve can persist to DB)
  const instanceIds = useRef<Map<string, number>>(new Map())

  const alertTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!isDemoMode) {
      if (alertTickRef.current) clearInterval(alertTickRef.current)
      emailedTypes.current.clear()
      instanceIds.current.clear()
      return
    }
    alertTickRef.current = setInterval(() => {
      const current = getActiveAlerts()
      setActiveAlerts([...current])
      setAlertHistory([...getAlertHistory()])

      // Send email + create DB instance for any newly active alert type
      for (const alert of current) {
        if (alert.status === 'ACTIVE' && !emailedTypes.current.has(alert.type)) {
          emailedTypes.current.add(alert.type)
          fetch('/api/alerts/demo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: alert.type,
              severity: alert.severity,
              parameter: alert.parameter,
              currentValue: alert.currentValue,
              threshold: alert.threshold,
              unit: alert.unit,
              recommendedAction: alert.recommendedAction,
            }),
          })
            .then(r => r.json())
            .then(data => {
              if (data.instanceId) instanceIds.current.set(alert.type, data.instanceId)
            })
            .catch(() => {})
        }
      }
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
