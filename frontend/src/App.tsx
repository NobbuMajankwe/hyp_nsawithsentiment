import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Box } from "@mui/material";
import { LoginPage, RegisterPage, ResetPasswordPage } from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import Dashboard from "./pages/Dashboard";
import DatasetsPage from "./pages/DatasetsPage";
import ExperimentPage from "./pages/ExperimentPage";
import { NsaPage } from "./pages/NsaPage";
import SentimentPage from "./pages/SentimentPage";
import { InsightStoryPage } from "./pages/InsightStoryPage";
import { useAuth } from "./context/AuthContext";
import { Sidebar, /* SIDEBAR_WIDTH */ } from "./components/Sidebar";

function AuthGate() {
  const [view, setView] = useState<"login" | "register" | "reset">("login");
  if (view === "register")
    return <RegisterPage onSwitchToLogin={() => setView("login")} />;
  if (view === "reset")
    return <ResetPasswordPage onBackToLogin={() => setView("login")} />;
  return (
    <LoginPage
      onSwitchToRegister={() => setView("register")}
      onSwitchToReset={() => setView("reset")}
    />
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <AuthGate />;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#050816", m: -4, p: 4 }}>
      {/* Vertical sidebar navigation */}
      <Sidebar />

      {/* Main content area */}
      {/* <Box
        component="main"
        sx={{
          display: "flex", 
          flexGrow: 1,
          minWidth: 0,
          ml: `${SIDEBAR_WIDTH/4}px`,
          minHeight: "100vh",
          bgcolor: "#050816",
          overflowX: "hidden",
          justifyContent:'center',
          justifyItems: 'center',
          alignContent:'center',
          alignItems:'center'
        }}
      > */}
        <Box sx={{ display: "flex",
          minHeight: "100vh", maxWidth: "100%", mx: "auto", px: { xs: 2, md: 4 }, py: 4,
          justifyContent:'center',
          justifyItems: 'center',
          alignContent:'center',
          alignItems:'center' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/datasets" element={<DatasetsPage />} />
            <Route path="/nsa" element={<NsaPage />} />
            <Route path="/sentiment" element={<SentimentPage />} />
            <Route path="/insight" element={<InsightStoryPage />} />
            <Route
              path="/experiments/:experimentId"
              element={<ExperimentPage />}
            />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Box>
      {/* </Box> */}
    </Box>
  );
}
