import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell } from "@hydrax/ui";
import { OpsSidebar, OpsBrand } from "./components/OpsSidebar";
import { OpsTopBar } from "./components/OpsTopBar";
import { HomeRoute } from "./routes/HomeRoute";
import { AuditRoute } from "./routes/AuditRoute";

const store = configureStore({
  reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
  middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
});

function ShellContents() {
  const location = useLocation();
  return (
    <AppShell
      appName="ops-console"
      brand={<OpsBrand />}
      sidebar={<OpsSidebar currentPath={location.pathname} />}
      topbar={<OpsTopBar userName="Ops Operator" />}
    >
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/audit" element={<AuditRoute />} />
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
