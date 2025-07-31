import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { FileText, MapPin, Calendar, Clock, X, ChevronDown, ChevronUp, User, Briefcase, Home } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useAuthStore } from '@/stores/authStore'
import { useTransaction } from '@/hooks'
import { toast } from 'sonner'
import { Transaction } from '@solana/web3.js'

interface Application {
  publicKey: string
  listing: string
  applicant: string
  status: number
  createdAt: number
  listingInfo?: {
    publicKey: string
    address: string
    rent: string
    deposit: string
    metadata?: {
      basic?: {
        title: string
      }
    }
  }
  message?: {
    applicant?: {
      occupation: string
      company_type: string
      birth_date: string
      gender: string
    }
    preferences?: {
      move_in_date: string
      lease_term_months: number
    }
    message?: string
  }
}

type FilterStatus = 'all' | '0' | '1' | '2'

export default function ApplicationsPage() {
  useAuthStore()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  const cancelTransaction = useTransaction({
    onSuccess: async () => {
      toast.success('申請已成功撤回')
      fetchApplications()
      setCancellingId(null)
    },
    onError: () => {
      setCancellingId(null)
    }
  })

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

  const handleCancelApplication = useCallback(async (applicationId: string) => {
    try {
      setCancellingId(applicationId)
      
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel application')
      }

      const { transaction: serializedTx, cleanup } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
      
      if (cleanup?.messageIpfsHash) {
        cancelTransaction.updateCleanupInfo({
          ipfsHashes: [cleanup.messageIpfsHash]
        })
      }
      
      await cancelTransaction.executeTransaction(tx)
      
      if (cleanup?.messageIpfsHash) {
        try {
          await fetch('/api/cleanup/transaction-failed', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ipfsHashes: [cleanup.messageIpfsHash]
            })
          })
        } catch (cleanupError) {
          console.error('Cleanup succeeded after transaction:', cleanupError)
        }
      }
      
    } catch (error) {
      console.error('Error cancelling application:', error)
      toast.error(error instanceof Error ? error.message : '撤回申請失敗')
      setCancellingId(null)
    }
  }, [cancelTransaction])

  const toggleExpanded = (applicationId: string) => {
    const newExpanded = new Set(expandedCards)
    if (newExpanded.has(applicationId)) {
      newExpanded.delete(applicationId)
    } else {
      newExpanded.add(applicationId)
    }
    setExpandedCards(newExpanded)
  }

  const filteredApplications = applications.filter(app => {
    if (filterStatus === 'all') return true
    return app.status.toString() === filterStatus
  })

  const getStatusCount = (status: FilterStatus) => {
    if (status === 'all') return applications.length
    return applications.filter(app => app.status.toString() === status).length
  }

  const getStatusLabel = (status: FilterStatus) => {
    switch (status) {
      case 'all': return `全部 (${getStatusCount(status)})`
      case '0': return `待審核 (${getStatusCount(status)})`
      case '1': return `已核准 (${getStatusCount(status)})`
      case '2': return `已拒絕 (${getStatusCount(status)})`
      default: return '全部'
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

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">我的申請</h1>
        <p className="text-muted-foreground">查看您提交的租賃申請狀態</p>
      </div>

      <div className="flex justify-between items-center">
        <div className="w-48">
          <Select value={filterStatus} onValueChange={(value: FilterStatus) => setFilterStatus(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getStatusLabel('all')}</SelectItem>
              <SelectItem value="0">{getStatusLabel('0')}</SelectItem>
              <SelectItem value="1">{getStatusLabel('1')}</SelectItem>
              <SelectItem value="2">{getStatusLabel('2')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredApplications.length === 0 ? (
          <div className="text-center py-12">
            {filterStatus === 'all' ? (
              <>
                <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">還沒有申請記錄</h3>
                <p className="text-muted-foreground mb-4">
                  瀏覽房源並提交您的第一個租賃申請
                </p>
                <Button asChild>
                  <Link to="/">瀏覽房源</Link>
                </Button>
              </>
            ) : (
              <>
                <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">沒有符合條件的申請</h3>
              </>
            )}
          </div>
        ) : (
          filteredApplications.map((application) => (
            <ApplicationCard 
              key={application.publicKey} 
              application={application}
              isExpanded={expandedCards.has(application.publicKey)}
              onToggleExpanded={() => toggleExpanded(application.publicKey)}
              onCancel={handleCancelApplication}
              isCancelling={cancellingId === application.publicKey}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ApplicationCard({ 
  application, 
  isExpanded,
  onToggleExpanded,
  onCancel,
  isCancelling 
}: { 
  application: Application
  isExpanded: boolean
  onToggleExpanded: () => void
  onCancel: (id: string) => void
  isCancelling: boolean
}) {
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
          <div className="flex items-center space-x-2">
            {getStatusBadge(application.status)}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpanded}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
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

        {isExpanded && application.message && (
          <div className="border-t pt-4 space-y-4">
            {application.message.applicant && (
              <div>
                <h4 className="font-medium flex items-center mb-2">
                  <User className="h-4 w-4 mr-2" />
                  申請人資訊
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 p-3 rounded-lg">
                  <div>
                    <span className="text-muted-foreground">職業：</span>
                    <span>{application.message.applicant.occupation}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">工作性質：</span>
                    <span>{application.message.applicant.company_type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">出生年月：</span>
                    <span>{application.message.applicant.birth_date}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">性別：</span>
                    <span>{application.message.applicant.gender}</span>
                  </div>
                </div>
              </div>
            )}

            {application.message.preferences && (
              <div>
                <h4 className="font-medium flex items-center mb-2">
                  <Briefcase className="h-4 w-4 mr-2" />
                  租賃偏好
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 p-3 rounded-lg">
                  <div>
                    <span className="text-muted-foreground">期望入住：</span>
                    <span>{application.message.preferences.move_in_date}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">期望租期：</span>
                    <span>{application.message.preferences.lease_term_months} 個月</span>
                  </div>
                </div>
              </div>
            )}

            {application.message.message && (
              <div>
                <h4 className="font-medium mb-2">自我介紹</h4>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg whitespace-pre-line">
                  {application.message.message}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <Button variant="outline" asChild>
            <Link to={`/listing/${application.listingInfo?.publicKey || application.listing}`}>
              <Home className="h-4 w-4 mr-2" />
              查看房源
            </Link>
          </Button>
          
          {application.status === 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      撤回中...
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      撤回申請
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>確認撤回申請</AlertDialogTitle>
                  <AlertDialogDescription>
                    撤回申請後將無法復原，確定要撤回這個申請嗎？
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onCancel(application.publicKey)}>
                    確認撤回
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  )
}