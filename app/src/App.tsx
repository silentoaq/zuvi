import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { PropertiesPage } from "@/pages/properties";
import { ListPropertyPage } from "@/pages/list-property";
import { MyPropertiesPage } from "@/pages/my-properties";
import { MyContractsPage } from "@/pages/my-contracts";
import { PropertyDetailPage } from "@/pages/property-detail";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<PropertiesPage />} />
            <Route path="property/:id" element={<PropertyDetailPage />} />
            <Route path="list-property" element={<ListPropertyPage />} />
            <Route path="my-properties" element={<MyPropertiesPage />} />
            <Route path="my-contracts" element={<MyContractsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;