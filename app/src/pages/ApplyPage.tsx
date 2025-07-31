import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Copy, CheckCircle, Clock, User, Building, MessageSquare, CalendarIcon, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useTransaction } from '@/hooks'
import { toast } from 'sonner'
import { Transaction } from '@solana/web3.js'

interface CitizenCredential {
  exists: boolean
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
    birth_date: string
    gender: string
  }
  error?: string
}

interface Listing {
  publicKey: string
  owner: string
  address: string
  rent: string
  deposit: string
  status: number
  metadata?: {
    basic?: {
      title: string
      type: string
      area: number
    }
    features?: {
      bedroom: number
      livingroom: number
      bathroom: number
    }
    media?: {
      images: string[]
      primary_image: number
    }
  }
}

interface ApplicationFormData {
  occupation: string
  companyType: string
  moveInDate: Date | undefined
  leaseTermMonths: number
  message: string
}

const OCCUPATIONS = [
  '工程師', '教師', '學生', '服務業', '金融業', '醫療業', '自由業', '其他'
]

const COMPANY_TYPES = [
  '上班族', '自由業', '學生', '退休', '其他'
]

const LEASE_TERMS = [
  { value: 6, label: '6個月' },
  { value: 12, label: '12個月' },
  { value: 18, label: '18個月' },
  { value: 24, label: '24個月' }
]

export default function ApplyPage() {
  const { listingId } = useParams<{ listingId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'select' | 'waiting' | 'completed' | 'form' | 'preview' | 'submit'>('select')
  const [selectedCredential, setSelectedCredential] = useState<CitizenCredential | null>(null)
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set())
  const [vpRequestUri, setVpRequestUri] = useState<string>('')
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [disclosureStatus, setDisclosureStatus] = useState<DisclosureStatus | null>(null)
  const [processing, setProcessing] = useState(false)

  const [formData, setFormData] = useState<ApplicationFormData>({
    occupation: '',
    companyType: '',
    moveInDate: undefined,
    leaseTermMonths: 12,
    message: ''
  })

  const citizenCredential = user?.credentialStatus?.twfido

  useEffect(() => {
    if (listingId) {
      fetchListing(listingId)
    }
  }, [listingId])

  const fetchListing = async (id: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/listings/${id}`)
      if (response.ok) {
        const data = await response.json()
        setListing(data)

        if (data.status !== 0) {
          toast.error('此房源目前無法申請')
          navigate('/')
          return
        }

        if (data.owner === user?.publicKey) {
          toast.error('無法申請自己的房源')
          navigate('/')
          return
        }
      } else {
        throw new Error('房源不存在')
      }
    } catch (error) {
      toast.error('載入房源失敗')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

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

  const handleSelectCredential = () => {
    if (!citizenCredential?.exists) return

    const credentialId = citizenCredential.data?.credentialReference ||
      citizenCredential.data?.credentialId ||
      citizenCredential.address ||
      ''

    if (!credentialId) {
      toast.error('無法取得憑證ID，請檢查憑證狀態')
      return
    }

    setSelectedCredential({
      exists: citizenCredential.exists,
      address: citizenCredential.address || '',
      data: {
        merkleRoot: citizenCredential.data?.merkleRoot || '',
        credentialReference: credentialId
      },
      expiry: citizenCredential.expiry || 0
    })
  }

  const handleStartDisclosure = async () => {
    if (!selectedCredential) return

    const credentialId = selectedCredential.data.credentialReference
    if (!credentialId) {
      toast.error('憑證ID無效，請重新選擇憑證')
      return
    }

    try {
      setProcessing(true)

      const response = await fetch('/api/disclosure/citizen', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credentialId,
          requiredFields: ['birth_date', 'gender']
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create disclosure request')
      }

      const data = await response.json()
      setVpRequestUri(data.vpRequestUri)
      setQrCodeUrl(data.qrCodeUrl)
      setStep('waiting')

      startPollingDisclosure(data.requestId, credentialId)
      toast.success('憑證揭露請求已發起')
    } catch (error) {
      toast.error('無法發起憑證揭露，請稍後再試')
    } finally {
      setProcessing(false)
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

          if (status.status === 'completed' && status.success !== false) {
            clearInterval(pollInterval)
            setStep('completed')
            toast.success('憑證揭露完成！')
          } else if (status.status === 'expired') {
            clearInterval(pollInterval)
            toast.error('揭露請求已過期，請重新開始')
            setStep('select')
          } else if (status.success === false && status.error) {
            clearInterval(pollInterval)
            toast.error(`揭露失敗：${status.error}`)
            setStep('select')
          }
        }
      } catch (error) {
        clearInterval(pollInterval)
        setStep('select')
      }
    }, 2000)

    setTimeout(() => {
      clearInterval(pollInterval)
      if (step === 'waiting') {
        toast.error('揭露請求超時，請重新開始')
        setStep('select')
      }
    }, 300000)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已複製到剪貼簿')
  }

  const handleFormChange = (field: keyof ApplicationFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const validateForm = () => {
    if (!formData.occupation.trim()) {
      toast.error('請選擇職業')
      return false
    }
    if (!formData.companyType.trim()) {
      toast.error('請選擇工作性質')
      return false
    }
    if (!formData.moveInDate) {
      toast.error('請選擇期望入住日期')
      return false
    }
    if (!formData.message.trim()) {
      toast.error('請填寫自我介紹')
      return false
    }
    return true
  }

  const handleFormSubmit = () => {
    if (!validateForm()) return
    setStep('preview')
  }

  const handleSubmitApplication = useCallback(async () => {
    if (!listing || !selectedCredential || !disclosureStatus?.disclosedData) {
      toast.error('缺少必要資訊，請重新開始')
      return
    }

    try {
      const applicationData = {
        applicant: {
          occupation: formData.occupation,
          company_type: formData.companyType,
          birth_date: disclosureStatus.disclosedData.birth_date,
          gender: disclosureStatus.disclosedData.gender
        },
        preferences: {
          move_in_date: formData.moveInDate?.toISOString().split('T')[0],
          lease_term_months: formData.leaseTermMonths
        },
        message: formData.message,
        applied_at: new Date().toISOString()
      }

      const requestBody = {
        listing: listing.publicKey,
        tenantAttest: selectedCredential.address,
        message: applicationData
      }

      const response = await fetch('/api/applications/apply', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit application')
      }

      const { transaction: serializedTx, cleanup } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))

      const { executeTransaction } = useTransaction({
        onSuccess: () => {
          toast.success('申請提交成功！')
          setTimeout(() => {
            navigate('/applications')
          }, 2000)
        },
        cleanupInfo: cleanup ? {
          ipfsHashes: [cleanup.ipfsHash]
        } : undefined
      })

      await executeTransaction(tx)

    } catch (error) {
      console.error('Error submitting application:', error)
      toast.error(error instanceof Error ? error.message : '申請失敗，請稍後再試')
    }
  }, [listing, selectedCredential, disclosureStatus, formData, navigate])

  const formatPrice = (price: string) => {
    const num = parseInt(price) / 1_000_000
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  const handleStepBack = (fromStep: string) => {
    if (fromStep === 'waiting') {
      setStep('select')
    } else if (fromStep === 'completed') {
      setStep('select')
    } else if (fromStep === 'form') {
      setStep('completed')
    } else if (fromStep === 'preview') {
      setStep('form')
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-3/4 mx-auto"></div>
        <div className="h-48 bg-muted rounded"></div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold mb-4">房源不存在</h2>
        <Button onClick={() => navigate('/')}>回到首頁</Button>
      </div>
    )
  }

  if (!user?.credentialStatus?.twfido?.exists) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">申請租賃</h1>
          <p className="text-muted-foreground">需要自然人憑證才能申請租賃</p>
        </div>
        <Alert>
          <AlertDescription>
            請先完成自然人憑證驗證才能申請租賃
          </AlertDescription>
        </Alert>
        <div className="flex justify-center">
          <Button asChild>
            <a href="https://twfido.ddns.net" target="_blank" rel="noopener noreferrer">
              前往申請自然人憑證
            </a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">申請租賃</h1>
        <p className="text-muted-foreground">
          步驟 {step === 'select' || step === 'waiting' || step === 'completed' ? '1' :
            step === 'form' ? '2' : '3'}/3：
          {step === 'select' || step === 'waiting' || step === 'completed' ? '身份驗證' :
            step === 'form' ? '填寫申請資料' : '預覽與提交'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>申請房源</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            {listing.metadata?.media?.images?.[listing.metadata.media.primary_image || 0] ? (
              <img
                src={`https://indigo-definite-coyote-168.mypinata.cloud/ipfs/${listing.metadata.media.images[listing.metadata.media.primary_image || 0]}`}
                alt={listing.metadata?.basic?.title}
                className="w-20 h-20 object-cover rounded-lg"
              />
            ) : (
              <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                <Building className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold">{listing.metadata?.basic?.title || '房源'}</h3>
              <p className="text-sm text-muted-foreground">{listing.address}</p>
              <div className="flex items-center space-x-4 text-sm">
                <span>月租 ${formatPrice(listing.rent)} USDC</span>
                <span>押金 ${formatPrice(listing.deposit)} USDC</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {step === 'select' && (
        <div className="space-y-6">
          <Alert>
            <User className="h-4 w-4" />
            <AlertDescription>
              請先完成身份驗證，我們需要驗證您的身份資料
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>選擇自然人憑證</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Card
                className={`transition-all cursor-pointer ${selectedCredential ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                onClick={handleSelectCredential}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">自然人憑證 #1</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {new Date(citizenCredential?.expiry ? citizenCredential.expiry * 1000 : 0) > new Date() ? '有效' : '已過期'}
                      </Badge>
                    </div>
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
                            toggleExpanded(`address-${citizenCredential?.address}`)
                          }}
                          className="h-6 w-6 p-0"
                        >
                          {expandedFields.has(`address-${citizenCredential?.address}`) ?
                            <EyeOff className="h-3 w-3" /> :
                            <Eye className="h-3 w-3" />
                          }
                        </Button>
                      </div>
                      <div className="font-mono text-xs bg-muted p-2 rounded break-all">
                        {formatDisplayText(citizenCredential?.address || '', `address-${citizenCredential?.address}`)}
                      </div>
                    </div>

                    <div>
                      <span className="text-muted-foreground">憑證ID</span>
                      <div className="font-mono text-xs bg-muted p-2 rounded mt-1 break-all">
                        {citizenCredential?.data?.credentialReference || citizenCredential?.data?.credentialId || citizenCredential?.address || '未知'}
                      </div>
                    </div>

                    {citizenCredential?.data?.merkleRoot && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground">Merkle Root</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpanded(`merkle-${citizenCredential.data.merkleRoot}`)
                            }}
                            className="h-6 w-6 p-0"
                          >
                            {expandedFields.has(`merkle-${citizenCredential.data.merkleRoot}`) ?
                              <EyeOff className="h-3 w-3" /> :
                              <Eye className="h-3 w-3" />
                            }
                          </Button>
                        </div>
                        <div className="font-mono text-xs bg-muted p-2 rounded break-all">
                          {formatDisplayText(citizenCredential.data.merkleRoot, `merkle-${citizenCredential.data.merkleRoot}`)}
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="text-muted-foreground">到期日</span>
                      <div className="text-xs bg-muted p-2 rounded mt-1">
                        {formatExpiry(citizenCredential?.expiry || 0)}
                      </div>
                    </div>
                  </div>

                  {selectedCredential && (
                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                      將揭露：出生年月日、性別
                    </div>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {selectedCredential && (
            <div className="flex justify-center">
              <Button
                onClick={handleStartDisclosure}
                disabled={processing}
                size="lg"
              >
                {processing ? '發起中...' : '開始身份驗證'}
              </Button>
            </div>
          )}
        </div>
      )}

      {step === 'waiting' && (
        <div className="space-y-6">
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              請使用您的憑證錢包掃描 QR Code 完成身份驗證
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">掃描 QR Code</CardTitle>
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
                等待身份驗證完成...
              </div>

              <div className="flex justify-center">
                <Button variant="outline" onClick={() => handleStepBack('waiting')}>
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'completed' && disclosureStatus?.success && disclosureStatus?.disclosedData && (
        <div className="space-y-6">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              身份驗證完成！已取得身份資料
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>驗證的身份資料</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground text-sm">出生年月日</span>
                  <div className="font-medium">{disclosureStatus.disclosedData.birth_date}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">性別</span>
                  <div className="font-medium">{disclosureStatus.disclosedData.gender}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center space-x-4">
            <Button variant="outline" onClick={() => handleStepBack('completed')}>
              重新驗證
            </Button>
            <Button onClick={() => setStep('form')} size="lg">
              繼續填寫申請資料
            </Button>
          </div>
        </div>
      )}

      {step === 'form' && (
        <div className="space-y-6">
          <Alert>
            <MessageSquare className="h-4 w-4" />
            <AlertDescription>
              請填寫申請資料，讓房東更了解您
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>個人資料</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="occupation">職業</Label>
                  <Select value={formData.occupation} onValueChange={(value) => handleFormChange('occupation', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="請選擇職業" />
                    </SelectTrigger>
                    <SelectContent>
                      {OCCUPATIONS.map(occupation => (
                        <SelectItem key={occupation} value={occupation}>
                          {occupation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyType">工作性質</Label>
                  <Select value={formData.companyType} onValueChange={(value) => handleFormChange('companyType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="請選擇工作性質" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_TYPES.map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>租賃偏好</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="moveInDate">期望入住日期</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.moveInDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.moveInDate ? (
                          format(formData.moveInDate, "yyyy-MM-dd")
                        ) : (
                          <span>選擇日期</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 h-[320px] overflow-hidden" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={formData.moveInDate}
                        onSelect={(date) => handleFormChange('moveInDate', date)}
                        disabled={(date) =>
                          date < new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leaseTermMonths">期望租期</Label>
                  <Select value={formData.leaseTermMonths.toString()} onValueChange={(value) => handleFormChange('leaseTermMonths', parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEASE_TERMS.map(term => (
                        <SelectItem key={term.value} value={term.value.toString()}>
                          {term.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>自我介紹</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.message}
                onChange={(e) => handleFormChange('message', e.target.value)}
                placeholder="請簡單介紹自己，讓房東更了解您..."
                rows={4}
              />
            </CardContent>
          </Card>

          <div className="flex justify-center space-x-4">
            <Button variant="outline" onClick={() => handleStepBack('form')}>
              上一步
            </Button>
            <Button onClick={handleFormSubmit} size="lg">
              預覽申請
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && disclosureStatus?.disclosedData && (
        <div className="space-y-6">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              請確認申請資料，確認無誤後即可提交
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>申請預覽</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">身份資料</h4>
                <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-4 rounded-lg">
                  <div>
                    <span className="text-muted-foreground">出生年月日：</span>
                    <span>{disclosureStatus.disclosedData.birth_date}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">性別：</span>
                    <span>{disclosureStatus.disclosedData.gender}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">個人資料</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">職業：</span>
                    <span>{formData.occupation}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">工作性質：</span>
                    <span>{formData.companyType}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">租賃偏好</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">期望入住日期：</span>
                    <span>{formData.moveInDate ? format(formData.moveInDate, "yyyy-MM-dd") : '未設定'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">期望租期：</span>
                    <span>{formData.leaseTermMonths} 個月</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">自我介紹</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-line bg-muted/50 p-4 rounded-lg">
                  {formData.message}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center space-x-4">
            <Button variant="outline" onClick={() => handleStepBack('preview')}>
              返回編輯
            </Button>
            <Button onClick={handleSubmitApplication} size="lg">
              確認提交申請
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}