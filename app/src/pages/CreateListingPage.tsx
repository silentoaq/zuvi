import { useState } from 'react'
import { Copy, CheckCircle, Clock, Building, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'

interface PropertyCredential {
  address: string
  data: {
    merkleRoot: string
    credentialReference: string
  }
  expiry: number
}

interface DisclosureStatus {
  status: 'pending' | 'completed' | 'expired'
  disclosedData?: {
    address: string
    buildingArea: number
    use: string
  }
  error?: string
}

export default function CreateListingPage() {
  const { user } = useAuthStore()
  
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [selectedCredential, setSelectedCredential] = useState<PropertyCredential | null>(null)
  const [expandedCredentials, setExpandedCredentials] = useState<Set<string>>(new Set())
  const [disclosureStep, setDisclosureStep] = useState<'select' | 'waiting' | 'completed'>('select')
  const [vpRequestUri, setVpRequestUri] = useState<string>('')
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [disclosureStatus, setDisclosureStatus] = useState<DisclosureStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const propertyCredentials = user?.credentialStatus?.twland?.attestations || []

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedCredentials)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedCredentials(newExpanded)
  }

  const formatDisplayText = (text: string, isExpanded: boolean) => {
    if (isExpanded) {
      return text
    }
    return `${text.slice(0, 8)}...${text.slice(-8)}`
  }

  const formatExpiry = (expiry: number) => {
    return new Date(expiry * 1000).toLocaleDateString('zh-TW')
  }

  const handleSelectCredential = (credential: PropertyCredential) => {
    setSelectedCredential(credential)
  }

  const handleStartDisclosure = async () => {
    if (!selectedCredential) return

    try {
      setLoading(true)
      const response = await fetch('/api/disclosure/property', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credentialId: selectedCredential.data.credentialReference
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create disclosure request')
      }

      const data = await response.json()
      setVpRequestUri(data.vpRequestUri)
      setQrCodeUrl(data.qrCodeUrl)
      setDisclosureStep('waiting')
      
      startPollingDisclosure(data.requestId, selectedCredential.data.credentialReference)
    } catch (error) {
      console.error('Error starting disclosure:', error)
      toast.error('無法發起憑證揭露，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  const startPollingDisclosure = async (reqId: string, credentialId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/disclosure/status/${reqId}/${credentialId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
          }
        })

        if (response.ok) {
          const status = await response.json()
          setDisclosureStatus(status)
          
          if (status.status === 'completed') {
            clearInterval(pollInterval)
            setDisclosureStep('completed')
          } else if (status.status === 'expired') {
            clearInterval(pollInterval)
            toast.error('揭露請求已過期，請重新開始')
            setDisclosureStep('select')
          }
        }
      } catch (error) {
        console.error('Error polling disclosure status:', error)
      }
    }, 2000)

    setTimeout(() => {
      clearInterval(pollInterval)
      if (disclosureStep === 'waiting') {
        toast.error('揭露請求超時，請重新開始')
        setDisclosureStep('select')
      }
    }, 300000)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已複製到剪貼簿')
  }

  const handleContinue = () => {
    setCurrentStep(2)
  }

  if (!user?.credentialStatus?.twland?.exists) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">刊登房源</h1>
          <p className="text-muted-foreground">發布您的租房資訊</p>
        </div>
        <Alert>
          <AlertDescription>
            您需要產權憑證才能刊登房源
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">刊登房源</h1>
        <p className="text-muted-foreground">
          步驟 {currentStep}/3：
          {currentStep === 1 && '選擇產權憑證'}
          {currentStep === 2 && '填寫房源資訊'}
          {currentStep === 3 && '預覽與發布'}
        </p>
      </div>

      {currentStep === 1 && (
        <>
          {disclosureStep === 'select' && (
            <div className="space-y-6">
              <Alert>
                <Building className="h-4 w-4" />
                <AlertDescription>
                  請選擇要刊登的房產憑證，我們需要驗證房產資訊
                </AlertDescription>
              </Alert>

              <div className="grid gap-4">
                {propertyCredentials.map((credential, index) => (
                  <Card 
                    key={credential.address} 
                    className={`cursor-pointer transition-colors ${
                      selectedCredential?.address === credential.address 
                        ? 'ring-2 ring-primary' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleSelectCredential(credential)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">房產憑證 #{index + 1}</CardTitle>
                        <Badge variant="outline">
                          {new Date(credential.expiry * 1000) > new Date() ? '有效' : '已過期'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">憑證地址</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpanded(credential.address)
                              }}
                              className="h-6 w-6 p-0"
                            >
                              {expandedCredentials.has(credential.address) ? 
                                <EyeOff className="h-3 w-3" /> : 
                                <Eye className="h-3 w-3" />
                              }
                            </Button>
                          </div>
                          <div className="font-mono text-xs bg-muted p-2 rounded mt-1 break-all">
                            {formatDisplayText(
                              credential.address, 
                              expandedCredentials.has(credential.address)
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">憑證ID</span>
                          <div className="font-mono text-xs bg-muted p-2 rounded mt-1 break-all">
                            {credential.data.credentialReference}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Merkle Root</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpanded(credential.data.merkleRoot)
                              }}
                              className="h-6 w-6 p-0"
                            >
                              {expandedCredentials.has(credential.data.merkleRoot) ? 
                                <EyeOff className="h-3 w-3" /> : 
                                <Eye className="h-3 w-3" />
                              }
                            </Button>
                          </div>
                          <div className="font-mono text-xs bg-muted p-2 rounded mt-1 break-all">
                            {formatDisplayText(
                              credential.data.merkleRoot,
                              expandedCredentials.has(credential.data.merkleRoot)
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">到期日</span>
                          <div className="text-xs bg-muted p-2 rounded mt-1">
                            {formatExpiry(credential.expiry)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedCredential && (
                <div className="flex justify-center">
                  <Button 
                    onClick={handleStartDisclosure}
                    disabled={loading}
                    size="lg"
                  >
                    {loading ? '發起中...' : '開始憑證揭露'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {disclosureStep === 'waiting' && (
            <div className="space-y-6">
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  請使用您的憑證錢包掃描 QR Code 完成選擇性揭露
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle className="text-center">掃描 QR Code</CardTitle>
                  {selectedCredential && (
                    <div className="text-center text-sm text-muted-foreground">
                      憑證ID: {selectedCredential.data.credentialReference}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-2xl shadow-sm border">
                      <img 
                        src={qrCodeUrl} 
                        alt="Disclosure QR Code"
                        className="w-64 h-64 rounded-xl"
                      />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">或複製連結：</div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 text-xs font-mono bg-muted p-2 rounded overflow-hidden">
                        {vpRequestUri}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(vpRequestUri)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-center text-sm text-muted-foreground">
                    等待憑證揭露完成...
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {disclosureStep === 'completed' && disclosureStatus?.disclosedData && (
            <div className="space-y-6">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  憑證揭露完成！已獲得房產資訊
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle>揭露的房產資訊</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-muted-foreground text-sm">房產地址</span>
                      <div className="font-medium">{disclosureStatus.disclosedData.address}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">建物面積</span>
                      <div className="font-medium">{disclosureStatus.disclosedData.buildingArea} 坪</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">使用類型</span>
                      <div className="font-medium">{disclosureStatus.disclosedData.use}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-center">
                <Button onClick={handleContinue} size="lg">
                  繼續填寫房源資訊
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          <Alert>
            <Building className="h-4 w-4" />
            <AlertDescription>
              根據您的產權憑證資訊，填寫詳細的房源資料
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>房產基本資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">房產地址</span>
                  <div className="font-medium">{disclosureStatus?.disclosedData?.address}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">建物面積</span>
                  <div className="font-medium">{disclosureStatus?.disclosedData?.buildingArea} 坪</div>
                </div>
                <div>
                  <span className="text-muted-foreground">憑證ID</span>
                  <div className="font-mono text-xs">{selectedCredential?.data.credentialReference}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">使用類型</span>
                  <div className="font-medium">{disclosureStatus?.disclosedData?.use}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center py-12">
            <p className="text-muted-foreground">房源資訊填寫表單開發中...</p>
            <div className="mt-4 space-x-4">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                上一步
              </Button>
              <Button onClick={() => setCurrentStep(3)}>
                下一步
              </Button>
            </div>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-6">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              最後檢查您的房源資訊，確認無誤後發布
            </AlertDescription>
          </Alert>

          <div className="text-center py-12">
            <p className="text-muted-foreground">預覽與發布功能開發中...</p>
            <div className="mt-4 space-x-4">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                上一步
              </Button>
              <Button>
                發布房源
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}