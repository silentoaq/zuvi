import { useState, useCallback, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, Transaction, TransactionInstruction, type Commitment } from '@solana/web3.js'
import { toast } from 'sonner'

export type TransactionStep = 'preparing' | 'signing' | 'sending' | 'confirming' | 'confirmed' | 'error' | null

interface TransactionState {
  isLoading: boolean
  error: string | null
  signature: string | null
  step: TransactionStep
}

interface CleanupInfo {
  ipfsHashes?: string[]
  imageIds?: string[]
  metadataHash?: string
  messageIpfsHash?: string
  oldMetadataHash?: string
  removedImageHashes?: string[]
  imageHashes?: string[]
}

interface UseTransactionOptions {
  onSuccess?: (signature: string) => void
  onError?: (error: Error) => void
  onStepChange?: (step: TransactionStep) => void
  cleanupInfo?: CleanupInfo
  skipPreflight?: boolean
  commitment?: Commitment
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
    if (cleanupInfo.imageHashes) ipfsHashes.push(...cleanupInfo.imageHashes)
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

export function useTransaction(options: UseTransactionOptions = {}) {
  const { signTransaction, publicKey } = useWallet()
  
  const [state, setState] = useState<TransactionState>({
    isLoading: false,
    error: null,
    signature: null,
    step: null
  })

  const isProcessingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const cleanupInfoRef = useRef<CleanupInfo | undefined>(options.cleanupInfo)

  const {
    onSuccess: originalOnSuccess,
    onError: originalOnError,
    onStepChange,
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

  const sendTransaction = useCallback(async (transaction: Transaction): Promise<string> => {
    const connection = getConnection()
    
    if (abortControllerRef.current?.signal.aborted) {
      throw new Error('Transaction was cancelled')
    }

    updateStep('preparing')
    
    if (!transaction.recentBlockhash || !transaction.feePayer) {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(commitment)
      
      if (!transaction.recentBlockhash) {
        transaction.recentBlockhash = blockhash
        transaction.lastValidBlockHeight = lastValidBlockHeight
      }
      
      if (!transaction.feePayer && publicKey) {
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

    updateStep('confirming')
    
    if (transaction.lastValidBlockHeight) {
      await connection.confirmTransaction({
        signature,
        blockhash: transaction.recentBlockhash!,
        lastValidBlockHeight: transaction.lastValidBlockHeight
      }, commitment)
    } else {
      await connection.confirmTransaction(signature, commitment)
    }

    updateStep('confirmed')
    return signature
  }, [signTransaction, publicKey, commitment, skipPreflight, getConnection, updateStep])

  const executeTransaction = useCallback(async (
    transactionOrInstructions: Transaction | TransactionInstruction[],
    dynamicCleanupInfo?: CleanupInfo
  ) => {
    if (isProcessingRef.current) {
      console.warn('Transaction already in progress, ignoring duplicate request')
      return null
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

      const signature = await sendTransaction(transaction)

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
          !errorMessage.includes('already in progress')) {
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
  }, [signTransaction, sendTransaction, originalOnSuccess, originalOnError])

  const updateCleanupInfo = useCallback((newCleanupInfo: CleanupInfo | undefined) => {
    cleanupInfoRef.current = newCleanupInfo
  }, [])

  const reset = useCallback(() => {
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort()
    }
    
    isProcessingRef.current = false
    
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