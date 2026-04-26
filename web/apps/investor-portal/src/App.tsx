import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell } from "@hydrax/ui";
import { InvestorSidebar, InvestorBrand } from "./components/InvestorSidebar";
import { InvestorTopBar } from "./components/InvestorTopBar";
import { HomeRoute } from "./routes/HomeRoute";
import { HealthRoute } from "./routes/HealthRoute";
import { SubscriptionsRoute } from "./routes/SubscriptionsRoute";
import { ProductsListRoute } from "./routes/ProductsListRoute";
import { ProductDetailRoute } from "./routes/ProductDetailRoute";
import { SubscribeRoute } from "./routes/SubscribeRoute";

const store = configureStore({
  reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
  middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
});

function ShellContents() {
  const location = useLocation();
  return (
    <AppShell
      appName="investor-portal"
      brand={<InvestorBrand />}
      sidebar={<InvestorSidebar currentPath={location.pathname} />}
      topbar={<InvestorTopBar userName="Investor Operator" />}
    >
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/health" element={<HealthRoute />} />
        <Route path="/subscriptions" element={<SubscriptionsRoute />} />
        <Route path="/products" element={<ProductsListRoute />} />
        <Route path="/products/:id" element={<ProductDetailRoute />} />
        <Route path="/subscribe" element={<SubscribeRoute />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <ShellContents />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
}
