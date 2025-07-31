import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { Transaction } from '@solana/web3.js'
import { CalendarDays, FileText, MapPin, Clock, CheckCircle, AlertCircle, Eye, CreditCard, DollarSign, Gavel, AlertTriangle, HandCoins, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useTransaction } from '@/hooks'
import { toast } from 'sonner'

interface Lease {
  publicKey: string
  listing: string
  landlord: string
  tenant: string
  rent: string
  deposit: string
  startDate: number
  endDate: number
  paymentDay: number
  paidMonths: number
  status: number
  landlordSigned: boolean
  tenantSigned: boolean
  contract?: any
  listingInfo?: {
    address: string
    buildingArea: number
    metadata?: any
  }
  escrow?: {
    amount: string
    status: number
    releaseToLandlord: string
    releaseToTenant: string
    landlordSigned: boolean
    tenantSigned: boolean
    hasDispute: boolean
  }
}

interface ApprovedApplication {
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
    metadata?: any
  }
  message?: any
}

interface CreateLeaseFormData {
  selectedApplication: ApprovedApplication | null
  startDate: Date | undefined
  endDate: Date | undefined
  paymentDay: number
  contractTerms: string
  specialConditions: string
}

interface PaymentHistory {
  lease: string
  paidMonths: number
  totalMonths: number
  remainingMonths: number
  totalPaid: string
  totalRent: string
  paymentDay: number
  payments: any[]
  nextPayment?: any
}

interface DepositReleaseFormData {
  landlordAmount: number
  tenantAmount: number
  reason: string
}

interface DisputeFormData {
  reason: number
  description: string
}

type FilterStatus = 'all' | 'pending' | 'active' | 'completed' | 'terminated'

const PAYMENT_DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

const DISPUTE_REASONS = [
  { value: 0, label: '押金爭議', description: '關於押金分配的爭議' },
  { value: 1, label: '其他爭議', description: '其他租賃相關爭議' }
]

export default function ManageLeasesPage() {
  const { user } = useAuthStore()
  
  const [leases, setLeases] = useState<Lease[]>([])
  const [approvedApplications, setApprovedApplications] = useState<ApprovedApplication[]>([])
  const [paymentHistory, setPaymentHistory] = useState<Record<string, PaymentHistory>>({})
  const [loading, setLoading] = useState(true)
  const [loadingApplications, setLoadingApplications] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showLeaseDialog, setShowLeaseDialog] = useState(false)
  const [showSignDialog, setShowSignDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showPaymentHistoryDialog, setShowPaymentHistoryDialog] = useState(false)
  const [showDepositReleaseDialog, setShowDepositReleaseDialog] = useState(false)
  const [showDepositConfirmDialog, setShowDepositConfirmDialog] = useState(false)
  const [showDisputeDialog, setShowDisputeDialog] = useState(false)
  
  const [formData, setFormData] = useState<CreateLeaseFormData>({
    selectedApplication: null,
    startDate: undefined,
    endDate: undefined,
    paymentDay: 5,
    contractTerms: '',
    specialConditions: ''
  })

  const [depositReleaseData, setDepositReleaseData] = useState<DepositReleaseFormData>({
    landlordAmount: 0,
    tenantAmount: 0,
    reason: ''
  })

  const [disputeData, setDisputeData] = useState<DisputeFormData>({
    reason: 0,
    description: ''
  })

  const isLandlord = user?.credentialStatus?.twland?.exists
  const isTenant = user?.credentialStatus?.twfido?.exists

  const {
    executeTransaction: executeCreateLease,
    isLoading: isCreatingLease
  } = useTransaction({
    onSuccess: () => {
      toast.success('租約創建成功')
      setShowCreateDialog(false)
      resetForm()
      fetchLeases()
    }
  })

  const {
    executeTransaction: executeSignLease,
    isLoading: isSigningLease
  } = useTransaction({
    onSuccess: () => {
      toast.success('租約簽署成功')
      setShowSignDialog(false)
      fetchLeases()
    }
  })

  const {
    executeTransaction: executePayRent,
    isLoading: isPayingRent
  } = useTransaction({
    onSuccess: () => {
      toast.success('租金支付成功')
      setShowPaymentDialog(false)
      fetchLeases()
      if (selectedLease) {
        fetchPaymentHistory(selectedLease.publicKey)
      }
    }
  })

  const {
    executeTransaction: executeDepositRelease,
    isLoading: isReleasingDeposit
  } = useTransaction({
    onSuccess: () => {
      toast.success('押金結算發起成功')
      setShowDepositReleaseDialog(false)
      fetchLeases()
    }
  })

  const {
    executeTransaction: executeDepositConfirm,
    isLoading: isConfirmingDeposit
  } = useTransaction({
    onSuccess: () => {
      toast.success('押金結算確認成功')
      setShowDepositConfirmDialog(false)
      fetchLeases()
    }
  })

  const {
    executeTransaction: executeDispute,
    isLoading: isRaisingDispute
  } = useTransaction({
    onSuccess: () => {
      toast.success('爭議發起成功')
      setShowDisputeDialog(false)
      fetchLeases()
    }
  })

  useEffect(() => {
    fetchLeases()
    if (isLandlord) {
      fetchApprovedApplications()
    }
  }, [user, isLandlord])

  const fetchLeases = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/leases', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setLeases(data.leases || [])
      }
    } catch (error) {
      console.error('Error fetching leases:', error)
      toast.error('載入租約失敗')
    } finally {
      setLoading(false)
    }
  }

  const fetchApprovedApplications = async () => {
    try {
      setLoadingApplications(true)
      const response = await fetch(`/api/listings?owner=${user?.publicKey}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })
      
      if (response.ok) {
        const { listings } = await response.json()
        const allApplications: ApprovedApplication[] = []
        
        await Promise.all(
          listings.map(async (listing: any) => {
            try {
              const appResponse = await fetch(`/api/applications/listing/${listing.publicKey}`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
                }
              })
              
              if (appResponse.ok) {
                const { applications } = await appResponse.json()
                const approved = applications.filter((app: any) => app.status === 1)
                
                const existingLeases = leases.filter(lease => lease.listing === listing.publicKey)
                const approvedWithoutLease = approved.filter((app: any) => 
                  !existingLeases.some(lease => lease.tenant === app.applicant)
                )
                
                approvedWithoutLease.forEach((app: any) => {
                  allApplications.push({
                    ...app,
                    listingInfo: {
                      publicKey: listing.publicKey,
                      address: listing.address,
                      rent: listing.rent,
                      deposit: listing.deposit,
                      metadata: listing.metadata
                    }
                  })
                })
              }
            } catch (error) {
              console.error(`Error fetching applications for listing ${listing.publicKey}:`, error)
            }
          })
        )
        
        setApprovedApplications(allApplications)
      }
    } catch (error) {
      console.error('Error fetching approved applications:', error)
    } finally {
      setLoadingApplications(false)
    }
  }

  const fetchPaymentHistory = async (leaseId: string) => {
    try {
      const response = await fetch(`/api/payments/history/${leaseId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setPaymentHistory(prev => ({
          ...prev,
          [leaseId]: data
        }))
      }
    } catch (error) {
      console.error('Error fetching payment history:', error)
    }
  }

  const getLeaseCategory = (lease: Lease) => {
    if (!lease.landlordSigned || !lease.tenantSigned) {
      return 'pending'
    }
    
    switch (lease.status) {
      case 0: return 'active'
      case 1: return 'completed'
      case 2: return 'terminated'
      default: return 'active'
    }
  }

  const filteredLeases = leases.filter(lease => {
    if (filterStatus === 'all') return true
    return getLeaseCategory(lease) === filterStatus
  })

  const getStatusCount = (status: FilterStatus) => {
    if (status === 'all') return leases.length
    return leases.filter(lease => getLeaseCategory(lease) === status).length
  }

  const getStatusLabel = (status: FilterStatus) => {
    switch (status) {
      case 'all': return `全部 (${getStatusCount(status)})`
      case 'pending': return `待簽署 (${getStatusCount(status)})`
      case 'active': return `生效中 (${getStatusCount(status)})`
      case 'completed': return `已完成 (${getStatusCount(status)})`
      case 'terminated': return `已終止 (${getStatusCount(status)})`
      default: return '全部'
    }
  }

  const handleCreateLease = useCallback(async () => {
    if (!formData.selectedApplication || !formData.startDate || !formData.endDate) {
      toast.error('請填寫完整資訊')
      return
    }

    if (formData.endDate <= formData.startDate) {
      toast.error('結束日期必須晚於開始日期')
      return
    }

    try {
      const contract = {
        version: '1.0',
        type: 'residential_lease',
        parties: {
          landlord: user?.publicKey,
          tenant: formData.selectedApplication.applicant
        },
        property: {
          address: formData.selectedApplication.listingInfo?.address,
          listing: formData.selectedApplication.listing
        },
        terms: {
          startDate: formData.startDate.toISOString(),
          endDate: formData.endDate.toISOString(),
          rent: formData.selectedApplication.listingInfo?.rent,
          deposit: formData.selectedApplication.listingInfo?.deposit,
          paymentDay: formData.paymentDay,
          contractTerms: formData.contractTerms,
          specialConditions: formData.specialConditions
        },
        createdAt: new Date().toISOString()
      }

      const requestBody = {
        listing: formData.selectedApplication.listing,
        applicant: formData.selectedApplication.applicant,
        startDate: Math.floor(formData.startDate.getTime() / 1000),
        endDate: Math.floor(formData.endDate.getTime() / 1000),
        paymentDay: formData.paymentDay,
        contract
      }

      const response = await fetch('/api/leases/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create lease')
      }

      const { transaction: serializedTx } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
      
      await executeCreateLease(tx)
    } catch (error) {
      console.error('Error creating lease:', error)
      toast.error(error instanceof Error ? error.message : '創建租約失敗')
    }
  }, [formData, user, executeCreateLease])

  const handleSignLease = useCallback(async (lease: Lease) => {
    try {
      const response = await fetch(`/api/leases/${lease.publicKey}/sign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to sign lease')
      }

      const { transaction: serializedTx } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
      
      await executeSignLease(tx)
    } catch (error) {
      console.error('Error signing lease:', error)
      toast.error(error instanceof Error ? error.message : '簽署租約失敗')
    }
  }, [executeSignLease])

  const handlePayRent = useCallback(async (lease: Lease) => {
    try {
      const response = await fetch(`/api/payments/rent/${lease.publicKey}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to pay rent')
      }

      const { transaction: serializedTx } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
      
      await executePayRent(tx)
    } catch (error) {
      console.error('Error paying rent:', error)
      toast.error(error instanceof Error ? error.message : '支付租金失敗')
    }
  }, [executePayRent])

  const handleDepositRelease = useCallback(async () => {
    if (!selectedLease) return

    if (depositReleaseData.landlordAmount + depositReleaseData.tenantAmount !== parseInt(selectedLease.deposit) / 1_000_000) {
      toast.error('分配總額必須等於押金總額')
      return
    }

    try {
      const response = await fetch(`/api/payments/deposit/${selectedLease.publicKey}/release`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          landlordAmount: depositReleaseData.landlordAmount * 1_000_000,
          tenantAmount: depositReleaseData.tenantAmount * 1_000_000
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to initiate deposit release')
      }

      const { transaction: serializedTx } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
      
      await executeDepositRelease(tx)
    } catch (error) {
      console.error('Error releasing deposit:', error)
      toast.error(error instanceof Error ? error.message : '發起押金結算失敗')
    }
  }, [selectedLease, depositReleaseData, executeDepositRelease])

  const handleDepositConfirm = useCallback(async (lease: Lease) => {
    try {
      const response = await fetch(`/api/payments/deposit/${lease.publicKey}/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to confirm deposit release')
      }

      const { transaction: serializedTx } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
      
      await executeDepositConfirm(tx)
    } catch (error) {
      console.error('Error confirming deposit:', error)
      toast.error(error instanceof Error ? error.message : '確認押金結算失敗')
    }
  }, [executeDepositConfirm])

  const handleRaiseDispute = useCallback(async () => {
    if (!selectedLease) return

    try {
      const response = await fetch('/api/disputes/raise', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lease: selectedLease.publicKey,
          reason: disputeData.reason
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to raise dispute')
      }

      const { transaction: serializedTx } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
      
      await executeDispute(tx)
    } catch (error) {
      console.error('Error raising dispute:', error)
      toast.error(error instanceof Error ? error.message : '發起爭議失敗')
    }
  }, [selectedLease, disputeData, executeDispute])

  const resetForm = () => {
    setFormData({
      selectedApplication: null,
      startDate: undefined,
      endDate: undefined,
      paymentDay: 5,
      contractTerms: '',
      specialConditions: ''
    })
  }

  const resetDepositForm = () => {
    setDepositReleaseData({
      landlordAmount: 0,
      tenantAmount: 0,
      reason: ''
    })
  }

  const resetDisputeForm = () => {
    setDisputeData({
      reason: 0,
      description: ''
    })
  }

  const formatPrice = (price: string) => {
    const num = parseInt(price) / 1_000_000
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('zh-TW')
  }

  const getLeaseStatusBadge = (lease: Lease) => {
    if (!lease.landlordSigned || !lease.tenantSigned) {
      return <Badge variant="secondary">待簽署</Badge>
    }
    
    switch (lease.status) {
      case 0:
        return <Badge variant="default">生效中</Badge>
      case 1:
        return <Badge variant="outline">已完成</Badge>
      case 2:
        return <Badge variant="destructive">已終止</Badge>
      default:
        return <Badge variant="secondary">未知</Badge>
    }
  }

  const canSignLease = (lease: Lease) => {
    return lease.tenant === user?.publicKey && 
           lease.landlordSigned && 
           !lease.tenantSigned
  }

  const canPayRent = (lease: Lease) => {
    return lease.tenant === user?.publicKey && 
           lease.landlordSigned && 
           lease.tenantSigned && 
           lease.status === 0
  }

  const canInitiateDepositRelease = (lease: Lease) => {
    return (lease.landlord === user?.publicKey || lease.tenant === user?.publicKey) &&
           lease.landlordSigned && 
           lease.tenantSigned && 
           lease.status === 0 &&
           (!lease.escrow || lease.escrow.status === 0) &&
           (!lease.escrow || !lease.escrow.hasDispute)
  }

  const canConfirmDepositRelease = (lease: Lease) => {
    return (lease.landlord === user?.publicKey || lease.tenant === user?.publicKey) &&
           lease.escrow &&
           lease.escrow.status === 1 &&
           !lease.escrow.hasDispute &&
           ((lease.landlord === user?.publicKey && !lease.escrow.landlordSigned) ||
            (lease.tenant === user?.publicKey && !lease.escrow.tenantSigned))
  }

  const canRaiseDispute = (lease: Lease) => {
    return (lease.landlord === user?.publicKey || lease.tenant === user?.publicKey) &&
           lease.landlordSigned && 
           lease.tenantSigned && 
           lease.status === 0 &&
           (!lease.escrow || !lease.escrow.hasDispute)
  }

  const getUserRole = (lease: Lease) => {
    if (lease.landlord === user?.publicKey) return 'landlord'
    if (lease.tenant === user?.publicKey) return 'tenant'
    return null
  }

  const isLeaseExpired = (lease: Lease) => {
    return new Date(lease.endDate * 1000) < new Date()
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">租約管理</h1>
          <p className="text-muted-foreground">管理您的租約和租金</p>
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </div>
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
        <h1 className="text-3xl font-bold">租約管理</h1>
        <p className="text-muted-foreground">管理您的租約和租金</p>
      </div>

      <Tabs defaultValue="leases" className="w-full">
        <TabsList className={`grid w-full ${isLandlord ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <TabsTrigger value="leases">我的租約</TabsTrigger>
          {isLandlord && (
            <TabsTrigger value="create">創建租約</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="leases" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="w-48">
              <Select value={filterStatus} onValueChange={(value: FilterStatus) => setFilterStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{getStatusLabel('all')}</SelectItem>
                  <SelectItem value="pending">{getStatusLabel('pending')}</SelectItem>
                  <SelectItem value="active">{getStatusLabel('active')}</SelectItem>
                  <SelectItem value="completed">{getStatusLabel('completed')}</SelectItem>
                  <SelectItem value="terminated">{getStatusLabel('terminated')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredLeases.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {filterStatus === 'all' ? '還沒有租約' : '沒有符合條件的租約'}
              </h3>
              <p className="text-muted-foreground">
                {filterStatus === 'all' ? (
                  isLandlord && !isTenant ? '創建您的第一個租約' : 
                  !isLandlord && isTenant ? '等待房東創建租約' :
                  '創建租約或等待房東創建租約'
                ) : '請選擇其他篩選條件'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredLeases.map((lease) => {
                const userRole = getUserRole(lease)
                const expired = isLeaseExpired(lease)
                return (
                  <Card key={lease.publicKey} className={expired ? 'border-orange-200' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center space-x-2">
                          <FileText className="h-5 w-5" />
                          <span>
                            {lease.listingInfo?.metadata?.basic?.title || '租約'}
                          </span>
                        </CardTitle>
                        <div className="flex items-center space-x-2">
                          {expired && <Badge variant="destructive">已到期</Badge>}
                          {getLeaseStatusBadge(lease)}
                          {userRole === 'landlord' && (
                            <Badge variant="outline">房東</Badge>
                          )}
                          {userRole === 'tenant' && (
                            <Badge variant="outline">承租人</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="flex items-center text-muted-foreground">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span>{lease.listingInfo?.address}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">月租金</span>
                          <div className="font-semibold">${formatPrice(lease.rent)} USDC</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">押金</span>
                          <div className="font-semibold">${formatPrice(lease.deposit)} USDC</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">租期</span>
                          <div>
                            {formatDate(lease.startDate)} - {formatDate(lease.endDate)}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">繳費日</span>
                          <div>每月 {lease.paymentDay} 日</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">已付月數</span>
                          <div>{lease.paidMonths} 個月</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">簽署狀態</span>
                          <div className="flex items-center space-x-2">
                            {lease.landlordSigned ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-yellow-600" />
                            )}
                            <span>房東</span>
                            <Separator orientation="vertical" className="h-4" />
                            {lease.tenantSigned ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-yellow-600" />
                            )}
                            <span>承租人</span>
                          </div>
                        </div>
                      </div>

                      {lease.escrow && (
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm font-medium mb-2 flex items-center">
                            <Shield className="h-4 w-4 mr-2" />
                            託管狀態
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">託管金額：</span>
                              <span>${formatPrice(lease.escrow.amount)} USDC</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">狀態：</span>
                              <span>
                                {lease.escrow.status === 0 && '持有中'}
                                {lease.escrow.status === 1 && '釋放中'}
                                {lease.escrow.status === 2 && '已釋放'}
                              </span>
                            </div>
                          </div>
                          {lease.escrow.status === 1 && (
                            <div className="mt-2 text-sm">
                              <div>房東分配：${formatPrice(lease.escrow.releaseToLandlord)} USDC</div>
                              <div>承租人分配：${formatPrice(lease.escrow.releaseToTenant)} USDC</div>
                              <div className="flex items-center space-x-4 mt-1">
                                <div className="flex items-center space-x-1">
                                  {lease.escrow.landlordSigned ? (
                                    <CheckCircle className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Clock className="h-3 w-3 text-yellow-600" />
                                  )}
                                  <span className="text-xs">房東確認</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  {lease.escrow.tenantSigned ? (
                                    <CheckCircle className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Clock className="h-3 w-3 text-yellow-600" />
                                  )}
                                  <span className="text-xs">承租人確認</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {lease.escrow.hasDispute && (
                            <Alert className="mt-2">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                此租約存在爭議，押金釋放暫停
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2 border-t">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedLease(lease)
                              setShowLeaseDialog(true)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            查看詳情
                          </Button>
                          
                          {userRole === 'tenant' && lease.landlordSigned && lease.tenantSigned && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLease(lease)
                                fetchPaymentHistory(lease.publicKey)
                                setShowPaymentHistoryDialog(true)
                              }}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              支付記錄
                            </Button>
                          )}
                        </div>
                        
                        <div className="flex space-x-2">
                          {canSignLease(lease) && (
                            <Button
                              onClick={() => {
                                setSelectedLease(lease)
                                setShowSignDialog(true)
                              }}
                              disabled={isSigningLease}
                              size="sm"
                            >
                              {isSigningLease ? '簽署中...' : '簽署租約'}
                            </Button>
                          )}
                          
                          {canPayRent(lease) && (
                            <Button
                              onClick={() => {
                                setSelectedLease(lease)
                                setShowPaymentDialog(true)
                              }}
                              size="sm"
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              支付租金
                            </Button>
                          )}

                          {canInitiateDepositRelease(lease) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLease(lease)
                                setDepositReleaseData({
                                  landlordAmount: parseInt(lease.deposit) / 1_000_000,
                                  tenantAmount: 0,
                                  reason: ''
                                })
                                setShowDepositReleaseDialog(true)
                              }}
                            >
                              <HandCoins className="h-4 w-4 mr-2" />
                              押金結算
                            </Button>
                          )}

                          {canConfirmDepositRelease(lease) && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedLease(lease)
                                setShowDepositConfirmDialog(true)
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              確認結算
                            </Button>
                          )}

                          {canRaiseDispute(lease) && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedLease(lease)
                                resetDisputeForm()
                                setShowDisputeDialog(true)
                              }}
                            >
                              <Gavel className="h-4 w-4 mr-2" />
                              發起爭議
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {isLandlord && (
          <TabsContent value="create" className="space-y-4">
            {loadingApplications ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">載入核准申請中...</p>
              </div>
            ) : approvedApplications.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">沒有可創建租約的申請</h3>
                <p className="text-muted-foreground">
                  需要先有核准的申請才能創建租約
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">核准的申請</h3>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    創建新租約
                  </Button>
                </div>
                
                <div className="grid gap-4">
                  {approvedApplications.map((application) => (
                    <Card key={`${application.listing}-${application.applicant}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <h4 className="font-medium">
                              {application.listingInfo?.metadata?.basic?.title || '房源申請'}
                            </h4>
                            <div className="text-sm text-muted-foreground">
                              <div>申請人：{application.applicant.slice(0, 8)}...</div>
                              <div>房源地址：{application.listingInfo?.address}</div>
                              <div>申請時間：{formatDate(application.createdAt)}</div>
                            </div>
                          </div>
                          <Button
                            onClick={() => {
                              setFormData(prev => ({ ...prev, selectedApplication: application }))
                              setShowCreateDialog(true)
                            }}
                          >
                            創建租約
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>創建租約</DialogTitle>
            <DialogDescription>
              為核准的申請創建租約合同
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>選擇申請</Label>
              <Select
                value={formData.selectedApplication?.publicKey || ''}
                onValueChange={(value) => {
                  const app = approvedApplications.find(a => a.publicKey === value)
                  setFormData(prev => ({ ...prev, selectedApplication: app || null }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇要創建租約的申請" />
                </SelectTrigger>
                <SelectContent>
                  {approvedApplications.map((app) => (
                    <SelectItem key={app.publicKey} value={app.publicKey}>
                      {app.listingInfo?.metadata?.basic?.title || '房源'} - {app.applicant.slice(0, 8)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.selectedApplication && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="font-medium">申請詳情</div>
                <div className="text-sm space-y-1">
                  <div>房源：{formData.selectedApplication.listingInfo?.metadata?.basic?.title}</div>
                  <div>地址：{formData.selectedApplication.listingInfo?.address}</div>
                  <div>申請人：{formData.selectedApplication.applicant}</div>
                  <div>租金：${formatPrice(formData.selectedApplication.listingInfo?.rent || '0')} USDC</div>
                  <div>押金：${formatPrice(formData.selectedApplication.listingInfo?.deposit || '0')} USDC</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>開始日期</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {formData.startDate ? (
                        format(formData.startDate, "yyyy-MM-dd")
                      ) : (
                        <span>選擇開始日期</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.startDate}
                      onSelect={(date) => setFormData(prev => ({ ...prev, startDate: date }))}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>結束日期</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {formData.endDate ? (
                        format(formData.endDate, "yyyy-MM-dd")
                      ) : (
                        <span>選擇結束日期</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 h-[320px] overflow-hidden" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.endDate}
                      onSelect={(date) => setFormData(prev => ({ ...prev, endDate: date }))}
                      disabled={(date) => !formData.startDate || date <= formData.startDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>每月繳費日</Label>
              <Select
                value={formData.paymentDay.toString()}
                onValueChange={(value) => setFormData(prev => ({ ...prev, paymentDay: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_DAYS.map(day => (
                    <SelectItem key={day} value={day.toString()}>
                      每月 {day} 日
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>合約條款</Label>
              <Textarea
                value={formData.contractTerms}
                onChange={(e) => setFormData(prev => ({ ...prev, contractTerms: e.target.value }))}
                placeholder="租約的基本條款和規定..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>特殊約定</Label>
              <Textarea
                value={formData.specialConditions}
                onChange={(e) => setFormData(prev => ({ ...prev, specialConditions: e.target.value }))}
                placeholder="額外的特殊約定條款..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                resetForm()
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleCreateLease}
              disabled={isCreatingLease || !formData.selectedApplication || !formData.startDate || !formData.endDate}
            >
              {isCreatingLease ? '創建中...' : '創建租約'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLeaseDialog} onOpenChange={setShowLeaseDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>租約詳情</DialogTitle>
          </DialogHeader>

          {selectedLease && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">基本資訊</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="text-muted-foreground">房源地址</span>
                      <div>{selectedLease.listingInfo?.address}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">租約編號</span>
                      <div className="font-mono text-xs">{selectedLease.publicKey}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">房東</span>
                      <div className="font-mono text-xs">{selectedLease.landlord}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">承租人</span>
                      <div className="font-mono text-xs">{selectedLease.tenant}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">租金資訊</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="text-muted-foreground">月租金</span>
                      <div className="text-lg font-semibold">${formatPrice(selectedLease.rent)} USDC</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">押金</span>
                      <div className="text-lg font-semibold">${formatPrice(selectedLease.deposit)} USDC</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">每月繳費日</span>
                      <div>{selectedLease.paymentDay} 日</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">已付月數</span>
                      <div>{selectedLease.paidMonths} 個月</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">租期資訊</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-muted-foreground">開始日期</span>
                      <div>{formatDate(selectedLease.startDate)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">結束日期</span>
                      <div>{formatDate(selectedLease.endDate)}</div>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">簽署狀態</span>
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center space-x-2">
                        {selectedLease.landlordSigned ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                        <span>房東已簽署</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {selectedLease.tenantSigned ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                        <span>承租人已簽署</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedLease.contract && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">合約條款</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedLease.contract.terms?.contractTerms && (
                      <div>
                        <span className="text-muted-foreground">合約條款</span>
                        <div className="whitespace-pre-line text-sm mt-1">
                          {selectedLease.contract.terms.contractTerms}
                        </div>
                      </div>
                    )}
                    {selectedLease.contract.terms?.specialConditions && (
                      <div>
                        <span className="text-muted-foreground">特殊約定</span>
                        <div className="whitespace-pre-line text-sm mt-1">
                          {selectedLease.contract.terms.specialConditions}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {selectedLease.escrow && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">託管狀態</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="text-muted-foreground">託管金額</span>
                      <div>${formatPrice(selectedLease.escrow.amount)} USDC</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">託管狀態</span>
                      <div>
                        {selectedLease.escrow.status === 0 && '持有中'}
                        {selectedLease.escrow.status === 1 && '釋放中'}
                        {selectedLease.escrow.status === 2 && '已釋放'}
                      </div>
                    </div>
                    {selectedLease.escrow.hasDispute && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          此租約存在爭議，押金釋放暫停
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>簽署租約</DialogTitle>
            <DialogDescription>
              確認要簽署此租約嗎？簽署後將自動支付押金到託管帳戶
            </DialogDescription>
          </DialogHeader>

          {selectedLease && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="font-medium">租約摘要</div>
                <div className="text-sm space-y-1">
                  <div>房源：{selectedLease.listingInfo?.address}</div>
                  <div>租期：{formatDate(selectedLease.startDate)} - {formatDate(selectedLease.endDate)}</div>
                  <div>月租金：${formatPrice(selectedLease.rent)} USDC</div>
                  <div>押金：${formatPrice(selectedLease.deposit)} USDC</div>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  簽署後將從您的帳戶扣除 ${formatPrice(selectedLease.deposit)} USDC 作為押金託管
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignDialog(false)}>
              取消
            </Button>
            <Button
              onClick={() => selectedLease && handleSignLease(selectedLease)}
              disabled={isSigningLease}
            >
              {isSigningLease ? '簽署中...' : '確認簽署'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>支付租金</DialogTitle>
            <DialogDescription>
              確認要支付本月租金嗎？
            </DialogDescription>
          </DialogHeader>

          {selectedLease && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="font-medium">支付摘要</div>
                <div className="text-sm space-y-1">
                  <div>房源：{selectedLease.listingInfo?.address}</div>
                  <div>本期租金：${formatPrice(selectedLease.rent)} USDC</div>
                  <div>第 {selectedLease.paidMonths + 1} 個月租金</div>
                  <div>繳費日：每月 {selectedLease.paymentDay} 日</div>
                </div>
              </div>

              <Alert>
                <CreditCard className="h-4 w-4" />
                <AlertDescription>
                  將從您的帳戶扣除 ${formatPrice(selectedLease.rent)} USDC
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              取消
            </Button>
            <Button
              onClick={() => selectedLease && handlePayRent(selectedLease)}
              disabled={isPayingRent}
            >
              {isPayingRent ? '支付中...' : '確認支付'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentHistoryDialog} onOpenChange={setShowPaymentHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>支付記錄</DialogTitle>
            <DialogDescription>
              查看租金支付歷史記錄
            </DialogDescription>
          </DialogHeader>

          {selectedLease && paymentHistory[selectedLease.publicKey] && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">已付月數</div>
                    <div className="text-2xl font-bold">
                      {paymentHistory[selectedLease.publicKey].paidMonths} / {paymentHistory[selectedLease.publicKey].totalMonths}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">已付金額</div>
                    <div className="text-2xl font-bold">
                      ${formatPrice(paymentHistory[selectedLease.publicKey].totalPaid)} USDC
                    </div>
                  </CardContent>
                </Card>
              </div>

              {paymentHistory[selectedLease.publicKey].nextPayment && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    下次應付：{paymentHistory[selectedLease.publicKey].nextPayment.monthName} ${formatPrice(paymentHistory[selectedLease.publicKey].nextPayment.amount)} USDC
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2 max-h-60 overflow-y-auto">
                <div className="font-medium">支付記錄</div>
                {paymentHistory[selectedLease.publicKey].payments.map((payment, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <div>
                      <div className="font-medium">{payment.monthName}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(payment.date).toLocaleDateString('zh-TW')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${formatPrice(payment.amount)} USDC</div>
                      <Badge variant="outline" className="text-xs">已支付</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDepositReleaseDialog} onOpenChange={(open) => {
        setShowDepositReleaseDialog(open)
        if (!open) resetDepositForm()
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>發起押金結算</DialogTitle>
            <DialogDescription>
              設定押金分配方案並發起結算
            </DialogDescription>
          </DialogHeader>

          {selectedLease && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="font-medium mb-2">押金資訊</div>
                <div className="text-sm">
                  總押金：${formatPrice(selectedLease.deposit)} USDC
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>房東分配 (USDC)</Label>
                  <Input
                    type="number"
                    min="0"
                    max={parseInt(selectedLease.deposit) / 1_000_000}
                    value={depositReleaseData.landlordAmount}
                    onChange={(e) => {
                      const landlordAmount = parseFloat(e.target.value) || 0
                      const totalDeposit = parseInt(selectedLease.deposit) / 1_000_000
                      setDepositReleaseData(prev => ({
                        ...prev,
                        landlordAmount,
                        tenantAmount: totalDeposit - landlordAmount
                      }))
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>承租人分配 (USDC)</Label>
                  <Input
                    type="number"
                    min="0"
                    max={parseInt(selectedLease.deposit) / 1_000_000}
                    value={depositReleaseData.tenantAmount}
                    onChange={(e) => {
                      const tenantAmount = parseFloat(e.target.value) || 0
                      const totalDeposit = parseInt(selectedLease.deposit) / 1_000_000
                      setDepositReleaseData(prev => ({
                        ...prev,
                        tenantAmount,
                        landlordAmount: totalDeposit - tenantAmount
                      }))
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>結算說明</Label>
                <Textarea
                  value={depositReleaseData.reason}
                  onChange={(e) => setDepositReleaseData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="說明押金分配的理由..."
                  rows={3}
                />
              </div>

              <Alert>
                <HandCoins className="h-4 w-4" />
                <AlertDescription>
                  發起後需要對方確認才能完成押金釋放
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepositReleaseDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleDepositRelease}
              disabled={isReleasingDeposit || 
                !selectedLease || 
                depositReleaseData.landlordAmount + depositReleaseData.tenantAmount !== parseInt(selectedLease.deposit) / 1_000_000}
            >
              {isReleasingDeposit ? '發起中...' : '發起結算'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDepositConfirmDialog} onOpenChange={setShowDepositConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認押金結算</DialogTitle>
            <DialogDescription>
              確認押金分配方案並完成結算
            </DialogDescription>
          </DialogHeader>

          {selectedLease && selectedLease.escrow && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="font-medium">分配方案</div>
                <div className="text-sm">
                  <div>房東獲得：${formatPrice(selectedLease.escrow.releaseToLandlord)} USDC</div>
                  <div>承租人獲得：${formatPrice(selectedLease.escrow.releaseToTenant)} USDC</div>
                </div>
              </div>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  確認後押金將立即釋放到各自帳戶
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepositConfirmDialog(false)}>
              取消
            </Button>
            <Button
              onClick={() => selectedLease && handleDepositConfirm(selectedLease)}
              disabled={isConfirmingDeposit}
            >
              {isConfirmingDeposit ? '確認中...' : '確認結算'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDisputeDialog} onOpenChange={(open) => {
        setShowDisputeDialog(open)
        if (!open) resetDisputeForm()
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>發起爭議</DialogTitle>
            <DialogDescription>
              對租約相關事項發起爭議處理
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <Label>爭議類型</Label>
              <RadioGroup
                value={disputeData.reason.toString()}
                onValueChange={(value) => setDisputeData(prev => ({ ...prev, reason: parseInt(value) }))}
              >
                {DISPUTE_REASONS.map((reason) => (
                  <div key={reason.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={reason.value.toString()} id={`reason-${reason.value}`} />
                    <Label htmlFor={`reason-${reason.value}`} className="cursor-pointer">
                      <div>
                        <div className="font-medium">{reason.label}</div>
                        <div className="text-sm text-muted-foreground">{reason.description}</div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>爭議說明</Label>
              <Textarea
                value={disputeData.description}
                onChange={(e) => setDisputeData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="詳細說明爭議內容..."
                rows={4}
              />
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                發起爭議後將暫停相關操作，由仲裁者處理
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisputeDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleRaiseDispute}
              disabled={isRaisingDispute}
              variant="destructive"
            >
              {isRaisingDispute ? '發起中...' : '發起爭議'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}