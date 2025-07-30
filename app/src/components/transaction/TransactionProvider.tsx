import type { ReactNode } from 'react'
import { createContext, useContext, useState, useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import TransactionProgress, { type TransactionStep } from './TransactionProgress'

interface TransactionInfo {
  id: string
  title: string
  step: TransactionStep
  signature?: string | null
  error?: string | null
}

interface TransactionContextType {
  showTransaction: (id: string, title: string) => void
  updateTransaction: (id: string, updates: Partial<Omit<TransactionInfo, 'id' | 'title'>>) => void
  hideTransaction: (id: string) => void
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined)

interface TransactionProviderProps {
  children: ReactNode
}

export function TransactionProvider({ children }: TransactionProviderProps) {
  const [transactions, setTransactions] = useState<Record<string, TransactionInfo>>({})
  const [activeTransactionId, setActiveTransactionId] = useState<string | null>(null)

  const showTransaction = useCallback((id: string, title: string) => {
    setTransactions(prev => ({
      ...prev,
      [id]: {
        id,
        title,
        step: 'preparing',
        signature: null,
        error: null
      }
    }))
    setActiveTransactionId(id)
  }, [])

  const updateTransaction = useCallback((id: string, updates: Partial<Omit<TransactionInfo, 'id' | 'title'>>) => {
    setTransactions(prev => {
      const existing = prev[id]
      if (!existing) return prev
      
      return {
        ...prev,
        [id]: { ...existing, ...updates }
      }
    })
  }, [])

  const hideTransaction = useCallback((id: string) => {
    setTransactions(prev => {
      const { [id]: removed, ...rest } = prev
      return rest
    })
    
    setActiveTransactionId(prev => prev === id ? null : prev)
  }, [])

  const activeTransaction = activeTransactionId ? transactions[activeTransactionId] : null

  const handleDialogChange = (open: boolean) => {
    if (!open && activeTransaction) {
      if (activeTransaction.step === 'confirmed' || activeTransaction.step === 'error') {
        hideTransaction(activeTransaction.id)
      }
    }
  }

  return (
    <TransactionContext.Provider value={{ showTransaction, updateTransaction, hideTransaction }}>
      {children}
      
      <Dialog open={!!activeTransaction} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-md">
          {activeTransaction && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-semibold">{activeTransaction.title}</h2>
              </div>
              
              <TransactionProgress
                step={activeTransaction.step}
                signature={activeTransaction.signature}
                error={activeTransaction.error}
              />
              
              {(activeTransaction.step === 'confirmed' || activeTransaction.step === 'error') && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => hideTransaction(activeTransaction.id)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    關閉
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TransactionContext.Provider>
  )
}

export function useTransactionUI() {
  const context = useContext(TransactionContext)
  if (!context) {
    throw new Error('useTransactionUI must be used within a TransactionProvider')
  }
  return context
}