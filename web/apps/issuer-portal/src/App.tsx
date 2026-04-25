import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Building2, Home as HomeIcon } from "lucide-react";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell, Card, Icon } from "@hydrax/ui";

const store = configureStore({
  reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
  middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
});

function HomeRoute() {
  return (
    <Card title={<h1 style={{ margin: 0, fontSize: 20 }}>Home</h1>}>
      <p>Issuer Portal scaffold. Real home content lands in a follow-up plan.</p>
    </Card>
  );
}

export function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <BrowserRouter>
          <AppShell
            appName="issuer-portal"
            topbar={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Icon icon={Building2} label="Issuer Portal logo" size={18} />
                Issuer Portal
              </span>
            }
            sidebar={
              <nav>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Icon icon={HomeIcon} label="Home" size={16} />
                  Home
                </span>
              </nav>
            }
          >
            <Routes>
              <Route path="/" element={<HomeRoute />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
}
