import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { MapPin, Bed, Home, Building } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { useAuthStore } from '@/stores/authStore'

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
    location?: {
      city: string
      district: string
      mrt?: string
    }
    features?: {
      bedroom: number
      livingroom: number
      bathroom: number
      balcony: boolean
    }
    facilities?: string[]
    rules?: {
      pet: boolean
      smoking: boolean
      cooking: boolean
    }
    description?: string
    media?: {
      images: string[]
      primary_image: number
    }
  }
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchListing(id)
    }
  }, [id])

  const fetchListing = async (listingId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/listings/${listingId}`)
      if (response.ok) {
        const data = await response.json()
        setListing(data)
      } else {
        navigate('/')
      }
    } catch (error) {
      console.error('Error fetching listing:', error)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: string) => {
    const num = parseInt(price) / 1_000_000
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  const canApply = () => {
    return listing?.status === 0 &&
      user?.credentialStatus?.twfido?.exists &&
      listing.owner !== user.publicKey
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-64 bg-muted rounded-lg"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-8 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
          <div className="h-48 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">房源不存在</h2>
        <Button asChild>
          <Link to="/">回到首頁</Link>
        </Button>
      </div>
    )
  }

  const images = listing.metadata?.media?.images || []

  return (
    <div className="space-y-6">
      {images.length > 0 && (
        <div className="relative">
          {images.length > 1 ? (
            <Carousel className="w-full">
              <CarouselContent>
                {images.map((image, index) => (
                  <CarouselItem key={index}>
                    <div className="relative">
                      <img
                        src={`https://indigo-definite-coyote-168.mypinata.cloud/ipfs/${image}`}
                        alt={`${listing.metadata?.basic?.title} - 圖片 ${index + 1}`}
                        className="w-full h-64 lg:h-96 object-cover rounded-lg"
                      />
                      {index === (listing.metadata?.media?.primary_image || 0) && (
                        <div className="absolute top-4 left-4 bg-primary text-primary-foreground text-sm px-3 py-1 rounded-full">
                          主要照片
                        </div>
                      )}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-4" />
              <CarouselNext className="right-4" />
            </Carousel>
          ) : (
            <div className="relative">
              <img
                src={`https://indigo-definite-coyote-168.mypinata.cloud/ipfs/${images[0]}`}
                alt={listing.metadata?.basic?.title}
                className="w-full h-64 lg:h-96 object-cover rounded-lg"
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold">
                {listing.metadata?.basic?.title || '房源'}
              </h1>
              <Badge variant={listing.status === 0 ? "default" : "secondary"}>
                {listing.status === 0 ? "可租" : "已租"}
              </Badge>
            </div>

            <div className="flex items-center text-muted-foreground mb-4">
              <MapPin className="h-5 w-5 mr-2" />
              <span>{listing.address}</span>
            </div>

            {listing.metadata?.location && (
              <div className="text-muted-foreground mb-4">
                {listing.metadata.location.city} {listing.metadata.location.district}
                {listing.metadata.location.mrt && ` • 鄰近 ${listing.metadata.location.mrt}`}
              </div>
            )}

            <div className="flex items-center space-x-6">
              <div className="flex items-center text-muted-foreground">
                <Bed className="h-5 w-5 mr-2" />
                {listing.metadata?.features?.bedroom || 1}房
                {(listing.metadata?.features?.livingroom || 0) > 0 && `${listing.metadata?.features?.livingroom}廳`}
                {listing.metadata?.features?.bathroom || 1}衛
                {listing.metadata?.features?.balcony && <span className="ml-1">+陽台</span>}
              </div>
              <div className="flex items-center text-muted-foreground">
                <Home className="h-5 w-5 mr-2" />
                {listing.metadata?.basic?.area || 0}坪
              </div>
              <div className="flex items-center text-muted-foreground">
                <Building className="h-5 w-5 mr-2" />
                第{listing.metadata?.basic?.floor || 1}層
              </div>
            </div>
          </div>

          <Separator />

          {listing.metadata?.description && (
            <div>
              <h3 className="text-xl font-semibold mb-3">房源描述</h3>
              <p className="text-muted-foreground whitespace-pre-line">
                {listing.metadata.description}
              </p>
            </div>
          )}

          {listing.metadata?.facilities && listing.metadata.facilities.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold mb-3">設備設施</h3>
              <div className="flex flex-wrap gap-2">
                {listing.metadata.facilities.map((facility, index) => (
                  <Badge key={index} variant="outline">
                    {facility}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {listing.metadata?.rules && (
            <div>
              <h3 className="text-xl font-semibold mb-3">租賃規則</h3>
              <div className="space-y-2 text-muted-foreground">
                <div>• 寵物：{listing.metadata.rules.pet ? '允許' : '不允許'}</div>
                <div>• 吸菸：{listing.metadata.rules.smoking ? '允許' : '不允許'}</div>
                <div>• 開伙：{listing.metadata.rules.cooking ? '允許' : '不允許'}</div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>租金資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">月租金</span>
                <span className="text-2xl font-bold text-primary">
                  ${formatPrice(listing.rent)} USDC
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">押金</span>
                <span className="text-lg font-semibold">
                  ${formatPrice(listing.deposit)} USDC
                </span>
              </div>

              <Separator />

              {canApply() ? (
                <Button asChild className="w-full">
                  <Link to={`/apply/${listing.publicKey}`}>
                    申請租賃
                  </Link>
                </Button>
              ) : listing.status !== 0 ? (
                <Button disabled className="w-full">
                  已租出
                </Button>
              ) : listing.owner === user?.publicKey ? (
                <Button disabled className="w-full">
                  這是您的房源
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button disabled className="w-full">
                    需要自然人憑證
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    請先完成身份驗證
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {listing.metadata?.basic && (
            <Card>
              <CardHeader>
                <CardTitle>基本資訊</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">房屋類型</span>
                  <span>{listing.metadata.basic.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">樓層</span>
                  <span>{listing.metadata.basic.floor} / {listing.metadata.basic.total_floors}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">坪數</span>
                  <span>{listing.metadata.basic.area} 坪</span>
                </div>
                {listing.metadata.features?.balcony && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">陽台</span>
                    <span>有</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}