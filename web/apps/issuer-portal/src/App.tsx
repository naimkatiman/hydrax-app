import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell, ComingSoonRoute, ToastProvider } from "@hydrax/ui";
import { IssuerSidebar, IssuerBrand } from "./components/IssuerSidebar";
import { IssuerTopBar } from "./components/IssuerTopBar";
import { HomeRoute } from "./routes/HomeRoute";
import { ProductNewRoute } from "./routes/ProductNewRoute";
import { ProductsListRoute } from "./routes/ProductsListRoute";
import { ProductDetailRoute } from "./routes/ProductDetailRoute";

const store = configureStore({
  reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
  middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
});

function ShellContents() {
  const location = useLocation();
  return (
    <AppShell
      appName="issuer-portal"
      brand={<IssuerBrand />}
      sidebar={<IssuerSidebar currentPath={location.pathname} />}
      topbar={<IssuerTopBar userName="Naim Katiman" />}
    >
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/products" element={<ProductsListRoute />} />
        <Route path="/products/new" element={<ProductNewRoute />} />
        <Route path="/products/:id" element={<ProductDetailRoute />} />
        <Route path="*" element={<ComingSoonRoute />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <ToastProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <ShellContents />
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </Provider>
  );
}
