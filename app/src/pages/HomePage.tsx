import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Bed, Bath, Home, Search, Sofa } from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
    media?: {
      images: string[]
      primary_image: number
    }
  }
  ipfsHash?: string
}

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [filterStatus, setFilterStatus] = useState('0')

  useEffect(() => {
    fetchListings()
  }, [sortBy, filterStatus])

  const fetchListings = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('zuvi-auth-token')
      const headers: HeadersInit = {}

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`/api/listings?status=${filterStatus}&sort=${sortBy}`, {
        headers
      })

      if (response.ok) {
        const data = await response.json()
        setListings(data.listings || [])
      } else {
        console.error('Failed to fetch listings:', response.status)
        setListings([])
      }
    } catch (error) {
      console.error('Error fetching listings:', error)
      setListings([])
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: string) => {
    const num = parseInt(price) / 1_000_000
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  const filteredListings = listings.filter(listing =>
    listing.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    listing.metadata?.basic?.title?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋地址或房源標題"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">最新刊登</SelectItem>
            <SelectItem value="price_low">價格低到高</SelectItem>
            <SelectItem value="price_high">價格高到低</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">可出租</SelectItem>
            <SelectItem value="1">已出租</SelectItem>
            <SelectItem value="all">全部</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-muted"></div>
              <CardContent className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-6 bg-muted rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => (
            <Card key={listing.publicKey} className="overflow-hidden hover:shadow-lg transition-shadow">
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
                  <Badge variant={listing.status === 0 ? "default" : "secondary"}>
                    {listing.status === 0 ? "可租" : "已租"}
                  </Badge>
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
                    {(listing.metadata.features.bedroom || 0) > 0 && (
                      <div className="flex items-center">
                        <Bed className="h-4 w-4 mr-1" />
                        {listing.metadata.features.bedroom}房
                      </div>
                    )}
                    {(listing.metadata.features.livingroom || 0) > 0 && (
                      <div className="flex items-center">
                        <Sofa className="h-4 w-4 mr-1" />
                        {listing.metadata.features.livingroom}廳
                      </div>
                    )}
                    {(listing.metadata.features.bathroom || 0) > 0 && (
                      <div className="flex items-center">
                        <Bath className="h-4 w-4 mr-1" />
                        {listing.metadata.features.bathroom}衛
                      </div>
                    )}
                    <div className="flex items-center">
                      <Home className="h-4 w-4 mr-1" />
                      {listing.metadata?.basic?.area || 0}坪
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="text-2xl font-bold text-primary">
                    ${formatPrice(listing.rent)} USDC
                  </div>
                  <div className="text-sm text-muted-foreground">
                    押金 ${formatPrice(listing.deposit)} USDC
                  </div>
                </div>
              </CardContent>

              <CardFooter className="p-4 pt-0">
                <Button asChild className="w-full">
                  <Link to={`/listing/${listing.publicKey}`}>
                    查看詳情
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredListings.length === 0 && (
        <div className="text-center py-12">
          <Home className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">沒有找到符合條件的房源</h3>
          <p className="text-muted-foreground">
            {searchTerm ? '請嘗試不同的搜尋條件' : '目前沒有可用的房源'}
          </p>
        </div>
      )}
    </div>
  )
}