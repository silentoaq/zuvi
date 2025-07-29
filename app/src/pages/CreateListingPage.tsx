import { useState, useEffect } from 'react'
import { Copy, CheckCircle, Clock, Building, Eye, EyeOff, Upload, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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

interface UploadedImage {
  id: string
  filename: string
  ipfsHash: string
  gatewayUrl: string
}

interface ListingFormData {
  title: string
  type: string
  area: number
  floor: number
  totalFloors: number
  bedroom: number
  bathroom: number
  balcony: boolean
  rent: number
  deposit: number
  facilities: string[]
  pet: boolean
  cooking: boolean
  waterBilling: string
  electricityBilling: string
  description: string
  uploadedImages: UploadedImage[]
}

const HOUSE_TYPES = [
  { value: 'entire', label: '整層住家' },
  { value: 'suite', label: '套房' },
  { value: 'room', label: '雅房' }
]

const FACILITIES = [
  '冷氣', '熱水器', '冰箱', '洗衣機', '網路/WiFi',
  '書桌', '衣櫃', '床具', '第四台', '微波爐', '烘衣機'
]

const BILLING_OPTIONS = [
  { value: 'utility', label: '帳單' },
  { value: 'fixed', label: '定價' }
]

export default function CreateListingPage() {
  const { user } = useAuthStore()
  
  const [selectedCredential, setSelectedCredential] = useState<PropertyCredential | null>(null)
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set())
  const [disclosureStep, setDisclosureStep] = useState<'select' | 'waiting' | 'completed' | 'form' | 'publish'>('select')
  const [vpRequestUri, setVpRequestUri] = useState<string>('')
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [disclosureStatus, setDisclosureStatus] = useState<DisclosureStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  const [formData, setFormData] = useState<ListingFormData>({
    title: '',
    type: '',
    area: 0,
    floor: 1,
    totalFloors: 1,
    bedroom: 1,
    bathroom: 1,
    balcony: false,
    rent: 0,
    deposit: 0,
    facilities: [],
    pet: false,
    cooking: false,
    waterBilling: 'utility',
    electricityBilling: 'utility',
    description: '',
    uploadedImages: []
  })

  const propertyCredentials = user?.credentialStatus?.twland?.attestations || []

  useEffect(() => {
    clearAllTempImages()
    
    return () => {
      clearAllTempImages()
    }
  }, [])

  const clearAllTempImages = async () => {
    try {
      const response = await fetch('/api/listings/temp-images', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })
      
      if (response.ok) {
        const { images } = await response.json()
        await Promise.all(
          images.map((img: UploadedImage) => 
            fetch(`/api/listings/image/${img.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
              }
            })
          )
        )
      }
    } catch (error) {
      console.error('Error clearing temp images:', error)
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
        }
      } catch (error) {
        console.error('Error polling disclosure status:', error)
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
    setDisclosureStep('form')
  }

  const handleFormChange = (field: keyof ListingFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleFacilityChange = (facility: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      facilities: checked 
        ? [...prev.facilities, facility]
        : prev.facilities.filter(f => f !== facility)
    }))
  }

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    
    const newImages = Array.from(files).filter(file => file.type.startsWith('image/'))
    if (newImages.length + formData.uploadedImages.length > 10) {
      toast.error('最多只能上傳10張照片')
      return
    }
    
    try {
      setUploading(true)
      const formDataToSend = new FormData()
      newImages.forEach(file => {
        formDataToSend.append('images', file)
      })

      const response = await fetch('/api/listings/upload-images', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        },
        body: formDataToSend
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const { images } = await response.json()
      setFormData(prev => ({
        ...prev,
        uploadedImages: [...prev.uploadedImages, ...images]
      }))
      
      toast.success(`成功上傳 ${images.length} 張照片`)
    } catch (error) {
      console.error('Error uploading images:', error)
      toast.error('照片上傳失敗')
    } finally {
      setUploading(false)
    }
  }

  const [deletingImages, setDeletingImages] = useState<Set<string>>(new Set())

  const removeImage = async (index: number) => {
    const imageToRemove = formData.uploadedImages[index]
    if (!imageToRemove || deletingImages.has(imageToRemove.id)) return

    setDeletingImages(prev => new Set(prev).add(imageToRemove.id))

    setFormData(prev => ({
      ...prev,
      uploadedImages: prev.uploadedImages.filter((_, i) => i !== index)
    }))

    try {
      const response = await fetch(`/api/listings/image/${imageToRemove.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Delete failed')
      }
      
      toast.success('照片已刪除')
    } catch (error) {
      console.error('Error removing image:', error)
      toast.error('刪除照片失敗，已回復')
      
      setFormData(prev => {
        const newImages = [...prev.uploadedImages]
        newImages.splice(index, 0, imageToRemove)
        return {
          ...prev,
          uploadedImages: newImages
        }
      })
    } finally {
      setDeletingImages(prev => {
        const newSet = new Set(prev)
        newSet.delete(imageToRemove.id)
        return newSet
      })
    }
  }

  const validateForm = () => {
    if (!formData.title.trim()) {
      toast.error('請填寫房源標題')
      return false
    }
    if (!formData.type) {
      toast.error('請選擇房屋類型')
      return false
    }
    if (formData.rent <= 0) {
      toast.error('請填寫正確的月租金')
      return false
    }
    if (formData.deposit <= 0 || formData.deposit < formData.rent || formData.deposit > formData.rent * 3) {
      toast.error('押金必須在1-3個月租金範圍內')
      return false
    }
    if (formData.floor > formData.totalFloors) {
      toast.error('樓層不能超過總樓層數')
      return false
    }
    return true
  }

  const handleFormSubmit = () => {
    if (!validateForm()) return
    setDisclosureStep('publish')
  }

  const handleStepBack = async (fromStep: string) => {
    if (fromStep === 'form' || fromStep === 'publish') {
      await clearAllTempImages()
      setFormData(prev => ({ ...prev, uploadedImages: [] }))
    }
    
    if (fromStep === 'waiting') {
      setDisclosureStep('select')
    } else if (fromStep === 'completed') {
      setDisclosureStep('select')
    } else if (fromStep === 'form') {
      setDisclosureStep('completed')
    } else if (fromStep === 'publish') {
      setDisclosureStep('form')
    }
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
          步驟 {disclosureStep === 'select' || disclosureStep === 'waiting' || disclosureStep === 'completed' ? '1' : 
                disclosureStep === 'form' ? '2' : '3'}/3：
          {disclosureStep === 'select' || disclosureStep === 'waiting' || disclosureStep === 'completed' ? '選擇產權憑證' :
           disclosureStep === 'form' ? '填寫房源資訊' : '預覽與發布'}
        </p>
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

              <div className="flex justify-center">
                <Button variant="outline" onClick={() => handleStepBack('waiting')}>
                  取消
                </Button>
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
                  <div className="font-medium">{disclosureStatus.disclosedData.building_area}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">使用類型</span>
                  <div className="font-medium">{disclosureStatus.disclosedData.use}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center space-x-4">
            <Button variant="outline" onClick={() => handleStepBack('completed')}>
              重新選擇
            </Button>
            <Button onClick={handleContinue} size="lg">
              繼續填寫房源資訊
            </Button>
          </div>
        </div>
      )}

      {disclosureStep === 'form' && (
        <div className="space-y-6">
          <Alert>
            <Building className="h-4 w-4" />
            <AlertDescription>
              請填寫詳細的房源資訊
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>房產基本資訊</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/50 p-4 rounded-lg">
                <div>
                  <span className="text-muted-foreground text-sm">房產地址</span>
                  <div className="font-medium">{disclosureStatus?.disclosedData?.address}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">建物面積</span>
                  <div className="font-medium">{disclosureStatus?.disclosedData?.building_area}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">使用類型</span>
                  <div className="font-medium">{disclosureStatus?.disclosedData?.use}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>基本資訊</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">房源標題</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleFormChange('title', e.target.value)}
                      placeholder="例：溫馨兩房一廳，近捷運站"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">房屋類型</Label>
                    <Select value={formData.type} onValueChange={(value) => handleFormChange('type', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇房屋類型" />
                      </SelectTrigger>
                      <SelectContent>
                        {HOUSE_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="area">室內面積 (坪)</Label>
                    <Input
                      id="area"
                      type="number"
                      value={formData.area || ''}
                      onChange={(e) => handleFormChange('area', parseInt(e.target.value) || 0)}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="floor">樓層</Label>
                    <Input
                      id="floor"
                      type="number"
                      value={formData.floor}
                      onChange={(e) => handleFormChange('floor', parseInt(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalFloors">總樓層</Label>
                    <Input
                      id="totalFloors"
                      type="number"
                      value={formData.totalFloors}
                      onChange={(e) => handleFormChange('totalFloors', parseInt(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bedroom">房間數</Label>
                    <Input
                      id="bedroom"
                      type="number"
                      value={formData.bedroom}
                      onChange={(e) => handleFormChange('bedroom', parseInt(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bathroom">衛浴數</Label>
                    <Input
                      id="bathroom"
                      type="number"
                      value={formData.bathroom}
                      onChange={(e) => handleFormChange('bathroom', parseInt(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>陽台</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox
                        id="balcony"
                        checked={formData.balcony}
                        onCheckedChange={(checked) => handleFormChange('balcony', !!checked)}
                      />
                      <Label htmlFor="balcony">有陽台</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>租金設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rent">月租金 (USDC)</Label>
                    <Input
                      id="rent"
                      type="number"
                      value={formData.rent || ''}
                      onChange={(e) => {
                        const newRent = parseInt(e.target.value) || 0
                        handleFormChange('rent', newRent)
                        if (newRent > 0 && formData.deposit === 0) {
                          handleFormChange('deposit', newRent * 2)
                        } else if (formData.deposit > 0 && newRent > 0) {
                          const currentMonths = Math.round(formData.deposit / (formData.rent || 1) * 2) / 2
                          handleFormChange('deposit', Math.round(currentMonths * newRent))
                        }
                      }}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deposit">押金</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="deposit"
                        type="number"
                        value={formData.rent > 0 && formData.deposit > 0 ? Math.round(formData.deposit / formData.rent * 2) / 2 : ''}
                        onChange={(e) => {
                          const months = parseFloat(e.target.value) || 0
                          handleFormChange('deposit', Math.round(months * formData.rent))
                        }}
                        min="1"
                        max="3"
                        step="0.5"
                        className="flex-1"
                        placeholder="2.0"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">個月租金</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formData.deposit > 0 && formData.rent > 0 && 
                        `約 ${formData.deposit.toLocaleString()} USDC (${Math.round(formData.deposit / formData.rent * 2) / 2} 個月)`
                      }
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>設施設備</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {FACILITIES.map(facility => (
                    <div key={facility} className="flex items-center space-x-2">
                      <Checkbox
                        id={`facility-${facility}`}
                        checked={formData.facilities.includes(facility)}
                        onCheckedChange={(checked) => handleFacilityChange(facility, !!checked)}
                      />
                      <Label htmlFor={`facility-${facility}`} className="text-sm">
                        {facility}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>租賃規則</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">住宿規範</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="pet"
                          checked={formData.pet}
                          onCheckedChange={(checked) => handleFormChange('pet', !!checked)}
                        />
                        <Label htmlFor="pet">可養寵物</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="cooking"
                          checked={formData.cooking}
                          onCheckedChange={(checked) => handleFormChange('cooking', !!checked)}
                        />
                        <Label htmlFor="cooking">可開伙</Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-base font-medium">水費計費方式</Label>
                      <RadioGroup 
                        value={formData.waterBilling} 
                        onValueChange={(value) => handleFormChange('waterBilling', value)}
                        className="space-y-2"
                      >
                        {BILLING_OPTIONS.map(option => (
                          <div key={`water-${option.value}`} className="flex items-center space-x-2">
                            <RadioGroupItem value={option.value} id={`water-${option.value}`} />
                            <Label htmlFor={`water-${option.value}`} className="text-sm">
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-base font-medium">電費計費方式</Label>
                      <RadioGroup 
                        value={formData.electricityBilling} 
                        onValueChange={(value) => handleFormChange('electricityBilling', value)}
                        className="space-y-2"
                      >
                        {BILLING_OPTIONS.map(option => (
                          <div key={`electricity-${option.value}`} className="flex items-center space-x-2">
                            <RadioGroupItem value={option.value} id={`electricity-${option.value}`} />
                            <Label htmlFor={`electricity-${option.value}`} className="text-sm">
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>房源描述</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="請詳細描述房源特色、周邊環境、交通便利性等..."
                  rows={4}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>房源照片</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e.target.files)}
                  className="hidden"
                  id="image-upload"
                  disabled={uploading}
                />

                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {formData.uploadedImages.map((image, index) => (
                      <div key={image.id} className={`relative group ${deletingImages.has(image.id) ? 'opacity-50' : ''}`}>
                        <img
                          src={image.gatewayUrl}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = `https://indigo-definite-coyote-168.mypinata.cloud/ipfs/${image.ipfsHash}`
                          }}
                          loading="lazy"
                        />
                        {index === 0 && (
                          <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
                            主圖
                          </div>
                        )}
                        {deletingImages.has(image.id) && (
                          <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
                            <div className="text-xs text-white">刪除中...</div>
                          </div>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index)}
                          disabled={deletingImages.has(image.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    {formData.uploadedImages.length < 10 && (
                      <Label htmlFor="image-upload" className={`cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <div className="w-full h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg flex flex-col items-center justify-center hover:border-muted-foreground/50 transition-colors">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground mt-1">
                            {uploading ? '上傳中...' : '添加照片'}
                          </span>
                        </div>
                      </Label>
                    )}
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    已上傳 {formData.uploadedImages.length} / 10 張照片，支援 JPG、PNG 格式
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center space-x-4">
            <Button variant="outline" onClick={() => handleStepBack('form')}>
              上一步
            </Button>
            <Button onClick={handleFormSubmit} size="lg">
              預覽與發布
            </Button>
          </div>
        </div>
      )}

      {disclosureStep === 'publish' && (
        <div className="space-y-6">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              預覽房源資訊，確認無誤後即可發布
            </AlertDescription>
          </Alert>

          <div className="text-center py-12">
            <p className="text-muted-foreground">Step 3 預覽與發布功能開發中...</p>
            <div className="mt-4 space-x-4">
              <Button variant="outline" onClick={() => handleStepBack('publish')}>
                返回編輯
              </Button>
              <Button disabled>
                發布房源
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}