import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { WalletContextProvider } from '@/components/wallet-context-provider'
import { DashboardLayout } from '@/components/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

import { LoginPage } from '@/pages/login'
import { CredentialsRequiredPage } from '@/pages/credentials-required'
import { DashboardPage } from '@/pages/dashboard'
import { BrowseListingsPage } from '@/pages/browse'
import { ApplicationsPage } from '@/pages/applications'
import { TenantLeasesPage } from '@/pages/leases/tenant'
import { ListingsPage } from '@/pages/listings'
import { ManageApplicationsPage } from '@/pages/applications/manage'
import { LandlordLeasesPage } from '@/pages/leases/landlord'
import { PaymentsPage } from '@/pages/payments'
import { DisputesPage } from '@/pages/disputes'

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="zuvi-ui-theme">
      <WalletContextProvider>
        <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/credentials-required" element={<CredentialsRequiredPage />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout>
                <DashboardPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard/browse" element={
            <ProtectedRoute requireCitizenCredential>
              <DashboardLayout>
                <BrowseListingsPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard/applications" element={
            <ProtectedRoute requireCitizenCredential>
              <DashboardLayout>
                <ApplicationsPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard/leases/tenant" element={
            <ProtectedRoute requireCitizenCredential>
              <DashboardLayout>
                <TenantLeasesPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard/listings" element={
            <ProtectedRoute requirePropertyCredential>
              <DashboardLayout>
                <ListingsPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard/applications/manage" element={
            <ProtectedRoute requirePropertyCredential>
              <DashboardLayout>
                <ManageApplicationsPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard/leases/landlord" element={
            <ProtectedRoute requirePropertyCredential>
              <DashboardLayout>
                <LandlordLeasesPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard/payments" element={
            <ProtectedRoute>
              <DashboardLayout>
                <PaymentsPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard/disputes" element={
            <ProtectedRoute>
              <DashboardLayout>
                <DisputesPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
      </WalletContextProvider>
    </ThemeProvider>
  )
}

export default App