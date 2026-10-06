import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  Box,
  Container,
} from "@mui/material";
import { LoginPage, RegisterPage, ResetPasswordPage } from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import Dashboard from "./pages/Dashboard";
import DatasetsPage from "./pages/DatasetsPage";
import ExperimentPage from "./pages/ExperimentPage";
import { NsaPage } from "./pages/NsaPage";
import SentimentPage from "./pages/SentimentPage";
import { InsightStoryPage } from "./pages/InsightStoryPage";
import { useAuth } from "./context/AuthContext";
import { Header } from "./components/Header";

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
    <Box sx={{ minHeight: "100vh", bgcolor: "#0b1020", color: "#0b1020", m:-1 }}>
      <Header/>
      <Container maxWidth="lg" sx={{ py: 1 }}>
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
      </Container>
    </Box>
  );
}
