import {
  Alert,
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
import { useAuth } from "../context/AuthContext";

const roleLabels: Record<string, string> = {
  EVENT_ORGANISER: "Event organiser",
  SYSTEM_ADMIN: "System administrator",
};

export default function ProfilePage() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Stack spacing={2}>
        <Typography variant="h4" sx={{fontWeight:700}}>
          Your profile
        </Typography>
        <Alert severity="warning">
          Your account details are unavailable. Sign in again to reload them.
        </Alert>
        <Button
          variant="outlined"
          onClick={logout}
          sx={{ alignSelf: "flex-start" }}
        >
          Return to sign in
        </Button>
      </Stack>
    );
  }

  const name = user.fullName?.trim() || "Account";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const role =
    roleLabels[user.role] || user.role?.replace(/_/g, " ") || "Not available";

  return (
    <Stack spacing={3} sx={{ maxWidth: 900, mx: "auto" }}>
      <Box>
        <Typography variant="h4" sx={{fontWeight:700}}>
          Your profile
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Account details for your NSA research workspace.
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ borderColor: "rgba(34,211,238,0.25)" }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={3}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2.5}
              sx={{alignItems:{ xs: "flex-start", sm: "center" }}}
            >
              <Avatar
                aria-hidden="true"
                sx={{
                  width: 76,
                  height: 76,
                  fontSize: 28,
                  fontWeight: 700,
                  bgcolor: "rgba(34,211,238,0.14)",
                  color: "#67e8f9",
                }}
              >
                {initials}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h5"
                  
                  sx={{ overflowWrap: "anywhere", fontWeight:700 }}
                >
                  {name}
                </Typography>
                <Chip
                  label={role}
                  size="small"
                  variant="outlined"
                  sx={{ mt: 1 }}
                />
              </Box>
            </Stack>
            <Divider />
            <Box
              component="dl"
              sx={{
                m: 0,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 3,
              }}
            >
              <ProfileField
                label="Full name"
                value={user.fullName || "Not available"}
              />
              <ProfileField
                label="Email address"
                value={user.email || "Not available"}
              />
              <ProfileField label="Account role" value={role} />
              <ProfileField
                label="Account ID"
                value={user.id == null ? "Not available" : String(user.id)}
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Your research workspace
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Prepare training and evaluation datasets, run NSA experiments, and
            review their results.
          </Typography>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{flexWrap:"wrap"}}>
            <Button component={Link} to="/datasets" variant="outlined">
              Manage datasets
            </Button>
            <Button component={Link} to="/nsa" variant="outlined">
              Run experiment
            </Button>
            <Button component={Link} to="/dashboard" variant="outlined">
              Experiment history
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Box>
        <Button variant="outlined" color="error" onClick={logout}>
          Sign out
        </Button>
      </Box>
    </Stack>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{ m: 0, mt: 0.5, fontWeight: 600, overflowWrap: "anywhere" }}
      >
        {value}
      </Typography>
    </Box>
  );
}
