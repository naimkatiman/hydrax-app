import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell } from "@hydrax/ui";
import { DistributorSidebar, DistributorBrand } from "./components/DistributorSidebar";
import { DistributorTopBar } from "./components/DistributorTopBar";
import { HomeRoute } from "./routes/HomeRoute";
import { ApprovalsRoute } from "./routes/ApprovalsRoute";

const store = configureStore({
  reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
  middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
});

function ShellContents() {
  const location = useLocation();
  return (
    <AppShell
      appName="distributor-portal"
      brand={<DistributorBrand />}
      sidebar={<DistributorSidebar currentPath={location.pathname} />}
      topbar={<DistributorTopBar userName="Distributor Operator" />}
    >
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/approvals" element={<ApprovalsRoute />} />
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
