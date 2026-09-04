import { createContext, useContext } from 'react'

export const AppDataContext = createContext(null)

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData ต้องใช้ภายใน <AppDataProvider>')
  return ctx
}
