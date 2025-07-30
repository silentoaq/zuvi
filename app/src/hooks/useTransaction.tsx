import { useState, useCallback, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, Transaction, TransactionInstruction } from '@solana/web3.js'
import { toast } from 'sonner'

interface UseTransactionOptions {
  onSuccess?: (signature: string) => void
  onError?: (error: Error) => void
  maxRetries?: number
  skipPreflight?: boolean
  commitment?: 'processed' | 'confirmed' | 'finalized'
}

interface TransactionState {
  isLoading: boolean
  error: string | null
  signature: string | null
}

export const useTransaction = (options: UseTransactionOptions = {}) => {
  const { signTransaction } = useWallet()
  const [state, setState] = useState<TransactionState>({
    isLoading: false,
    error: null,
    signature: null
  })
  
  const isProcessingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const {
    onSuccess,
    onError,
    maxRetries = 3,
    skipPreflight = false,
    commitment = 'confirmed'
  } = options

  const getConnection = useCallback(() => {
    return new Connection(
      process.env.NODE_ENV === 'development' 
        ? 'https://api.devnet.solana.com' 
        : 'https://api.mainnet-beta.solana.com',
      commitment
    )
  }, [commitment])

  const sendTransactionWithRetry = useCallback(async (
    transaction: Transaction,
    retryCount = 0
  ): Promise<string> => {
    const connection = getConnection()
    
    try {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Transaction was cancelled')
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(commitment)
      transaction.recentBlockhash = blockhash
      transaction.lastValidBlockHeight = lastValidBlockHeight

      if (!signTransaction) {
        throw new Error('Wallet not connected or does not support signing')
      }

      const signedTransaction = await signTransaction(transaction)
      
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Transaction was cancelled')
      }

      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight,
          maxRetries: 0
        }
      )

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, commitment)

      return signature

    } catch (error: any) {
      console.error(`Transaction attempt ${retryCount + 1} failed:`, error)

      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Transaction was cancelled')
      }

      const isBlockhashError = 
        error.message?.includes('Blockhash not found') ||
        error.message?.includes('block height exceeded') ||
        error.message?.includes('Transaction expired')

      const isNetworkError = 
        error.message?.includes('timeout') ||
        error.message?.includes('network') ||
        error.code === 'NETWORK_ERROR'

      if ((isBlockhashError || isNetworkError) && retryCount < maxRetries) {
        console.log(`Retrying transaction (${retryCount + 1}/${maxRetries})...`)
        
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)))
        
        return sendTransactionWithRetry(transaction, retryCount + 1)
      }

      throw error
    }
  }, [signTransaction, commitment, skipPreflight, maxRetries, getConnection])

  const executeTransaction = useCallback(async (
    transactionOrInstructions: Transaction | TransactionInstruction[]
  ) => {
    if (isProcessingRef.current) {
      console.warn('Transaction already in progress, ignoring duplicate request')
      return
    }

    isProcessingRef.current = true
    abortControllerRef.current = new AbortController()

    setState({
      isLoading: true,
      error: null,
      signature: null
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
        signature
      })

      onSuccess?.(signature)
      return signature

    } catch (error: any) {
      const errorMessage = error.message || 'Transaction failed'
      
      setState({
        isLoading: false,
        error: errorMessage,
        signature: null
      })

      console.error('Transaction failed:', error)
      
      if (!errorMessage.includes('cancelled')) {
        toast.error(errorMessage)
        onError?.(error)
      }
      
      throw error

    } finally {
      isProcessingRef.current = false
      abortControllerRef.current = null
    }
  }, [signTransaction, sendTransactionWithRetry, onSuccess, onError])

  const reset = useCallback(() => {
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort()
    }
    
    isProcessingRef.current = false
    
    setState({
      isLoading: false,
      error: null,
      signature: null
    })
  }, [])

  return {
    executeTransaction,
    reset,
    isLoading: state.isLoading,
    error: state.error,
    signature: state.signature
  }
}