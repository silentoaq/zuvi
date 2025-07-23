import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/providers/wallet-provider";
import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/components/protected-route";
import { PropertiesPage } from "@/pages/properties";
import { PropertyDetailPage } from "@/pages/property-detail";
import { DashboardPage } from "@/pages/dashboard";
import { PublishPropertyPage } from "@/pages/publish-property";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <WalletProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<PropertiesPage />} />
              <Route path="property/:id" element={<PropertyDetailPage />} />
              <Route 
                path="dashboard" 
                element={
                  <ProtectedRoute requireWallet>
                    <DashboardPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="publish" 
                element={
                  <ProtectedRoute requireWallet requireCitizen requireProperty>
                    <PublishPropertyPage />
                  </ProtectedRoute>
                } 
              />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </WalletProvider>
    </ThemeProvider>
  );
}

export default App;