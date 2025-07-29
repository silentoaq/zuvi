import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import { useMemo } from 'react'
import { ThemeProvider } from 'next-themes'

import Layout from '@/components/layout/Layout'
import {
  HomePage,
  ListingDetailPage,
  ApplicationsPage,
  ApplyPage,
  CreateListingPage,
  ManageListingsPage,
  ManageLeasesPage,
  DisputesPage
} from '@/pages'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useWalletAuth } from '@/hooks/useWalletAuth'

import '@solana/wallet-adapter-react-ui/styles.css'

function AppContent() {
  useWalletAuth()

  return (
    <Router>
      <Layout>
        <Routes>
          {/* 公開頁面 */}
          <Route path="/" element={<HomePage />} />
          <Route path="/listing/:id" element={<ListingDetailPage />} />
          
          {/* 需要錢包連接 */}
          <Route 
            path="/applications" 
            element={
              <ProtectedRoute requireWallet>
                <ApplicationsPage />
              </ProtectedRoute>
            } 
          />
          
          {/* 需要自然人憑證 */}
          <Route 
            path="/apply/:listingId" 
            element={
              <ProtectedRoute requireCitizen>
                <ApplyPage />
              </ProtectedRoute>
            } 
          />
          
          {/* 需要產權憑證 */}
          <Route 
            path="/listings/create" 
            element={
              <ProtectedRoute requireProperty>
                <CreateListingPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/listings/manage" 
            element={
              <ProtectedRoute requireProperty>
                <ManageListingsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/leases/manage" 
            element={
              <ProtectedRoute requireProperty>
                <ManageLeasesPage />
              </ProtectedRoute>
            } 
          />
          
          {/* 仲裁者專用 */}
          <Route 
            path="/disputes" 
            element={
              <ProtectedRoute requireArbitrator>
                <DisputesPage />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Layout>
    </Router>
  )
}

function App() {
  const network = WalletAdapterNetwork.Devnet
  const endpoint = useMemo(() => clusterApiUrl(network), [network])
  
  const wallets = useMemo(
    () => [new PhantomWalletAdapter()],
    []
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <AppContent />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ThemeProvider>
  )
}

export default App