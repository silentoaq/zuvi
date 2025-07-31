import { useState, useEffect, useCallback } from 'react'
import { Copy, CheckCircle, Clock, Building, Eye, EyeOff, Upload, X, Bed, Bath, Sofa } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAuthStore } from '@/stores/authStore'
import { useTransaction } from '@/hooks'
import { toast } from 'sonner'
import { Transaction } from '@solana/web3.js'

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
  livingroom: number
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

interface ExistingListing {
  publicKey: string
  propertyAttest: string
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
  const [existingListings, setExistingListings] = useState<ExistingListing[]>([])
  const [loadingExistingListings, setLoadingExistingListings] = useState(true)
  const [deletingImages, setDeletingImages] = useState<Set<string>>(new Set())
  const [cleanupInfo, setCleanupInfo] = useState<{ metadataHash?: string; imageHashes?: string[] } | null>(null)

  const [formData, setFormData] = useState<ListingFormData>({
    title: '',
    type: '',
    area: 0,
    floor: 1,
    totalFloors: 1,
    bedroom: 1,
    livingroom: 0,
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

  const publishTransaction = useTransaction({
    onSuccess: () => {
      toast.success('房源發布成功！')
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    },
    onError: async () => {
      await clearAllTempImages()
      setFormData(prev => ({ ...prev, uploadedImages: [] }))

      if (cleanupInfo?.metadataHash || cleanupInfo?.imageHashes) {
        try {
          await fetch('/api/cleanup/transaction-failed', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ipfsHashes: cleanupInfo.metadataHash ? [cleanupInfo.metadataHash] : undefined,
              imageIds: cleanupInfo.imageHashes
            })
          })
        } catch (error) {
          console.error('Cleanup failed:', error)
        }
      }
    }
  })

  useEffect(() => {
    clearAllTempImages()
    if (user?.publicKey) {
      fetchExistingListings()
    }

    const handleBeforeUnload = () => {
      clearAllTempImages()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      clearAllTempImages()
    }
  }, [user?.publicKey])

  const fetchExistingListings = async () => {
    try {
      setLoadingExistingListings(true)
      const response = await fetch(`/api/listings?owner=${user?.publicKey}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const listings = data.listings || []
        setExistingListings(listings.map((listing: any) => ({
          publicKey: listing.publicKey,
          propertyAttest: listing.propertyAttest
        })))
      }
    } catch (error) {
      console.error('Error fetching existing listings:', error)
    } finally {
      setLoadingExistingListings(false)
    }
  }

  const isCredentialUsed = (credentialAddress: string) => {
    return existingListings.some(listing => listing.propertyAttest === credentialAddress)
  }

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
            fetch(`/api/listings/image/${img.ipfsHash}`, { // 使用 ipfsHash
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
    if (isCredentialUsed(credential.address)) {
      return
    }
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]

    if (!file.type.startsWith('image/')) {
      toast.error('請選擇圖片檔案')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('圖片大小不能超過 5MB')
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('images', file) // 改為 images（複數）

      const response = await fetch('/api/listings/upload-images', { // 改為正確的端點
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()

      // API 返回 images 陣列，取第一個
      if (data.images && data.images.length > 0) {
        setFormData(prev => ({
          ...prev,
          uploadedImages: [...prev.uploadedImages, data.images[0]]
        }))
        toast.success('照片上傳成功')
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error('照片上傳失敗，請稍後再試')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemoveImage = async (index: number) => {
    const imageToRemove = formData.uploadedImages[index]
    if (!imageToRemove || deletingImages.has(imageToRemove.ipfsHash)) return

    setDeletingImages(prev => new Set(prev).add(imageToRemove.ipfsHash))

    setFormData(prev => ({
      ...prev,
      uploadedImages: prev.uploadedImages.filter((_, i) => i !== index)
    }))

    try {
      const response = await fetch(`/api/listings/image/${imageToRemove.ipfsHash}`, {
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
        newSet.delete(imageToRemove.ipfsHash)
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
    if (fromStep === 'form') {
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

  const handlePublish = useCallback(async () => {
    if (!selectedCredential || !disclosureStatus?.disclosedData) {
      toast.error('缺少必要資訊，請重新開始')
      return
    }

    try {
      const metadata = {
        version: '1.0',
        basic: {
          title: formData.title,
          type: HOUSE_TYPES.find(t => t.value === formData.type)?.label || formData.type,
          area: formData.area,
          floor: formData.floor,
          total_floors: formData.totalFloors
        },
        features: {
          bedroom: formData.bedroom,
          livingroom: formData.livingroom,
          bathroom: formData.bathroom,
          balcony: formData.balcony
        },
        rent: formData.rent,
        facilities: formData.facilities,
        rules: {
          pet: formData.pet,
          cooking: formData.cooking,
          utilities: {
            water: BILLING_OPTIONS.find(b => b.value === formData.waterBilling)?.label || formData.waterBilling,
            electricity: BILLING_OPTIONS.find(b => b.value === formData.electricityBilling)?.label || formData.electricityBilling
          }
        },
        description: formData.description,
        media: {
          images: formData.uploadedImages.map(img => img.ipfsHash),
          primary_image: 0
        }
      }

      const requestBody = {
        propertyAttest: selectedCredential.address,
        credentialId: selectedCredential.data.credentialReference,
        rent: formData.rent * 1_000_000,
        deposit: formData.deposit * 1_000_000,
        metadata,
        imageIds: formData.uploadedImages.map(img => img.ipfsHash) // 使用 ipfsHash
      }

      const response = await fetch('/api/listings/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create listing')
      }

      const { transaction: serializedTx, cleanup } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))

      setCleanupInfo(cleanup || null)

      if (cleanup) {
        publishTransaction.updateCleanupInfo({
          metadataHash: cleanup.metadataHash,
          imageIds: cleanup.imageHashes
        })
      }

      await publishTransaction.executeTransaction(tx)

    } catch (error) {
      console.error('Error publishing listing:', error)
      await clearAllTempImages()
      setFormData(prev => ({ ...prev, uploadedImages: [] }))
      toast.error(error instanceof Error ? error.message : '發布失敗，請稍後再試')
    }
  }, [selectedCredential, disclosureStatus, formData, publishTransaction])

  const getHouseTypeLabel = (value: string) => {
    return HOUSE_TYPES.find(t => t.value === value)?.label || value
  }

  const getBillingLabel = (value: string) => {
    return BILLING_OPTIONS.find(b => b.value === value)?.label || value
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

          {loadingExistingListings ? (
            <div className="grid gap-4">
              {[...Array(2)].map((_, index) => (
                <Card key={index} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4">
              {propertyCredentials.map((credential, index) => {
                const isUsed = isCredentialUsed(credential.address)
                const isExpired = new Date(credential.expiry * 1000) <= new Date()
                const isDisabled = isUsed || isExpired

                return (
                  <Card
                    key={credential.address}
                    className={`transition-all ${isDisabled
                      ? 'opacity-50 cursor-not-allowed bg-muted/30'
                      : selectedCredential?.address === credential.address
                        ? 'ring-2 ring-primary cursor-pointer'
                        : 'hover:bg-muted/50 cursor-pointer'
                      }`}
                    onClick={() => handleSelectCredential(credential)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">房產憑證 #{index + 1}</CardTitle>
                        <div className="flex items-center gap-2">
                          {isUsed && (
                            <Badge variant="destructive">已刊登</Badge>
                          )}
                          {isExpired && (
                            <Badge variant="secondary">已過期</Badge>
                          )}
                          {!isDisabled && (
                            <Badge variant="outline">
                              {new Date(credential.expiry * 1000) > new Date() ? '有效' : '已過期'}
                            </Badge>
                          )}
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

                      {isUsed && (
                        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded border-l-4 border-destructive">
                          此憑證已用於刊登房源，無法重複使用
                        </div>
                      )}

                      {selectedCredential?.address === credential.address && !isUsed && (
                        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                          將揭露：房產地址、建物面積、使用類型
                        </div>
                      )}

                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {selectedCredential && (
            <div className="flex justify-center">
              <Button
                onClick={handleStartDisclosure}
                disabled={loading}
                size="lg"
              >
                {loading ? '發起中...' : '開始房產驗證'}
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
              請使用您的憑證錢包掃描 QR Code 完成房產驗證
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
                等待房產驗證完成...
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
                    <Select
                      value={formData.type}
                      onValueChange={(value) => handleFormChange('type', value)}
                    >
                      <SelectTrigger id="type">
                        <SelectValue placeholder="請選擇房屋類型" />
                      </SelectTrigger>
                      <SelectContent>
                        {HOUSE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="area">實際使用坪數</Label>
                    <Input
                      id="area"
                      type="number"
                      value={formData.area}
                      onChange={(e) => handleFormChange('area', parseInt(e.target.value) || 0)}
                      placeholder="坪"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="floor">所在樓層</Label>
                    <Input
                      id="floor"
                      type="number"
                      value={formData.floor}
                      onChange={(e) => handleFormChange('floor', parseInt(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalFloors">總樓層數</Label>
                    <Input
                      id="totalFloors"
                      type="number"
                      value={formData.totalFloors}
                      onChange={(e) => handleFormChange('totalFloors', parseInt(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>空間配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bedroom">房間數</Label>
                    <Input
                      id="bedroom"
                      type="number"
                      value={formData.bedroom}
                      onChange={(e) => handleFormChange('bedroom', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="livingroom">客廳數</Label>
                    <Input
                      id="livingroom"
                      type="number"
                      value={formData.livingroom}
                      onChange={(e) => handleFormChange('livingroom', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bathroom">衛浴數</Label>
                    <Input
                      id="bathroom"
                      type="number"
                      value={formData.bathroom}
                      onChange={(e) => handleFormChange('bathroom', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="balcony">陽台</Label>
                    <div className="pt-2">
                      <Checkbox
                        id="balcony"
                        checked={formData.balcony}
                        onCheckedChange={(checked) => handleFormChange('balcony', checked)}
                      />
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
                      value={formData.rent}
                      onChange={(e) => handleFormChange('rent', parseInt(e.target.value) || 0)}
                      placeholder="0"
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deposit">押金 (USDC)</Label>
                    <Input
                      id="deposit"
                      type="number"
                      value={formData.deposit}
                      onChange={(e) => handleFormChange('deposit', parseInt(e.target.value) || 0)}
                      placeholder="0"
                      min="1"
                    />
                    <div className="text-xs text-muted-foreground">
                      建議設定為 1-3 個月租金
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>設備設施</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {FACILITIES.map((facility) => (
                    <div key={facility} className="flex items-center space-x-2">
                      <Checkbox
                        id={facility}
                        checked={formData.facilities.includes(facility)}
                        onCheckedChange={(checked) => handleFacilityChange(facility, checked as boolean)}
                      />
                      <label
                        htmlFor={facility}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {facility}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>租屋規則</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>寵物</Label>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="pet"
                          checked={formData.pet}
                          onCheckedChange={(checked) => handleFormChange('pet', checked)}
                        />
                        <label
                          htmlFor="pet"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          允許養寵物
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>開伙</Label>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="cooking"
                          checked={formData.cooking}
                          onCheckedChange={(checked) => handleFormChange('cooking', checked)}
                        />
                        <label
                          htmlFor="cooking"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          允許開伙
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>水費計算</Label>
                    <RadioGroup
                      value={formData.waterBilling}
                      onValueChange={(value) => handleFormChange('waterBilling', value)}
                    >
                      {BILLING_OPTIONS.map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.value} id={`water-${option.value}`} />
                          <label htmlFor={`water-${option.value}`}>{option.label}</label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label>電費計算</Label>
                    <RadioGroup
                      value={formData.electricityBilling}
                      onValueChange={(value) => handleFormChange('electricityBilling', value)}
                    >
                      {BILLING_OPTIONS.map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.value} id={`electricity-${option.value}`} />
                          <label htmlFor={`electricity-${option.value}`}>{option.label}</label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>房源照片</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {formData.uploadedImages.map((image, index) => (
                    <div key={image.id} className="relative group">
                      <img
                        src={image.gatewayUrl}
                        alt={image.filename}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveImage(index)}
                        disabled={deletingImages.has(image.id)}
                      >
                        {deletingImages.has(image.id) ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                      {index === 0 && (
                        <Badge className="absolute bottom-2 left-2">主圖</Badge>
                      )}
                    </div>
                  ))}

                  {formData.uploadedImages.length < 5 && (
                    <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        {uploading ? '上傳中...' : '上傳照片'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  最多可上傳 5 張照片，每張不超過 5MB
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>詳細說明</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="請描述房源特色、周邊環境、交通便利性等..."
                  rows={5}
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center space-x-4">
            <Button variant="outline" onClick={() => handleStepBack('form')}>
              上一步
            </Button>
            <Button onClick={handleFormSubmit} size="lg">
              預覽房源
            </Button>
          </div>
        </div>
      )}

      {disclosureStep === 'publish' && (
        <div className="space-y-6">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              請確認房源資訊無誤後發布
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>房源預覽</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {formData.uploadedImages.length > 0 && (
                <div className="aspect-video relative rounded-lg overflow-hidden">
                  <img
                    src={formData.uploadedImages[0].gatewayUrl}
                    alt="房源主圖"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <h3 className="text-2xl font-bold mb-2">{formData.title}</h3>
                <p className="text-muted-foreground">{disclosureStatus?.disclosedData?.address}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">${formData.rent}</div>
                  <div className="text-sm text-muted-foreground">月租金</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{getHouseTypeLabel(formData.type)}</div>
                  <div className="text-sm text-muted-foreground">房屋類型</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{formData.area}坪</div>
                  <div className="text-sm text-muted-foreground">使用坪數</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{formData.floor}F</div>
                  <div className="text-sm text-muted-foreground">樓層</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">空間配置</h4>
                  <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                    {formData.bedroom > 0 && (
                      <div className="flex items-center">
                        <Bed className="h-4 w-4 mr-1" />
                        {formData.bedroom}房
                      </div>
                    )}
                    {formData.livingroom > 0 && (
                      <div className="flex items-center">
                        <Sofa className="h-4 w-4 mr-1" />
                        {formData.livingroom}廳
                      </div>
                    )}
                    {formData.bathroom > 0 && (
                      <div className="flex items-center">
                        <Bath className="h-4 w-4 mr-1" />
                        {formData.bathroom}衛
                      </div>
                    )}
                    {formData.balcony && (
                      <Badge variant="secondary" className="ml-2">陽台</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">押金</h4>
                  <div className="text-sm text-muted-foreground">${formData.deposit} USDC</div>
                </div>

                {formData.facilities.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">設備設施</h4>
                    <div className="flex flex-wrap gap-2">
                      {formData.facilities.map((facility) => (
                        <Badge key={facility} variant="secondary">
                          {facility}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-2">租屋規則</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>• 寵物：{formData.pet ? '可以' : '不可'}</div>
                    <div>• 開伙：{formData.cooking ? '可以' : '不可'}</div>
                    <div>• 水費：{getBillingLabel(formData.waterBilling)}</div>
                    <div>• 電費：{getBillingLabel(formData.electricityBilling)}</div>
                  </div>
                </div>

                {formData.description && (
                  <div>
                    <h4 className="font-semibold mb-2">詳細說明</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {formData.description}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center space-x-4">
            <Button variant="outline" onClick={() => handleStepBack('publish')}>
              返回編輯
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="lg" className="min-w-[120px]">
                  確認發布
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>確認發布房源？</AlertDialogTitle>
                  <AlertDialogDescription>
                    發布後房源資訊將公開顯示，您可以隨時下架或編輯房源資訊。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handlePublish}>
                    確認發布
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  )
}