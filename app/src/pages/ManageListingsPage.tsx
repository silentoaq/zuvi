import { useState, useEffect, useCallback } from 'react'
import { Transaction } from '@solana/web3.js'
import { MapPin, Bed, Bath, Home, Edit, Eye, Users, Upload, X } from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/stores/authStore'
import { useTransaction } from '@/hooks'
import { toast } from 'sonner'

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
      floor: number
      total_floors: number
    }
    features?: {
      bedroom: number
      bathroom: number
      balcony: boolean
    }
    facilities?: string[]
    rules?: {
      pet: boolean
      cooking: boolean
      utilities?: {
        water: string
        electricity: string
      }
    }
    description?: string
    media?: {
      images: string[]
      primary_image: number
    }
  }
}

interface Application {
  publicKey: string
  applicant: string
  status: number
  createdAt: number
}

interface UploadedImage {
  id: string
  filename: string
  ipfsHash: string
  gatewayUrl: string
  isExisting?: boolean
}

interface EditFormData {
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
  existingImages: UploadedImage[]
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

export default function ManageListingsPage() {
  const { user } = useAuthStore()
  
  const {
    executeTransaction: executeToggle,
    isLoading: isToggling
  } = useTransaction({
    onSuccess: () => {
      toast.success('房源狀態更新成功')
      fetchMyListings()
    }
  })

  const {
    executeTransaction: executeUpdate,
    isLoading: isUpdating
  } = useTransaction({
    onSuccess: () => {
      toast.success('房源更新成功')
      setEditingListing(null)
      setEditFormData(null)
      fetchMyListings()
    }
  })
  
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [editingListing, setEditingListing] = useState<Listing | null>(null)
  const [editFormData, setEditFormData] = useState<EditFormData | null>(null)
  const [applications, setApplications] = useState<Record<string, Application[]>>({})
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (user?.publicKey) {
      fetchMyListings()
    }
  }, [user?.publicKey])

  const fetchMyListings = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/listings?owner=${user?.publicKey}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setListings(data.listings || [])
      }
    } catch (error) {
      console.error('Error fetching listings:', error)
      toast.error('載入房源失敗')
    } finally {
      setLoading(false)
    }
  }

  const fetchApplications = async (listingId: string) => {
    try {
      const response = await fetch(`/api/applications/listing/${listingId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setApplications(prev => ({
          ...prev,
          [listingId]: data.applications || []
        }))
      }
    } catch (error) {
      console.error('Error fetching applications:', error)
    }
  }

  const toggleListingStatus = useCallback(async (listing: Listing) => {
    try {
      const response = await fetch(`/api/listings/${listing.publicKey}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) throw new Error('Failed to toggle listing')

      const { transaction: serializedTx } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
      
      await executeToggle(tx)
    } catch (error) {
      console.error('Error toggling listing:', error)
      toast.error('操作失敗')
    }
  }, [executeToggle])

  const startEdit = (listing: Listing) => {
    setEditingListing(listing)
    
    const existingImages: UploadedImage[] = listing.metadata?.media?.images?.map((ipfsHash, index) => ({
      id: `existing-${index}`,
      filename: `image-${index + 1}.jpg`,
      ipfsHash,
      gatewayUrl: `https://indigo-definite-coyote-168.mypinata.cloud/ipfs/${ipfsHash}`,
      isExisting: true
    })) || []

    setEditFormData({
      title: listing.metadata?.basic?.title || '',
      type: getTypeValue(listing.metadata?.basic?.type || ''),
      area: listing.metadata?.basic?.area || 0,
      floor: listing.metadata?.basic?.floor || 1,
      totalFloors: listing.metadata?.basic?.total_floors || 1,
      bedroom: listing.metadata?.features?.bedroom || 1,
      bathroom: listing.metadata?.features?.bathroom || 1,
      balcony: listing.metadata?.features?.balcony || false,
      rent: parseInt(listing.rent) / 1_000_000,
      deposit: parseInt(listing.deposit) / 1_000_000,
      facilities: listing.metadata?.facilities || [],
      pet: listing.metadata?.rules?.pet || false,
      cooking: listing.metadata?.rules?.cooking || false,
      waterBilling: getBillingValue(listing.metadata?.rules?.utilities?.water || ''),
      electricityBilling: getBillingValue(listing.metadata?.rules?.utilities?.electricity || ''),
      description: listing.metadata?.description || '',
      uploadedImages: [],
      existingImages
    })
  }

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    
    const newImages = Array.from(files).filter(file => file.type.startsWith('image/'))
    const totalImages = editFormData!.existingImages.length + editFormData!.uploadedImages.length + newImages.length
    
    if (totalImages > 10) {
      toast.error('最多只能有10張照片')
      return
    }
    
    try {
      setUploading(true)
      const formData = new FormData()
      newImages.forEach(file => {
        formData.append('images', file)
      })

      const response = await fetch('/api/listings/upload-images', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        },
        body: formData
      })

      if (!response.ok) throw new Error('Upload failed')

      const { images } = await response.json()
      setEditFormData(prev => ({
        ...prev!,
        uploadedImages: [...prev!.uploadedImages, ...images]
      }))
      
      toast.success(`成功上傳 ${images.length} 張照片`)
    } catch (error) {
      console.error('Error uploading images:', error)
      toast.error('照片上傳失敗')
    } finally {
      setUploading(false)
    }
  }

  const removeUploadedImage = async (index: number) => {
    const imageToRemove = editFormData!.uploadedImages[index]
    
    setEditFormData(prev => ({
      ...prev!,
      uploadedImages: prev!.uploadedImages.filter((_, i) => i !== index)
    }))

    try {
      await fetch(`/api/listings/image/${imageToRemove.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })
    } catch (error) {
      console.error('Error removing image:', error)
    }
  }

  const removeExistingImage = (index: number) => {
    setEditFormData(prev => ({
      ...prev!,
      existingImages: prev!.existingImages.filter((_, i) => i !== index)
    }))
  }

  const handleUpdate = useCallback(async () => {
    if (!editFormData || !editingListing) return

    try {
      const allImages = [...editFormData.existingImages, ...editFormData.uploadedImages]
      
      const metadata = {
        version: '1.0',
        basic: {
          title: editFormData.title,
          type: HOUSE_TYPES.find(t => t.value === editFormData.type)?.label || editFormData.type,
          area: editFormData.area,
          floor: editFormData.floor,
          total_floors: editFormData.totalFloors
        },
        features: {
          bedroom: editFormData.bedroom,
          bathroom: editFormData.bathroom,
          balcony: editFormData.balcony
        },
        facilities: editFormData.facilities,
        rules: {
          pet: editFormData.pet,
          cooking: editFormData.cooking,
          utilities: {
            water: BILLING_OPTIONS.find(b => b.value === editFormData.waterBilling)?.label || editFormData.waterBilling,
            electricity: BILLING_OPTIONS.find(b => b.value === editFormData.electricityBilling)?.label || editFormData.electricityBilling
          }
        },
        description: editFormData.description,
        media: {
          images: allImages.map(img => img.ipfsHash),
          primary_image: 0
        }
      }

      const requestBody: any = {}
      
      const currentRent = parseInt(editingListing.rent) / 1_000_000
      const currentDeposit = parseInt(editingListing.deposit) / 1_000_000
      
      if (editFormData.rent !== currentRent) {
        requestBody.rent = editFormData.rent * 1_000_000
      }
      
      if (editFormData.deposit !== currentDeposit) {
        requestBody.deposit = editFormData.deposit * 1_000_000
      }

      const hasImageChanges = 
        editFormData.uploadedImages.length > 0 || 
        editFormData.existingImages.length !== (editingListing.metadata?.media?.images?.length || 0) ||
        !editFormData.existingImages.every((img, index) => 
          img.ipfsHash === editingListing.metadata?.media?.images?.[index]
        )

      if (hasImageChanges || JSON.stringify(metadata) !== JSON.stringify(editingListing.metadata)) {
        requestBody.metadata = metadata
        requestBody.imageIds = editFormData.uploadedImages.map(img => img.id)
      }

      if (Object.keys(requestBody).length === 0) {
        toast.error('沒有變更需要更新')
        return
      }

      const response = await fetch(`/api/listings/${editingListing.publicKey}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update listing')
      }

      const { transaction: serializedTx } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
      
      await executeUpdate(tx)

    } catch (error) {
      console.error('Error updating listing:', error)
      toast.error(error instanceof Error ? error.message : '更新失敗')
    }
  }, [editFormData, editingListing, executeUpdate])

  const formatPrice = (price: string) => {
    const num = parseInt(price) / 1_000_000
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 0:
        return <Badge className="bg-green-100 text-green-800">可租</Badge>
      case 1:
        return <Badge className="bg-blue-100 text-blue-800">已租</Badge>
      case 2:
        return <Badge className="bg-gray-100 text-gray-800">下架</Badge>
      default:
        return <Badge variant="secondary">未知</Badge>
    }
  }

  const getTypeValue = (label: string) => {
    return HOUSE_TYPES.find(t => t.label === label)?.value || 'entire'
  }

  const getBillingValue = (label: string) => {
    return BILLING_OPTIONS.find(b => b.label === label)?.value || 'utility'
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">管理房源</h1>
          <p className="text-muted-foreground">管理您的房源和申請</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-muted"></div>
              <CardContent className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">管理房源</h1>
        <p className="text-muted-foreground">管理您的房源和申請</p>
      </div>

      {listings.length === 0 ? (
        <div className="text-center py-12">
          <Home className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">還沒有房源</h3>
          <p className="text-muted-foreground mb-4">
            開始刊登您的第一個房源
          </p>
          <Button asChild>
            <a href="/listings/create">刊登房源</a>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <Card key={listing.publicKey} className="overflow-hidden">
              <div className="relative">
                {listing.metadata?.media?.images?.[listing.metadata.media.primary_image || 0] ? (
                  <img
                    src={`https://indigo-definite-coyote-168.mypinata.cloud/ipfs/${listing.metadata.media.images[listing.metadata.media.primary_image || 0]}`}
                    alt={listing.metadata?.basic?.title}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-muted flex items-center justify-center">
                    <Home className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  {getStatusBadge(listing.status)}
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-lg truncate">
                  {listing.metadata?.basic?.title || '房源'}
                </h3>
                
                <div className="flex items-center text-muted-foreground text-sm">
                  <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span className="truncate">{listing.address}</span>
                </div>
                
                {listing.metadata?.features && (
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Bed className="h-4 w-4 mr-1" />
                      <span>{listing.metadata.features.bedroom}房</span>
                    </div>
                    <div className="flex items-center">
                      <Bath className="h-4 w-4 mr-1" />
                      <span>{listing.metadata.features.bathroom}衛</span>
                    </div>
                    {listing.metadata?.basic?.area && (
                      <div className="flex items-center">
                        <Home className="h-4 w-4 mr-1" />
                        <span>{listing.metadata.basic.area}坪</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="space-y-1">
                  <div className="text-xl font-bold text-primary">
                    ${formatPrice(listing.rent)} USDC
                  </div>
                  <div className="text-sm text-muted-foreground">
                    押金 ${formatPrice(listing.deposit)} USDC
                  </div>
                </div>
              </CardContent>

              <CardFooter className="p-4 pt-0">
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(listing)}
                    disabled={listing.status === 1}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    編輯
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleListingStatus(listing)}
                    disabled={listing.status === 1 || isToggling}
                  >
                    {isToggling ? '處理中...' : listing.status === 0 ? '下架' : '上架'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a href={`/listing/${listing.publicKey}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      預覽
                    </a>
                  </Button>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchApplications(listing.publicKey)}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        申請
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>房源申請</DialogTitle>
                        <DialogDescription>
                          {listing.metadata?.basic?.title || '房源'}的租賃申請
                        </DialogDescription>
                      </DialogHeader>
                      <div className="max-h-96 overflow-y-auto">
                        {applications[listing.publicKey]?.length > 0 ? (
                          <div className="space-y-4">
                            {applications[listing.publicKey].map((app) => (
                              <Card key={app.publicKey}>
                                <CardContent className="p-4">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <p className="font-medium">申請人: {app.applicant.slice(0, 8)}...</p>
                                      <p className="text-sm text-muted-foreground">
                                        申請時間: {new Date(app.createdAt * 1000).toLocaleDateString('zh-TW')}
                                      </p>
                                    </div>
                                    <Badge variant={app.status === 0 ? "secondary" : app.status === 1 ? "default" : "destructive"}>
                                      {app.status === 0 ? "待審核" : app.status === 1 ? "已核准" : "已拒絕"}
                                    </Badge>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">暫無申請</p>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editingListing} onOpenChange={(open) => {
        if (!open) {
          setEditingListing(null)
          setEditFormData(null)
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯房源</DialogTitle>
            <DialogDescription>
              更新房源資訊，已出租的房源無法編輯
            </DialogDescription>
          </DialogHeader>

          {editFormData && (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">基本資訊</TabsTrigger>
                <TabsTrigger value="price">租金設定</TabsTrigger>
                <TabsTrigger value="features">特色規則</TabsTrigger>
                <TabsTrigger value="images">房源照片</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">房源標題</Label>
                    <Input
                      id="title"
                      value={editFormData.title}
                      onChange={(e) => setEditFormData(prev => ({ ...prev!, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">房屋類型</Label>
                    <Select value={editFormData.type} onValueChange={(value) => setEditFormData(prev => ({ ...prev!, type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
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
                      value={editFormData.area || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev!, area: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="floor">樓層</Label>
                    <Input
                      id="floor"
                      type="number"
                      value={editFormData.floor}
                      onChange={(e) => setEditFormData(prev => ({ ...prev!, floor: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalFloors">總樓層</Label>
                    <Input
                      id="totalFloors"
                      type="number"
                      value={editFormData.totalFloors}
                      onChange={(e) => setEditFormData(prev => ({ ...prev!, totalFloors: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bedroom">房間數</Label>
                    <Input
                      id="bedroom"
                      type="number"
                      value={editFormData.bedroom}
                      onChange={(e) => setEditFormData(prev => ({ ...prev!, bedroom: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bathroom">衛浴數</Label>
                    <Input
                      id="bathroom"
                      type="number"
                      value={editFormData.bathroom}
                      onChange={(e) => setEditFormData(prev => ({ ...prev!, bathroom: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>陽台</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox
                        id="balcony"
                        checked={editFormData.balcony}
                        onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev!, balcony: !!checked }))}
                      />
                      <Label htmlFor="balcony">有陽台</Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>房源描述</Label>
                  <Textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData(prev => ({ ...prev!, description: e.target.value }))}
                    rows={3}
                  />
                </div>
              </TabsContent>

              <TabsContent value="price" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rent">月租金 (USDC)</Label>
                    <Input
                      id="rent"
                      type="number"
                      value={editFormData.rent || ''}
                      onChange={(e) => {
                        const newRent = parseInt(e.target.value) || 0
                        setEditFormData(prev => ({ ...prev!, rent: newRent }))
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deposit">押金 (個月)</Label>
                    <Input
                      id="deposit"
                      type="number"
                      value={editFormData.rent > 0 ? Math.round(editFormData.deposit / editFormData.rent * 2) / 2 : ''}
                      onChange={(e) => {
                        const months = parseFloat(e.target.value) || 0
                        setEditFormData(prev => ({ ...prev!, deposit: months * prev!.rent }))
                      }}
                      step="0.5"
                      min="1"
                      max="3"
                    />
                    <div className="text-xs text-muted-foreground">
                      約 {editFormData.deposit.toLocaleString()} USDC
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="features" className="space-y-6">
                <div>
                  <Label className="text-base font-medium">設施設備</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                    {FACILITIES.map(facility => (
                      <div key={facility} className="flex items-center space-x-2">
                        <Checkbox
                          id={`facility-${facility}`}
                          checked={editFormData.facilities.includes(facility)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditFormData(prev => ({ ...prev!, facilities: [...prev!.facilities, facility] }))
                            } else {
                              setEditFormData(prev => ({ ...prev!, facilities: prev!.facilities.filter(f => f !== facility) }))
                            }
                          }}
                        />
                        <Label htmlFor={`facility-${facility}`} className="text-sm">
                          {facility}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">住宿規範</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="pet"
                          checked={editFormData.pet}
                          onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev!, pet: !!checked }))}
                        />
                        <Label htmlFor="pet">可養寵物</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="cooking"
                          checked={editFormData.cooking}
                          onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev!, cooking: !!checked }))}
                        />
                        <Label htmlFor="cooking">可開伙</Label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-base font-medium">水費計費方式</Label>
                      <RadioGroup 
                        value={editFormData.waterBilling} 
                        onValueChange={(value) => setEditFormData(prev => ({ ...prev!, waterBilling: value }))}
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
                        value={editFormData.electricityBilling} 
                        onValueChange={(value) => setEditFormData(prev => ({ ...prev!, electricityBilling: value }))}
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
              </TabsContent>

              <TabsContent value="images" className="space-y-4">
                <div>
                  <Label className="text-base font-medium">房源照片</Label>
                  
                  <div className="space-y-6 mt-3">
                    {editFormData.existingImages.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">現有照片</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {editFormData.existingImages.map((image, index) => (
                            <div key={image.id} className="relative group">
                              <img
                                src={image.gatewayUrl}
                                alt={`現有圖片 ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg"
                              />
                              {index === 0 && (
                                <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
                                  主圖
                                </div>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeExistingImage(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {editFormData.uploadedImages.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">新上傳照片</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {editFormData.uploadedImages.map((image, index) => (
                            <div key={image.id} className="relative group">
                              <img
                                src={image.gatewayUrl}
                                alt={`新圖片 ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = `https://indigo-definite-coyote-168.mypinata.cloud/ipfs/${image.ipfsHash}`
                                }}
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeUploadedImage(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">新增照片</h4>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e.target.files)}
                        className="hidden"
                        id="image-upload"
                        disabled={uploading}
                      />
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {(editFormData.existingImages.length + editFormData.uploadedImages.length) < 10 && (
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
                      
                      <div className="text-xs text-muted-foreground mt-2">
                        已有 {editFormData.existingImages.length + editFormData.uploadedImages.length} / 10 張照片
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingListing(null)
                setEditFormData(null)
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isUpdating || !editFormData}
            >
              {isUpdating ? '更新中...' : '確認更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}