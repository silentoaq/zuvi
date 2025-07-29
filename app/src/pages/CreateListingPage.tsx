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
  success?: boolean
  disclosedData?: {
    address: string
    building_area: number
    use: string
  }
  error?: string
}

export default function CreateListingPage() {
  const { user } = useAuthStore()
  
  const [selectedCredential, setSelectedCredential] = useState<PropertyCredential | null>(null)
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set())
  const [disclosureStep, setDisclosureStep] = useState<'select' | 'waiting' | 'completed'>('select')
  const [vpRequestUri, setVpRequestUri] = useState<string>('')
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [disclosureStatus, setDisclosureStatus] = useState<DisclosureStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const propertyCredentials = user?.credentialStatus?.twland?.attestations || []

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedFields)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedFields(newExpanded)
  }

  const formatDisplayText = (text: string, key: string) => {
    const isExpanded = expandedFields.has(key)
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
      toast.success('憑證揭露請求已發起')
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
          console.log('Disclosure status:', status)
          setDisclosureStatus(status)
          
          if (status.status === 'completed' && status.success !== false) {
            clearInterval(pollInterval)
            setDisclosureStep('completed')
            toast.success('憑證揭露完成！')
          } else if (status.status === 'expired') {
            clearInterval(pollInterval)
            toast.error('揭露請求已過期，請重新開始')
            setDisclosureStep('select')
          } else if (status.success === false && status.error) {
            clearInterval(pollInterval)
            toast.error(`揭露失敗：${status.error}`)
            setDisclosureStep('select')
          }
        } else {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('API error:', error)
          toast.error(`API 錯誤：${error.error || 'Unknown error'}`)
          clearInterval(pollInterval)
          setDisclosureStep('select')
        }
      } catch (error) {
        console.error('Error polling disclosure status:', error)
        toast.error('網路錯誤，請檢查連線')
        clearInterval(pollInterval)
        setDisclosureStep('select')
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
    console.log('進入填寫房源資訊步驟')
    console.log('選擇的憑證:', selectedCredential)
    console.log('揭露資料:', disclosureStatus?.disclosedData)
    toast.info('進入下一步驟（開發中）')
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
        <p className="text-muted-foreground">步驟 1/3：選擇產權憑證</p>
      </div>

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
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">憑證地址</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpanded(`address-${credential.address}`)
                          }}
                          className="h-6 w-6 p-0"
                        >
                          {expandedFields.has(`address-${credential.address}`) ? 
                            <EyeOff className="h-3 w-3" /> : 
                            <Eye className="h-3 w-3" />
                          }
                        </Button>
                      </div>
                      <div className="font-mono text-xs bg-muted p-2 rounded break-all">
                        {formatDisplayText(credential.address, `address-${credential.address}`)}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">憑證ID</span>
                      <div className="font-mono text-xs bg-muted p-2 rounded mt-1 break-all">
                        {credential.data.credentialReference}
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">Merkle Root</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpanded(`merkle-${credential.data.merkleRoot}`)
                          }}
                          className="h-6 w-6 p-0"
                        >
                          {expandedFields.has(`merkle-${credential.data.merkleRoot}`) ? 
                            <EyeOff className="h-3 w-3" /> : 
                            <Eye className="h-3 w-3" />
                          }
                        </Button>
                      </div>
                      <div className="font-mono text-xs bg-muted p-2 rounded break-all">
                        {formatDisplayText(credential.data.merkleRoot, `merkle-${credential.data.merkleRoot}`)}
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
                  憑證編號: {selectedCredential.data.credentialReference}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <div className="p-6 bg-white rounded-2xl shadow-lg border">
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

      {disclosureStep === 'completed' && disclosureStatus?.success && disclosureStatus?.disclosedData && (
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
                  <div className="font-medium">{disclosureStatus.disclosedData.building_area} 坪</div>
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
    </div>
  )
}