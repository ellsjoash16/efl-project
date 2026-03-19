import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import type { GameState } from '../types'
import { makeInitialState, saveToStorage, loadFromStorage } from '../lib/gameLogic'

interface GameContextValue {
  S: GameState
  setS: React.Dispatch<React.SetStateAction<GameState>>
  saveStatus: string
  scheduleSave: (newState?: GameState) => void
  manualSave: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: React.ReactNode }) {
  const saved = loadFromStorage()
  const [S, setS] = useState<GameState>(saved ?? makeInitialState())
  const [saveStatus, setSaveStatus] = useState(saved ? 'Loaded saved game.' : '')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef(S)
  useEffect(() => { stateRef.current = S }, [S])

  const manualSave = useCallback(() => {
    const ok = saveToStorage(stateRef.current)
    setSaveStatus(ok ? 'Saved to this browser.' : 'Save failed.')
  }, [])

  const scheduleSave = useCallback((newState?: GameState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('Saving…')
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      const toSave = newState ?? stateRef.current
      const ok = saveToStorage(toSave)
      setSaveStatus(ok ? 'Saved to this browser.' : 'Save failed.')
    }, 250)
  }, [])

  return (
    <GameContext.Provider value={{ S, setS, saveStatus, scheduleSave, manualSave }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
