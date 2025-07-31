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

interface CleanupInfo {
  ipfsHashes?: string[]
  imageIds?: string[]
  metadataHash?: string
  messageIpfsHash?: string
  oldMetadataHash?: string
  removedImageHashes?: string[]
}

interface UseTransactionOptions {
  onSuccess?: (signature: string) => void
  onError?: (error: Error) => void
  onStepChange?: (step: TransactionStep) => void
  maxRetries?: number
  skipPreflight?: boolean
  commitment?: 'processed' | 'confirmed' | 'finalized'
  cleanupInfo?: CleanupInfo
}

interface TransactionState {
  isLoading: boolean
  error: string | null
  signature: string | null
  step: TransactionStep | null
}

const callCleanupAPI = async (cleanupInfo: CleanupInfo) => {
  try {
    const token = localStorage.getItem('zuvi-auth-token')
    if (!token) return

    const ipfsHashes: string[] = []
    const imageIds: string[] = []

    if (cleanupInfo.ipfsHashes) ipfsHashes.push(...cleanupInfo.ipfsHashes)
    if (cleanupInfo.metadataHash) ipfsHashes.push(cleanupInfo.metadataHash)
    if (cleanupInfo.messageIpfsHash) ipfsHashes.push(cleanupInfo.messageIpfsHash)
    if (cleanupInfo.oldMetadataHash) ipfsHashes.push(cleanupInfo.oldMetadataHash)
    if (cleanupInfo.removedImageHashes) ipfsHashes.push(...cleanupInfo.removedImageHashes)
    
    if (cleanupInfo.imageIds) imageIds.push(...cleanupInfo.imageIds)

    if (ipfsHashes.length === 0 && imageIds.length === 0) return

    await fetch('/api/cleanup/transaction-failed', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ipfsHashes: ipfsHashes.length > 0 ? ipfsHashes : undefined,
        imageIds: imageIds.length > 0 ? imageIds : undefined
      })
    })
  } catch (error) {
    console.error('Cleanup API call failed:', error)
  }
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
  const processedTransactionsRef = useRef<Map<string, { timestamp: number; signature?: string }>>(new Map())
  const cleanupInfoRef = useRef<CleanupInfo | undefined>(options.cleanupInfo)

  const {
    onSuccess: originalOnSuccess,
    onError: originalOnError,
    onStepChange,
    maxRetries = 0, // 改為預設不重試
    skipPreflight = false,
    commitment = 'confirmed',
  } = options

  const updateStep = useCallback((step: TransactionStep) => {
    setState(prev => ({ ...prev, step }))
    onStepChange?.(step)
  }, [onStepChange])

  const getConnection = useCallback(() => {
    return new Connection('https://api.devnet.solana.com', commitment)
  }, [commitment])

  const getStableTransactionId = useCallback((transaction: Transaction): string => {
    const instructions = transaction.instructions.map(ix => ({
      programId: ix.programId.toString(),
      keys: ix.keys.map(k => ({
        pubkey: k.pubkey.toString(),
        isSigner: k.isSigner,
        isWritable: k.isWritable
      })),
      data: ix.data.toString('base64')
    }))
    
    return Buffer.from(JSON.stringify(instructions)).toString('base64')
  }, [])

  const cleanupOldTransactions = useCallback(() => {
    const now = Date.now()
    const timeout = 30000
    
    for (const [id, info] of processedTransactionsRef.current.entries()) {
      if (now - info.timestamp > timeout) {
        processedTransactionsRef.current.delete(id)
      }
    }
  }, [])

  const sendTransactionWithRetry = useCallback(async (
    transaction: Transaction,
    retryCount = 0,
    stableId?: string
  ): Promise<string> => {
    const connection = getConnection()
    
    try {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Transaction was cancelled')
      }

      cleanupOldTransactions()

      const transactionId = stableId || getStableTransactionId(transaction)
      
      const existingTransaction = processedTransactionsRef.current.get(transactionId)
      if (existingTransaction) {
        if (existingTransaction.signature) {
          console.log('Transaction already completed, returning cached signature:', existingTransaction.signature)
          updateStep('confirmed')
          return existingTransaction.signature
        }
        throw new Error('Transaction already in progress')
      }

      processedTransactionsRef.current.set(transactionId, { timestamp: Date.now() })

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
        processedTransactionsRef.current.set(transactionId, { 
          timestamp: Date.now(), 
          signature 
        })

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

      } catch (error: any) {
        if (!error.message?.includes('Transaction already in progress')) {
          processedTransactionsRef.current.delete(transactionId)
        }
        throw error
      }

    } catch (error: any) {

      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Transaction was cancelled')
      }

      const isAlreadyProcessedError = 
        error.message?.includes('This transaction has already been processed') ||
        error.message?.includes('AlreadyProcessed')

      if (isAlreadyProcessedError) {
        console.log('Transaction already processed, treating as success')
        updateStep('confirmed')
        return ''
      }

      const isDuplicateInProgressError = 
        error.message?.includes('Transaction already in progress')

      if (isDuplicateInProgressError) {
        const existingTransaction = processedTransactionsRef.current.get(stableId || getStableTransactionId(transaction))
        if (existingTransaction?.signature !== undefined) {
          console.log('Transaction already in progress, using cached result')
          updateStep('confirmed')
          return existingTransaction.signature
        }
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
        return sendTransactionWithRetry(cleanTransaction, retryCount + 1, stableId || getStableTransactionId(transaction))
      }

      if ((isBlockhashError || isNetworkError) && retryCount < maxRetries) {
        console.log(`Retrying transaction (${retryCount + 1}/${maxRetries})...`)
        
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)))
        
        if (isBlockhashError) {
          transaction.recentBlockhash = undefined
          transaction.lastValidBlockHeight = undefined
        }
        
        return sendTransactionWithRetry(transaction, retryCount + 1, stableId || getStableTransactionId(transaction))
      }

      updateStep('error')
      throw error
    }
  }, [signTransaction, publicKey, commitment, skipPreflight, maxRetries, getConnection, getStableTransactionId, updateStep, cleanupOldTransactions])

  const executeTransaction = useCallback(async (
    transactionOrInstructions: Transaction | TransactionInstruction[],
    dynamicCleanupInfo?: CleanupInfo
  ) => {
    if (isProcessingRef.current) {
      console.warn('Transaction already in progress, ignoring duplicate request')
      return lastTransactionRef.current
    }

    isProcessingRef.current = true
    abortControllerRef.current = new AbortController()
    
    const currentCleanupInfo = dynamicCleanupInfo || cleanupInfoRef.current

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

      originalOnSuccess?.(signature)
      return signature

    } catch (error: any) {
      let errorMessage = error.message || 'Transaction failed'
      
      if (errorMessage.includes('This transaction has already been processed') || 
          errorMessage.includes('AlreadyProcessed')) {
        console.log('Transaction already processed, treating as success')
        
        setState({
          isLoading: false,
          error: null,
          signature: '',
          step: 'confirmed'
        })
        originalOnSuccess?.('')
        return ''
      }
      
      setState({
        isLoading: false,
        error: errorMessage,
        signature: null,
        step: 'error'
      })

      console.error('Transaction failed:', error)
      
      if (!errorMessage.includes('cancelled') && 
          !errorMessage.includes('already in progress') &&
          !errorMessage.includes('This transaction has already been processed') &&
          !errorMessage.includes('AlreadyProcessed')) {
        toast.error(errorMessage)
        
        if (currentCleanupInfo) {
          await callCleanupAPI(currentCleanupInfo)
        }
        
        originalOnError?.(error)
      }
      
      throw error

    } finally {
      isProcessingRef.current = false
      abortControllerRef.current = null
    }
  }, [signTransaction, publicKey, sendTransactionWithRetry, originalOnSuccess, originalOnError])

  const updateCleanupInfo = useCallback((newCleanupInfo: CleanupInfo | undefined) => {
    cleanupInfoRef.current = newCleanupInfo
  }, [])

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
    updateCleanupInfo,
    isLoading: state.isLoading,
    error: state.error,
    signature: state.signature,
    step: state.step
  }
}