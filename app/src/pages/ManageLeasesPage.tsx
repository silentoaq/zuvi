import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { Transaction } from '@solana/web3.js'
import { Calendar as CalendarIcon, FileText, MapPin, Clock, CheckCircle, AlertCircle, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

const PAYMENT_DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

export default function ManageLeasesPage() {
  const { user } = useAuthStore()
  
  const [leases, setLeases] = useState<Lease[]>([])
  const [approvedApplications, setApprovedApplications] = useState<ApprovedApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingApplications, setLoadingApplications] = useState(false)
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showLeaseDialog, setShowLeaseDialog] = useState(false)
  const [showSignDialog, setShowSignDialog] = useState(false)
  
  const [formData, setFormData] = useState<CreateLeaseFormData>({
    selectedApplication: null,
    startDate: undefined,
    endDate: undefined,
    paymentDay: 5,
    contractTerms: '',
    specialConditions: ''
  })

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

  useEffect(() => {
    fetchLeases()
    if (user?.credentialStatus?.twland?.exists) {
      fetchApprovedApplications()
    }
  }, [user])

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

  const isLandlord = user?.credentialStatus?.twland?.exists

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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="leases">我的租約</TabsTrigger>
          {isLandlord && (
            <TabsTrigger value="create">創建租約</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="leases" className="space-y-4">
          {leases.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">還沒有租約</h3>
              <p className="text-muted-foreground">
                {isLandlord ? '創建您的第一個租約' : '等待房東創建租約'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {leases.map((lease) => (
                <Card key={lease.publicKey}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="h-5 w-5" />
                        <span>
                          {lease.listingInfo?.metadata?.basic?.title || '租約'}
                        </span>
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        {getLeaseStatusBadge(lease)}
                        {lease.landlord === user?.publicKey && (
                          <Badge variant="outline">房東</Badge>
                        )}
                        {lease.tenant === user?.publicKey && (
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
                        <div className="text-sm font-medium mb-2">託管狀態</div>
                        <div className="text-sm text-muted-foreground">
                          押金已託管：${formatPrice(lease.escrow.amount)} USDC
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedLease(lease)
                          setShowLeaseDialog(true)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        查看詳情
                      </Button>
                      
                      {canSignLease(lease) && (
                        <Button
                          onClick={() => {
                            setSelectedLease(lease)
                            setShowSignDialog(true)
                          }}
                          disabled={isSigningLease}
                        >
                          {isSigningLease ? '簽署中...' : '簽署租約'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                      <CalendarIcon className="mr-2 h-4 w-4" />
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
                      <CalendarIcon className="mr-2 h-4 w-4" />
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
    </div>
  )
}