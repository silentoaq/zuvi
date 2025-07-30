import { useCallback, useRef } from 'react'
import { Transaction, TransactionInstruction } from '@solana/web3.js'
import { useTransaction, type TransactionStep } from './useTransaction'
import { useTransactionUI } from '@/components/transaction/TransactionProvider'
import { toast } from 'sonner'

interface UseTransactionWithUIOptions {
  title?: string
  showUI?: boolean
  onSuccess?: (signature: string) => void
  onError?: (error: Error) => void
  maxRetries?: number
  skipPreflight?: boolean
  commitment?: 'processed' | 'confirmed' | 'finalized'
}

export function useTransactionWithUI(options: UseTransactionWithUIOptions = {}) {
  const { showTransaction, updateTransaction, hideTransaction } = useTransactionUI()
  const transactionIdRef = useRef<string | null>(null)
  
  const {
    title = '處理交易',
    showUI = true,
    onSuccess: originalOnSuccess,
    onError: originalOnError,
    ...transactionOptions
  } = options

  const handleStepChange = useCallback((step: TransactionStep) => {
    if (showUI && transactionIdRef.current) {
      updateTransaction(transactionIdRef.current, { step })
    }
  }, [showUI, updateTransaction])

  const handleSuccess = useCallback((signature: string) => {
    if (showUI && transactionIdRef.current) {
      updateTransaction(transactionIdRef.current, { 
        step: 'confirmed', 
        signature 
      })
      
      setTimeout(() => {
        if (transactionIdRef.current) {
          hideTransaction(transactionIdRef.current)
          transactionIdRef.current = null
        }
      }, 3000)
    } else {
      toast.success('交易成功')
    }
    
    originalOnSuccess?.(signature)
  }, [showUI, updateTransaction, hideTransaction, originalOnSuccess])

  const handleError = useCallback((error: Error) => {
    if (showUI && transactionIdRef.current) {
      updateTransaction(transactionIdRef.current, { 
        step: 'error', 
        error: error.message 
      })
    } else {
      toast.error(error.message)
    }
    
    originalOnError?.(error)
  }, [showUI, updateTransaction, originalOnError])

  const {
    executeTransaction: originalExecuteTransaction,
    isLoading,
    error,
    signature,
    step,
    reset
  } = useTransaction({
    ...transactionOptions,
    onStepChange: handleStepChange,
    onSuccess: handleSuccess,
    onError: handleError
  })

  const executeTransaction = useCallback(async (
    transactionOrInstructions: Transaction | TransactionInstruction[]
  ) => {
    if (showUI) {
      transactionIdRef.current = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      showTransaction(transactionIdRef.current, title)
    }

    try {
      return await originalExecuteTransaction(transactionOrInstructions)
    } catch (error) {
      if (showUI && transactionIdRef.current) {
        updateTransaction(transactionIdRef.current, { 
          step: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
      throw error
    }
  }, [showUI, showTransaction, updateTransaction, title, originalExecuteTransaction])

  const resetWithUI = useCallback(() => {
    if (transactionIdRef.current) {
      hideTransaction(transactionIdRef.current)
      transactionIdRef.current = null
    }
    reset()
  }, [hideTransaction, reset])

  return {
    executeTransaction,
    reset: resetWithUI,
    isLoading,
    error,
    signature,
    step
  }
}