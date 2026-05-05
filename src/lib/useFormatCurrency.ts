import { useStore } from '../store'
import { formatCurrency } from './periods'

export function useFormatCurrency(): (n: number) => string {
  const ghostMode = useStore(s => s.ghostMode)
  return (n: number) => ghostMode ? '$••••' : formatCurrency(n)
}
