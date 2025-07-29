import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, MapPin, Calendar, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/stores/authStore'

interface Application {
  publicKey: string
  listing: string
  applicant: string
  status: number
  createdAt: number
  listingInfo?: {
    address: string
    rent: string
    deposit: string
    metadata?: {
      basic?: {
        title: string
      }
    }
  }
  messageData?: {
    applicant?: {
      occupation: string
      company_type: string
    }
    preferences?: {
      move_in_date: string
      lease_term_months: number
    }
    message?: string
  }
}

export default function ApplicationsPage() {
  useAuthStore()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchApplications()
  }, [])

  const fetchApplications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/applications/my', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setApplications(data.applications || [])
      }
    } catch (error) {
      console.error('Error fetching applications:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-1/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const pendingApplications = applications.filter(app => app.status === 0)
  const approvedApplications = applications.filter(app => app.status === 1)
  const rejectedApplications = applications.filter(app => app.status === 2)

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">我的申請</h1>
        <p className="text-muted-foreground">查看您提交的租賃申請狀態</p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            全部 ({applications.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            待審核 ({pendingApplications.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            已核准 ({approvedApplications.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            已拒絕 ({rejectedApplications.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {applications.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">還沒有申請記錄</h3>
              <p className="text-muted-foreground mb-4">
                瀏覽房源並提交您的第一個租賃申請
              </p>
              <Button asChild>
                <Link to="/">瀏覽房源</Link>
              </Button>
            </div>
          ) : (
            applications.map((application) => (
              <ApplicationCard key={application.publicKey} application={application} />
            ))
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {pendingApplications.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">沒有待審核的申請</h3>
            </div>
          ) : (
            pendingApplications.map((application) => (
              <ApplicationCard key={application.publicKey} application={application} />
            ))
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {approvedApplications.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">沒有已核准的申請</h3>
            </div>
          ) : (
            approvedApplications.map((application) => (
              <ApplicationCard key={application.publicKey} application={application} />
            ))
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {rejectedApplications.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">沒有被拒絕的申請</h3>
            </div>
          ) : (
            rejectedApplications.map((application) => (
              <ApplicationCard key={application.publicKey} application={application} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ApplicationCard({ application }: { application: Application }) {
  const formatPrice = (price: string) => {
    const num = parseInt(price) / 1_000_000
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('zh-TW')
  }

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 0:
        return <Badge variant="secondary">待審核</Badge>
      case 1:
        return <Badge variant="default">已核准</Badge>
      case 2:
        return <Badge variant="destructive">已拒絕</Badge>
      default:
        return <Badge variant="secondary">未知</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>{application.listingInfo?.metadata?.basic?.title || '房源申請'}</span>
          </CardTitle>
          {getStatusBadge(application.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center text-muted-foreground">
          <MapPin className="h-4 w-4 mr-2" />
          <span>{application.listingInfo?.address}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">月租金：</span>
            <span className="font-semibold">
              ${application.listingInfo?.rent ? formatPrice(application.listingInfo.rent) : 'N/A'} USDC
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">押金：</span>
            <span className="font-semibold">
              ${application.listingInfo?.deposit ? formatPrice(application.listingInfo.deposit) : 'N/A'} USDC
            </span>
          </div>
        </div>

        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 mr-2" />
          <span>申請日期：{formatDate(application.createdAt)}</span>
        </div>

        {application.messageData?.preferences?.move_in_date && (
          <div className="text-sm">
            <span className="text-muted-foreground">期望入住日期：</span>
            <span>{application.messageData.preferences.move_in_date}</span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <Button variant="outline" asChild>
            <Link to={`/listing/${application.listing}`}>
              查看房源
            </Link>
          </Button>
          
          {application.status === 1 && (
            <div className="text-sm text-green-600">
              ✓ 申請已獲核准，等待房東創建租約
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}