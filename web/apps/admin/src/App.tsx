import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell } from "@hydrax/ui";
import { AdminSidebar, AdminBrand } from "./components/AdminSidebar";
import { AdminTopBar } from "./components/AdminTopBar";
import { HomeRoute } from "./routes/HomeRoute";
import { ComposabilityRoute } from "./routes/ComposabilityRoute";
import { ProjectionsRoute } from "./routes/ProjectionsRoute";

const store = configureStore({
  reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
  middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
});

function ShellContents() {
  const location = useLocation();
  return (
    <AppShell
      appName="admin"
      brand={<AdminBrand />}
      sidebar={<AdminSidebar currentPath={location.pathname} />}
      topbar={<AdminTopBar userName="Platform Admin" />}
    >
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/composability" element={<ComposabilityRoute />} />
        <Route path="/projections" element={<ProjectionsRoute />} />
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
