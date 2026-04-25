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
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <BrowserRouter>
          <ShellContents />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
}
