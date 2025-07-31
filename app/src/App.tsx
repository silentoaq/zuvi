import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import { useMemo } from 'react'
import { ThemeProvider, useTheme } from 'next-themes'
import { Toaster } from 'sonner'

import Layout from '@/components/layout/Layout'
import { TransactionProvider } from '@/components/transaction/TransactionProvider'
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
  const { theme } = useTheme()

  return (
    <TransactionProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/listing/:id" element={<ListingDetailPage />} />
            
            <Route 
              path="/applications" 
              element={
                <ProtectedRoute requireWallet>
                  <ApplicationsPage />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/apply/:listingId" 
              element={
                <ProtectedRoute requireCitizen>
                  <ApplyPage />
                </ProtectedRoute>
              } 
            />
            
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
                <ProtectedRoute requireWallet>
                  <ManageLeasesPage />
                </ProtectedRoute>
              } 
            />
            
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
        <Toaster 
          position="bottom-right" 
          theme={theme as 'light' | 'dark' | 'system'} 
        />
      </Router>
    </TransactionProvider>
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
        <WalletProvider wallets={wallets} autoConnect={true}>
          <WalletModalProvider>
            <AppContent />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ThemeProvider>
  )
}

export default App