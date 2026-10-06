import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import { Terminal, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PageHero } from "../components/PageHero";

// ─── tokens ──────────────────────────────────────────────────────────────────
const BG    = "#050816";
const BG2   = "#020617";
const BORDER = "1px solid rgba(34,211,238,0.2)";
const MONO  = "monospace";

const roleLabels: Record<string, string> = {
  EVENT_ORGANISER: "Event organiser",
  SYSTEM_ADMIN:    "System administrator",
};

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography component="dt" variant="body2" sx={{ color: "#64748b", fontFamily: MONO, mb: 0.25 }}>
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{ m: 0, mt: 0.25, fontWeight: 700, color: "#f8fafc", overflowWrap: "anywhere", fontFamily: MONO }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Stack spacing={3}>
        <PageHero
          icon={<User size={28} color="#22d3ee" />}
          iconColor="#22d3ee"
          badge="$ profile --load"
          title={<>&gt; Your_Profile<span style={{ color: "#22d3ee" }}>.</span></>}
          description="Account details for your NSA research workspace."
          statusLine="STATUS -> account details unavailable. sign in again."
        />
        <Card sx={{ bgcolor: BG, border: BORDER }}>
          <CardContent>
            <Typography sx={{ color: "#94a3b8", fontFamily: MONO, mb: 2 }}>
              Your account details are unavailable. Sign in again to reload them.
            </Typography>
            <Button
              variant="outlined" onClick={logout}
              sx={{ fontFamily: MONO, borderColor: "rgba(34,211,238,0.4)", color: "#22d3ee" }}
            >
              Return to sign in
            </Button>
          </CardContent>
        </Card>
      </Stack>
    );
  }

  const name    = user.fullName?.trim() || "Account";
  const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const role    = roleLabels[user.role] || user.role?.replace(/_/g, " ") || "Not available";

  return (
    <Stack spacing={3} sx={{ maxWidth: 900, mx: "auto" }}>
      <PageHero
        icon={<User size={28} color="#22d3ee" />}
        iconColor="#22d3ee"
        badge="$ profile --view"
        badgeIcon={<Terminal size={11} />}
        title={<>&gt; Your_Profile<span style={{ color: "#22d3ee" }}>.</span></>}
        description="Account details and workspace links for your NSA research environment."
        chips={["view_account()", "manage_datasets()", "run_experiments()"]}
        statusLine={`STATUS -> signed in as ${user.email ?? "unknown"} · role: ${role}`}
      />

      {/* Account card */}
      <Card sx={{ bgcolor: BG, border: BORDER }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={3}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2.5}
              sx={{ alignItems: { xs: "flex-start", sm: "center" } }}
            >
              <Avatar
                aria-hidden="true"
                sx={{
                  width: 76, height: 76, fontSize: 28, fontWeight: 700,
                  bgcolor: "rgba(34,211,238,0.12)", color: "#67e8f9",
                  border: "2px solid rgba(34,211,238,0.35)",
                  fontFamily: MONO,
                }}
              >
                {initials}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: "#f8fafc", overflowWrap: "anywhere" }}>
                  {name}
                </Typography>
                <Chip
                  label={role} size="small" variant="outlined"
                  sx={{
                    mt: 1, fontFamily: MONO, fontWeight: 700,
                    borderColor: "rgba(34,211,238,0.35)", color: "#67e8f9",
                  }}
                />
              </Box>
            </Stack>

            <Divider sx={{ borderColor: "rgba(34,211,238,0.15)" }} />

            <Box
              component="dl"
              sx={{
                m: 0, display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 3,
              }}
            >
              <ProfileField label="full_name"    value={user.fullName || "Not available"} />
              <ProfileField label="email"        value={user.email    || "Not available"} />
              <ProfileField label="account_role" value={role} />
              <ProfileField label="account_id"   value={user.id == null ? "Not available" : String(user.id)} />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Workspace card */}
      <Card sx={{ bgcolor: BG, border: BORDER }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
            <Terminal size={16} color="#22d3ee" />
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#f8fafc" }}>
              Research workspace
            </Typography>
          </Stack>
          <Typography sx={{ color: "#94a3b8", fontFamily: MONO, mb: 2.5, fontSize: "0.9rem" }}>
            Prepare training and evaluation datasets, run NSA experiments, and review their results.
          </Typography>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
            {[
              { label: "Manage datasets", to: "/datasets" },
              { label: "Run experiment",  to: "/nsa"      },
              { label: "Dashboard",       to: "/dashboard" },
              { label: "Insight report",  to: "/insight"  },
            ].map(({ label, to }) => (
              <Button
                key={to} component={Link} to={to} variant="outlined"
                sx={{
                  fontFamily: MONO, fontWeight: 700,
                  borderColor: "rgba(34,211,238,0.35)", color: "#67e8f9",
                  "&:hover": { borderColor: "#22d3ee", bgcolor: "rgba(34,211,238,0.06)" },
                }}
              >
                {label}
              </Button>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Code-style metadata block */}
      <Box sx={{ p: 2.5, bgcolor: BG2, borderRadius: 3, border: "1px solid rgba(148,163,184,0.12)" }}>
        <Typography variant="body2" sx={{ color: "#64748b", fontFamily: MONO }}>
          user_id: <Box component="span" sx={{ color: "#67e8f9" }}>{user.id ?? "N/A"}</Box>{"  "}
          role: <Box component="span" sx={{ color: "#a78bfa" }}>{user.role}</Box>{"  "}
          session: <Box component="span" sx={{ color: "#22c55e" }}>active</Box>
        </Typography>
      </Box>

      <Box>
        <Button
          variant="outlined" color="error" onClick={logout}
          sx={{ fontFamily: MONO, fontWeight: 700 }}
        >
          Sign out
        </Button>
      </Box>
    </Stack>
  );
}
