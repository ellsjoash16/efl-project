import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
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
  const initial = loadFromStorage() ?? makeInitialState()
  const [S, setS] = useState<GameState>(initial)
  const [saveStatus, setSaveStatus] = useState(
    loadFromStorage() ? 'Loaded saved game.' : ''
  )
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const manualSave = useCallback(() => {
    setS(current => {
      const ok = saveToStorage(current)
      setSaveStatus(ok ? 'Saved to this browser.' : 'Save failed.')
      return current
    })
  }, [])

  const scheduleSave = useCallback((newState?: GameState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('Saving…')
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      if (newState) {
        const ok = saveToStorage(newState)
        setSaveStatus(ok ? 'Saved to this browser.' : 'Save failed.')
      } else {
        setS(current => {
          const ok = saveToStorage(current)
          setSaveStatus(ok ? 'Saved to this browser.' : 'Save failed.')
          return current
        })
      }
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
