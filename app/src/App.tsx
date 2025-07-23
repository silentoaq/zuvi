import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/providers/wallet-provider";
import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/components/protected-route";
import { PropertiesPage } from "@/pages/properties";
import { ListPropertyPage } from "@/pages/list-property";
import { MyPropertiesPage } from "@/pages/my-properties";
import { MyContractsPage } from "@/pages/my-contracts";
import { PropertyDetailPage } from "@/pages/property-detail";
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
                path="list-property" 
                element={
                  <ProtectedRoute requireWallet requireCitizen requireProperty>
                    <ListPropertyPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="my-properties" 
                element={
                  <ProtectedRoute requireWallet>
                    <MyPropertiesPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="my-contracts" 
                element={
                  <ProtectedRoute requireWallet>
                    <MyContractsPage />
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