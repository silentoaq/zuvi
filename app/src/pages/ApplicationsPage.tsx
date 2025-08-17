import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { Transaction } from '@solana/web3.js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, UserCheck, UserX, FileText, AlertCircle, XCircle } from 'lucide-react'
import { useTransaction } from '@/hooks/useTransaction'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface Application {
  publicKey: string
  applicant: string
  tenantAttest: string
  status: number
  createdAt: number
  message?: {
    applicant?: {
      name?: string
      occupation?: string
      company_type?: string
      birth_date?: string
      gender?: string
    }
    preferences?: {
      move_in_date?: string
      lease_term_months?: number
    }
    message?: string
  }
  ipfsHash?: string
}

interface Listing {
  publicKey: string
  address: string
  rent: string
  deposit: string
  status: number
  hasActiveLease: boolean
  hasApprovedApplication: boolean
  metadata?: {
    basic?: {
      title?: string
    }
  }
}

export default function ManageApplicationsPage() {
  const { publicKey } = useWallet()
  const { listingId } = useParams<{ listingId: string }>()
  const navigate = useNavigate()
  const [listing, setListing] = useState<Listing | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [createLeaseOpen, setCreateLeaseOpen] = useState(false)
  const [selectedApplicant, setSelectedApplicant] = useState<string>('')
  const [leaseForm, setLeaseForm] = useState({
    startDate: '',
    endDate: '',
    paymentDay: '1',
    terms: ''
  })

  const approveTransaction = useTransaction({
    onSuccess: () => {
      toast.success('申請已批准')
      fetchApplications()
      fetchListing()
      setProcessingId(null)
    },
    onError: () => {
      setProcessingId(null)
    }
  })

  const rejectTransaction = useTransaction({
    onSuccess: () => {
      toast.success('申請已拒絕')
      fetchApplications()
      setProcessingId(null)
    },
    onError: () => {
      setProcessingId(null)
    }
  })

  const cancelApprovedTransaction = useTransaction({
    onSuccess: () => {
      toast.success('已取消核准的申請')
      fetchApplications()
      fetchListing()
      setProcessingId(null)
    },
    onError: () => {
      setProcessingId(null)
    }
  })

  const createLeaseTransaction = useTransaction({
    onSuccess: () => {
      toast.success('租約已創建，等待承租人簽署')
      setCreateLeaseOpen(false)
      navigate('/manage-leases')
    },
    onError: () => {
      setProcessingId(null)
    }
  })

  useEffect(() => {
    if (listingId) {
      fetchListing()
      fetchApplications()
    }
  }, [listingId])

  const fetchListing = async () => {
    try {
      const response = await fetch(`/api/listings/${listingId}`)
      if (response.ok) {
        const data = await response.json()
        setListing(data)
      }
    } catch (error) {
      console.error('Error fetching listing:', error)
    }
  }

  const fetchApplications = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/applications/listing/${listingId}`, {
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
      toast.error('無法載入申請列表')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = useCallback(async (applicant: string) => {
    try {
      setProcessingId(applicant)
      
      const response = await fetch(`/api/applications/${listingId}/approve/${applicant}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to approve')
      }

      const { transaction: serializedTx } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
      
      await approveTransaction.executeTransaction(tx)
    } catch (error) {
      console.error('Error approving:', error)
      toast.error(error instanceof Error ? error.message : '批准失敗')
      setProcessingId(null)
    }
  }, [listingId])

  const handleReject = useCallback(async (applicant: string) => {
    try {
      setProcessingId(applicant)
      
      const response = await fetch(`/api/applications/${listingId}/reject/${applicant}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reject')
      }

      const { transaction: serializedTx } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
      
      await rejectTransaction.executeTransaction(tx)
    } catch (error) {
      console.error('Error rejecting:', error)
      toast.error(error instanceof Error ? error.message : '拒絕失敗')
      setProcessingId(null)
    }
  }, [listingId])

  const handleCancelApproved = useCallback(async (applicant: string) => {
    try {
      setProcessingId(applicant)
      
      const response = await fetch(`/api/applications/${listingId}/cancel-approved/${applicant}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel approved application')
      }

      const { transaction: serializedTx } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
      
      await cancelApprovedTransaction.executeTransaction(tx)
    } catch (error) {
      console.error('Error cancelling approved application:', error)
      toast.error(error instanceof Error ? error.message : '取消失敗')
      setProcessingId(null)
    }
  }, [listingId])

  const handleCreateLease = async () => {
    try {
      setProcessingId(selectedApplicant)
      
      const contract = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        listing: listingId,
        landlord: publicKey?.toString(),
        tenant: selectedApplicant,
        terms: leaseForm.terms,
        startDate: leaseForm.startDate,
        endDate: leaseForm.endDate,
        paymentDay: parseInt(leaseForm.paymentDay),
        rent: listing?.rent,
        deposit: listing?.deposit
      }

      const response = await fetch('/api/leases/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zuvi-auth-token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          listing: listingId,
          applicant: selectedApplicant,
          startDate: Math.floor(new Date(leaseForm.startDate).getTime() / 1000),
          endDate: Math.floor(new Date(leaseForm.endDate).getTime() / 1000),
          paymentDay: parseInt(leaseForm.paymentDay),
          contract
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create lease')
      }

      const { transaction: serializedTx, cleanup } = await response.json()
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))

      if (cleanup?.contractHash) {
        createLeaseTransaction.updateCleanupInfo({
          ipfsHashes: [cleanup.contractHash]
        })
      }
      
      await createLeaseTransaction.executeTransaction(tx)
    } catch (error) {
      console.error('Error creating lease:', error)
      toast.error(error instanceof Error ? error.message : '創建租約失敗')
      setProcessingId(null)
    }
  }

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 0:
        return <Badge variant="secondary">待審核</Badge>
      case 1:
        return <Badge variant="default">已批准</Badge>
      case 2:
        return <Badge variant="destructive">已拒絕</Badge>
      default:
        return <Badge variant="outline">未知</Badge>
    }
  }

  const pendingApplications = applications.filter(app => app.status === 0)
  const approvedApplications = applications.filter(app => app.status === 1)
  const rejectedApplications = applications.filter(app => app.status === 2)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">管理申請</h1>
        {listing && (
          <div className="text-muted-foreground">
            <p>{listing.metadata?.basic?.title || listing.address}</p>
            <div className="flex gap-4 mt-2">
              <span>月租: ${parseInt(listing.rent) / 1000000} USDC</span>
              <span>押金: ${parseInt(listing.deposit) / 1000000} USDC</span>
              {listing.hasActiveLease && (
                <Badge variant="secondary">已有生效租約</Badge>
              )}
              {listing.hasApprovedApplication && !listing.hasActiveLease && (
                <Badge variant="default">有已核准申請</Badge>
              )}
            </div>
          </div>
        )}
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            待審核 ({pendingApplications.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            已批准 ({approvedApplications.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            已拒絕 ({rejectedApplications.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingApplications.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                暫無待審核的申請
              </CardContent>
            </Card>
          ) : (
            pendingApplications.map((app) => (
              <Card key={app.publicKey}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {app.message?.applicant?.name || '申請人'}
                      </CardTitle>
                      <CardDescription>
                        申請時間: {format(new Date(app.createdAt * 1000), 'yyyy年MM月dd日 HH:mm', { locale: zhTW })}
                      </CardDescription>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {app.message && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {app.message.applicant && (
                        <>
                          <div>
                            <span className="text-muted-foreground">職業: </span>
                            {app.message.applicant.occupation}
                          </div>
                          <div>
                            <span className="text-muted-foreground">公司類型: </span>
                            {app.message.applicant.company_type}
                          </div>
                          <div>
                            <span className="text-muted-foreground">性別: </span>
                            {app.message.applicant.gender}
                          </div>
                          <div>
                            <span className="text-muted-foreground">生日: </span>
                            {app.message.applicant.birth_date}
                          </div>
                        </>
                      )}
                      {app.message.preferences && (
                        <>
                          <div>
                            <span className="text-muted-foreground">希望入住日: </span>
                            {app.message.preferences.move_in_date}
                          </div>
                          <div>
                            <span className="text-muted-foreground">租期: </span>
                            {app.message.preferences.lease_term_months} 個月
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {app.message?.message && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">{app.message.message}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleApprove(app.applicant)}
                      disabled={processingId === app.applicant || listing?.hasApprovedApplication}
                      size="sm"
                    >
                      {processingId === app.applicant ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <UserCheck className="h-4 w-4 mr-2" />
                      )}
                      批准
                    </Button>
                    <Button
                      onClick={() => handleReject(app.applicant)}
                      disabled={processingId === app.applicant}
                      variant="destructive"
                      size="sm"
                    >
                      {processingId === app.applicant ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <UserX className="h-4 w-4 mr-2" />
                      )}
                      拒絕
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {approvedApplications.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                暫無已批准的申請
              </CardContent>
            </Card>
          ) : (
            approvedApplications.map((app) => (
              <Card key={app.publicKey}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {app.message?.applicant?.name || '申請人'}
                      </CardTitle>
                      <CardDescription>
                        批准時間: {format(new Date(app.createdAt * 1000), 'yyyy年MM月dd日 HH:mm', { locale: zhTW })}
                      </CardDescription>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  {app.message && (
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      {app.message.preferences && (
                        <>
                          <div>
                            <span className="text-muted-foreground">希望入住日: </span>
                            {app.message.preferences.move_in_date}
                          </div>
                          <div>
                            <span className="text-muted-foreground">租期: </span>
                            {app.message.preferences.lease_term_months} 個月
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {listing?.hasActiveLease ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />
                      已有生效的租約
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setSelectedApplicant(app.applicant)
                          setCreateLeaseOpen(true)
                        }}
                        disabled={processingId === app.applicant}
                        size="sm"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        創建租約
                      </Button>
                      <Button
                        onClick={() => handleCancelApproved(app.applicant)}
                        disabled={processingId === app.applicant}
                        variant="outline"
                        size="sm"
                      >
                        {processingId === app.applicant ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2" />
                        )}
                        取消核准
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {rejectedApplications.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                暫無已拒絕的申請
              </CardContent>
            </Card>
          ) : (
            rejectedApplications.map((app) => (
              <Card key={app.publicKey}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {app.message?.applicant?.name || '申請人'}
                      </CardTitle>
                      <CardDescription>
                        拒絕時間: {format(new Date(app.createdAt * 1000), 'yyyy年MM月dd日 HH:mm', { locale: zhTW })}
                      </CardDescription>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={createLeaseOpen} onOpenChange={setCreateLeaseOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>創建租約</DialogTitle>
            <DialogDescription>
              設定租約條款，創建後需要承租人簽署才能生效
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">開始日期</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={leaseForm.startDate}
                  onChange={(e) => setLeaseForm({ ...leaseForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">結束日期</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={leaseForm.endDate}
                  onChange={(e) => setLeaseForm({ ...leaseForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDay">每月繳費日</Label>
              <Select
                value={leaseForm.paymentDay}
                onValueChange={(value) => setLeaseForm({ ...leaseForm, paymentDay: value })}
              >
                <SelectTrigger id="paymentDay">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      每月 {day} 日
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="terms">特別條款</Label>
              <Textarea
                id="terms"
                placeholder="輸入任何特別條款或備註..."
                value={leaseForm.terms}
                onChange={(e) => setLeaseForm({ ...leaseForm, terms: e.target.value })}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">月租</p>
                <p className="font-semibold">${listing && parseInt(listing.rent) / 1000000} USDC</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">押金</p>
                <p className="font-semibold">${listing && parseInt(listing.deposit) / 1000000} USDC</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateLeaseOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleCreateLease}
              disabled={!leaseForm.startDate || !leaseForm.endDate || processingId !== null}
            >
              {processingId !== null && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              創建租約
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}