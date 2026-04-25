import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell } from "@hydrax/ui";
import { AdminSidebar, AdminBrand } from "./components/AdminSidebar";
import { AdminTopBar } from "./components/AdminTopBar";
import { HomeRoute } from "./routes/HomeRoute";

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
