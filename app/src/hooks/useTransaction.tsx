import { useState, useCallback, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, Transaction, TransactionInstruction } from '@solana/web3.js'
import { toast } from 'sonner'

export type TransactionStep = 
  | 'preparing'
  | 'signing' 
  | 'sending'
  | 'confirming'
  | 'confirmed'
  | 'error'

interface UseTransactionOptions {
  onSuccess?: (signature: string) => void
  onError?: (error: Error) => void
  onStepChange?: (step: TransactionStep) => void
  maxRetries?: number
  skipPreflight?: boolean
  commitment?: 'processed' | 'confirmed' | 'finalized'
}

interface TransactionState {
  isLoading: boolean
  error: string | null
  signature: string | null
  step: TransactionStep | null
}

export const useTransaction = (options: UseTransactionOptions = {}) => {
  const { signTransaction, publicKey } = useWallet()
  const [state, setState] = useState<TransactionState>({
    isLoading: false,
    error: null,
    signature: null,
    step: null
  })
  
  const isProcessingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastTransactionRef = useRef<string | null>(null)
  const processedTransactionsRef = useRef<Set<string>>(new Set())

  const {
    onSuccess,
    onError,
    onStepChange,
    maxRetries = 2,
    skipPreflight = false,
    commitment = 'confirmed'
  } = options

  const updateStep = useCallback((step: TransactionStep) => {
    setState(prev => ({ ...prev, step }))
    onStepChange?.(step)
  }, [onStepChange])

  const getConnection = useCallback(() => {
    return new Connection('https://api.devnet.solana.com', commitment)
  }, [commitment])

  const getTransactionId = useCallback((transaction: Transaction): string => {
    const serialized = transaction.serialize({ requireAllSignatures: false })
    return Buffer.from(serialized).toString('base64')
  }, [])

  const sendTransactionWithRetry = useCallback(async (
    transaction: Transaction,
    retryCount = 0
  ): Promise<string> => {
    const connection = getConnection()
    
    try {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Transaction was cancelled')
      }

      const transactionId = getTransactionId(transaction)
      
      if (processedTransactionsRef.current.has(transactionId)) {
        throw new Error('Transaction already in progress')
      }

      processedTransactionsRef.current.add(transactionId)

      try {
        updateStep('preparing')
        
        const needsBlockhash = !transaction.recentBlockhash
        const needsFeePayer = !transaction.feePayer

        if (needsBlockhash || needsFeePayer) {
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(commitment)
          
          if (needsBlockhash) {
            transaction.recentBlockhash = blockhash
            transaction.lastValidBlockHeight = lastValidBlockHeight
          }
          
          if (needsFeePayer && publicKey) {
            transaction.feePayer = publicKey
          }
        }

        if (!signTransaction) {
          throw new Error('Wallet not connected or does not support signing')
        }

        updateStep('signing')
        const signedTransaction = await signTransaction(transaction)
        
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Transaction was cancelled')
        }

        updateStep('sending')
        const signature = await connection.sendRawTransaction(
          signedTransaction.serialize(),
          {
            skipPreflight,
            maxRetries: 0
          }
        )

        lastTransactionRef.current = signature

        updateStep('confirming')
        const confirmationBlockhash = transaction.recentBlockhash!
        const confirmationHeight = transaction.lastValidBlockHeight || undefined

        if (confirmationHeight) {
          await connection.confirmTransaction({
            signature,
            blockhash: confirmationBlockhash,
            lastValidBlockHeight: confirmationHeight
          }, commitment)
        } else {
          await connection.confirmTransaction(signature, commitment)
        }

        updateStep('confirmed')
        return signature

      } finally {
        processedTransactionsRef.current.delete(transactionId)
      }

    } catch (error: any) {
      console.error(`Transaction attempt ${retryCount + 1} failed:`, error)

      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Transaction was cancelled')
      }

      const isDuplicateError = 
        error.message?.includes('This transaction has already been processed') ||
        error.message?.includes('Transaction already in progress')

      if (isDuplicateError && lastTransactionRef.current) {
        console.log('Transaction already processed, using cached signature:', lastTransactionRef.current)
        updateStep('confirmed')
        return lastTransactionRef.current
      }

      const isBlockhashError = 
        error.message?.includes('Blockhash not found') ||
        error.message?.includes('block height exceeded') ||
        error.message?.includes('Transaction expired')

      const isNetworkError = 
        error.message?.includes('timeout') ||
        error.message?.includes('network') ||
        error.code === 'NETWORK_ERROR'

      const isSignatureError = 
        error.message?.includes('WalletSignTransactionError') ||
        error.message?.includes('Unexpected error')

      if (isSignatureError && retryCount === 0) {
        const cleanTransaction = Transaction.from(transaction.serialize({ requireAllSignatures: false }))
        cleanTransaction.recentBlockhash = undefined
        cleanTransaction.lastValidBlockHeight = undefined
        cleanTransaction.signatures = []
        
        console.log('Retrying with clean transaction parameters...')
        return sendTransactionWithRetry(cleanTransaction, retryCount + 1)
      }

      if ((isBlockhashError || isNetworkError) && retryCount < maxRetries) {
        console.log(`Retrying transaction (${retryCount + 1}/${maxRetries})...`)
        
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)))
        
        if (isBlockhashError) {
          transaction.recentBlockhash = undefined
          transaction.lastValidBlockHeight = undefined
        }
        
        return sendTransactionWithRetry(transaction, retryCount + 1)
      }

      updateStep('error')
      throw error
    }
  }, [signTransaction, publicKey, commitment, skipPreflight, maxRetries, getConnection, getTransactionId, updateStep])

  const executeTransaction = useCallback(async (
    transactionOrInstructions: Transaction | TransactionInstruction[]
  ) => {
    if (isProcessingRef.current) {
      console.warn('Transaction already in progress, ignoring duplicate request')
      return lastTransactionRef.current
    }

    isProcessingRef.current = true
    abortControllerRef.current = new AbortController()

    setState({
      isLoading: true,
      error: null,
      signature: null,
      step: 'preparing'
    })

    try {
      let transaction: Transaction

      if (transactionOrInstructions instanceof Transaction) {
        transaction = transactionOrInstructions
      } else {
        transaction = new Transaction()
        transaction.add(...transactionOrInstructions)
      }

      if (!signTransaction) {
        throw new Error('Wallet not connected')
      }

      const signature = await sendTransactionWithRetry(transaction)

      setState({
        isLoading: false,
        error: null,
        signature,
        step: 'confirmed'
      })

      onSuccess?.(signature)
      return signature

    } catch (error: any) {
      let errorMessage = error.message || 'Transaction failed'
      
      if (errorMessage.includes('This transaction has already been processed') && lastTransactionRef.current) {
        setState({
          isLoading: false,
          error: null,
          signature: lastTransactionRef.current,
          step: 'confirmed'
        })
        onSuccess?.(lastTransactionRef.current)
        return lastTransactionRef.current
      }
      
      setState({
        isLoading: false,
        error: errorMessage,
        signature: null,
        step: 'error'
      })

      console.error('Transaction failed:', error)
      
      if (!errorMessage.includes('cancelled') && !errorMessage.includes('already in progress')) {
        toast.error(errorMessage)
        onError?.(error)
      }
      
      throw error

    } finally {
      isProcessingRef.current = false
      abortControllerRef.current = null
    }
  }, [signTransaction, publicKey, sendTransactionWithRetry, onSuccess, onError])

  const reset = useCallback(() => {
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort()
    }
    
    isProcessingRef.current = false
    lastTransactionRef.current = null
    processedTransactionsRef.current.clear()
    
    setState({
      isLoading: false,
      error: null,
      signature: null,
      step: null
    })
  }, [])

  return {
    executeTransaction,
    reset,
    isLoading: state.isLoading,
    error: state.error,
    signature: state.signature,
    step: state.step
  }
}