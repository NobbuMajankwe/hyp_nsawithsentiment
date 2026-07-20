import { useState } from "react";
import {
  Box,
} from "@mui/material";

import {
  Header,
  SIDENAV_WIDTH,
  SIDENAV_COLLAPSED_WIDTH,
  HEADER_HEIGHT,
} from "./components/Header";
import { LoginPage, RegisterPage, ResetPasswordPage } from "./pages/LoginPage";
import { SentimentPage } from "./pages/SentimentPage";
import { InsightStoryPage } from "./pages/InsightStoryPage";
import { NsaPage } from "./pages/NsaPage";
import { useAuth } from "./context/AuthContext";
import ProfilePage from "./pages/ProfilePage";
import Dashboard2 from "./pages/Dashboard2";

export type Page =
  | "profile"
  | "nsa"
  | "sentiment"
  | "insight"
  | "settings"
  | "dashboard"
  | "analytics";

// ---------------------------------------------------------------------------
// Root — auth gate
// ---------------------------------------------------------------------------

export default function App() {
  const { isAuthenticated } = useAuth();
  const [authView, setAuthView] = useState<"login" | "reset" | "register">(
    "login",
  );

  if (!isAuthenticated) {
    switch (authView) {
      case "register":
        return <RegisterPage onSwitchToLogin={() => setAuthView("login")} />;

      case "reset":
        return <ResetPasswordPage onBackToLogin={() => setAuthView("login")} />;

      case "login":
      default:
        return (
          <LoginPage
            onSwitchToRegister={() => setAuthView("register")}
            onSwitchToReset={() => setAuthView("reset")}
          />
        );
    }
  }

  return <Box sx={{maxHeight: "90vh", bgcolor: "rgba(99,102,241,0.15)", mr: -1, my: -1 }}>
    <Dashboard />;
  </Box>
}

// ---------------------------------------------------------------------------
// Dashboard — persistent shell with sidenav
// ---------------------------------------------------------------------------

function Dashboard() {
  const [page, setPage] = useState<Page>("dashboard");
  const [expanded, setExpanded] = useState(true);
  const sideWidth = expanded ? SIDENAV_WIDTH : SIDENAV_COLLAPSED_WIDTH;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "rgba(99,102,241,0.35)" }}>
      {/* Fixed header + attached sidenav */}
      <Header
        currentPage={page}
        onNavigate={setPage}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      />

      {/* Content — pushed right by sidenav width and down by header height */}
      <Box
        sx={{
          ml: { xs: 0, lg: `${sideWidth}px` },
          mt: `${HEADER_HEIGHT}px`,
          transition: "margin-left 0.25s ease",
          minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
        }}
      >
        {page === "profile" && <ProfilePage />}
        {page === "dashboard" && <Dashboard2 onNavigate={setPage} />}
        {page === "nsa" && <NsaPage />}
        {page === "sentiment" && <SentimentPage />}
        {page === "insight" && <InsightStoryPage />}
      </Box>
    </Box>
  );
}


