import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Wallet, Home as HomeIcon, Activity } from "lucide-react";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell, Card, Icon } from "@hydrax/ui";
import { HealthRoute } from "./HealthRoute";

const store = configureStore({
  reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
  middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
});

function HomeRoute() {
  return (
    <Card title={<h1 style={{ margin: 0, fontSize: 20 }}>Home</h1>}>
      <p>Investor Portal scaffold. Real home content lands in a follow-up plan.</p>
    </Card>
  );
}

const navLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "var(--hydrax-color-text)",
  textDecoration: "none",
  padding: "6px 0",
};

export function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <BrowserRouter>
          <AppShell
            appName="investor-portal"
            topbar={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Icon icon={Wallet} label="Investor Portal logo" size={18} />
                Investor Portal
              </span>
            }
            sidebar={
              <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Link to="/" style={navLinkStyle}>
                  <Icon icon={HomeIcon} label="Home" size={16} />
                  Home
                </Link>
                <Link to="/health" style={navLinkStyle}>
                  <Icon icon={Activity} label="Platform health" size={16} />
                  Health
                </Link>
              </nav>
            }
          >
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/health" element={<HealthRoute />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
}
