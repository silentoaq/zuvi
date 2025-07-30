import { useEffect, useState } from 'react'
import { CheckCircle, Clock, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

export type TransactionStep = 
  | 'preparing'
  | 'signing' 
  | 'sending'
  | 'confirming'
  | 'confirmed'
  | 'error'

interface TransactionProgressProps {
  step: TransactionStep
  signature?: string | null
  error?: string | null
  className?: string
}

const STEPS = [
  { key: 'preparing', label: '準備交易', progress: 20 },
  { key: 'signing', label: '錢包簽名', progress: 40 },
  { key: 'sending', label: '發送交易', progress: 60 },
  { key: 'confirming', label: '區塊鏈確認', progress: 80 },
  { key: 'confirmed', label: '交易完成', progress: 100 }
] as const

export default function TransactionProgress({ 
  step, 
  signature, 
  error, 
  className 
}: TransactionProgressProps) {
  const [progress, setProgress] = useState(0)
  
  const currentStep = STEPS.find(s => s.key === step)
  const targetProgress = currentStep?.progress || 0

  useEffect(() => {
    if (step === 'error') {
      setProgress(0)
      return
    }

    const timer = setTimeout(() => {
      setProgress(targetProgress)
    }, 100)

    return () => clearTimeout(timer)
  }, [targetProgress, step])

  const getStepIcon = () => {
    switch (step) {
      case 'confirmed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      case 'confirming':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      default:
        return <Clock className="h-5 w-5 text-blue-600" />
    }
  }

  const getStatusBadge = () => {
    switch (step) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800">成功</Badge>
      case 'error':
        return <Badge className="bg-red-100 text-red-800">失敗</Badge>
      case 'confirming':
        return <Badge className="bg-blue-100 text-blue-800">確認中</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">進行中</Badge>
    }
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getStepIcon()}
              <div>
                <h3 className="font-medium">
                  {currentStep?.label || '處理中'}
                </h3>
                {error && (
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                )}
              </div>
            </div>
            {getStatusBadge()}
          </div>

          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress}%</span>
              <span>
                {step === 'confirmed' ? '完成' : step === 'error' ? '失敗' : '處理中'}
              </span>
            </div>
          </div>

          {signature && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">交易簽名</span>
                <button
                  onClick={() => {
                    const url = `https://explorer.solana.com/tx/${signature}?cluster=devnet`
                    window.open(url, '_blank')
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-mono"
                >
                  {signature.slice(0, 8)}...{signature.slice(-8)}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-5 gap-1 pt-2">
            {STEPS.map((stepItem, index) => (
              <div
                key={stepItem.key}
                className={`text-center ${
                  STEPS.findIndex(s => s.key === step) >= index
                    ? 'text-blue-600'
                    : 'text-gray-400'
                }`}
              >
                <div className={`h-2 w-full rounded ${
                  STEPS.findIndex(s => s.key === step) >= index
                    ? 'bg-blue-600'
                    : 'bg-gray-200'
                }`} />
                <span className="text-xs mt-1 block">{stepItem.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}