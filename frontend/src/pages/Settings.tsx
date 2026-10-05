import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  Paper,
  Slider,
  Snackbar,
  Alert,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import * as React from "react";
import Tab from "@mui/material/Tab";
import TabContext from "@mui/lab/TabContext";
import TabList from "@mui/lab/TabList";
import TabPanel from "@mui/lab/TabPanel";
import { Mail, User, Shield, LogOut, Terminal, Cpu, Link } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { fetchNsaConfig, saveNsaConfig, type NsaConfig } from "../services/api";

// NSA defaults (mirrors backend)
const NSA_DEFAULTS: NsaConfig = {
  detectorCount: 200,
  detectorRadius: 0.40,
  selfMatchThreshold: 0.75,
  apiUrl: null,
};

export default function Settings() {
  const { user, token, logout } = useAuth();
  const [value, setValue] = useState("1");

  // ── NSA config state ──────────────────────────────────────────────────────
  const [nsaConfig, setNsaConfig] = useState<NsaConfig>(NSA_DEFAULTS);
  const [nsaLoading, setNsaLoading] = useState(false);
  const [nsaSaving, setNsaSaving] = useState(false);
  const [nsaSnack, setNsaSnack] = useState<{ open: boolean; msg: string; sev: "success" | "error" }>({
    open: false,
    msg: "",
    sev: "success",
  });

  useEffect(() => {
    if (value === "2" && token) {
      //setNsaLoading(true);
      fetchNsaConfig(token)
        .then((cfg) => setNsaConfig(cfg))
        .catch(() => {/* use defaults */})
        .finally(() => setNsaLoading(false));
    }
  }, [value, token]);

  async function handleNsaSave() {
    if (!token) return;
    setNsaSaving(true);
    try {
      const saved = await saveNsaConfig(token, nsaConfig);
      setNsaConfig(saved);
      setNsaSnack({ open: true, msg: "NSA configuration saved.", sev: "success" });
    } catch {
      setNsaSnack({ open: true, msg: "Failed to save configuration.", sev: "error" });
    } finally {
      setNsaSaving(false);
    }
  }

  function handleNsaReset() {
    setNsaConfig(NSA_DEFAULTS);
  }

  const handleChange = (_event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
  };

  if (!user) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          bgcolor: "#050816",
          color: "#94a3b8",
          fontFamily: "monospace",
        }}
      >
        <Typography>No profile available</Typography>
      </Box>
    );
  }

  const initials = user.fullName
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        maxHeight: "90%",
        p: { xs: 2.5, md: 2 },
        bgcolor: "#050816",
        backgroundImage: `
          radial-gradient(circle at top right, rgba(34,211,238,0.12), transparent 30%),
          radial-gradient(circle at bottom left, rgba(139,92,246,0.1), transparent 35%)
        `,
        display: "grid",
        placeItems: "center",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: "80%",
          p: { xs: 3, md: 5 },
          borderRadius: 4,
          bgcolor: "#020617",
          color: "#e5e7eb",
          border: "1px solid rgba(34,211,238,0.22)",
          boxShadow: "0 0 45px rgba(34,211,238,0.08)",
          fontFamily: "monospace",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 0.12,
            backgroundImage:
              "linear-gradient(rgba(34,211,238,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.14) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            pointerEvents: "none",
          }}
        />

        <Stack spacing={4} sx={{ position: "relative", zIndex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Terminal size={16} color="#22d3ee" />
            <Typography
              variant="caption"
              sx={{
                color: "#22d3ee",
                textTransform: "uppercase",
                letterSpacing: 1,
                fontWeight: 900,
                fontFamily: "monospace",
              }}
            >
              ~/eventsense-ai/session/profile
            </Typography>
          </Stack>

          <Box sx={{ width: "100%", typography: "body1" }}>
            <TabContext value={value}>
              <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <TabList
                  onChange={handleChange}
                  aria-label="settings tabs"
                  sx={{color: 'white'}}
                >
                  <Tab label="Profile" sx={{color: 'white'}} value="1" />
                  <Tab label="NSA Engine" sx={{color: 'white'}} value="2" />
                </TabList>
              </Box>
              <TabPanel value="1">
                <Box sx={{ mt: 4, spacing: 3, display: "flex", flexDirection: "column" }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={3}
                    sx={{ alignItems: "center" }}
                  >
                    <Avatar
                      sx={{
                        width: 92,
                        height: 92,
                        bgcolor: "#050816",
                        color: "#67e8f9",
                        fontSize: 34,
                        fontWeight: 900,
                        fontFamily: "monospace",
                        border: "1px solid rgba(34,211,238,0.45)",
                        boxShadow: "0 0 28px rgba(34,211,238,0.25)",
                      }}
                    >
                      {initials}
                    </Avatar>

                    <Box sx={{ textAlign: { xs: "center", sm: "left" } }}>
                      <Chip
                        label="$ authenticated_user"
                        size="small"
                        sx={{
                          mb: 1,
                          bgcolor: "rgba(34,211,238,0.1)",
                          color: "#67e8f9",
                          border: "1px solid rgba(34,211,238,0.3)",
                          fontWeight: 800,
                          fontFamily: "monospace",
                        }}
                      />

                      <Typography
                        sx={{
                          fontWeight: 900,
                          fontSize: { xs: 30, md: 38 },
                          color: "#f8fafc",
                          fontFamily: "monospace",
                          lineHeight: 1,
                        }}
                      >
                        {user.fullName}
                      </Typography>

                      <Typography
                        sx={{
                          mt: 1,
                          color: "#94a3b8",
                          fontFamily: "monospace",
                        }}
                      >
                        role: {user.role.replace("_", " ")}
                      </Typography>
                    </Box>
                  </Stack>

                  <Divider sx={{ borderColor: "rgba(148,163,184,0.16)" }} />

                  <Stack spacing={2}>
                    <ProfileRow
                      icon={<Mail size={18} />}
                      label="email"
                      value={user.email}
                    />
                    <ProfileRow
                      icon={<Shield size={18} />}
                      label="role"
                      value={user.role.replace("_", " ")}
                    />
                    <ProfileRow
                      icon={<User size={18} />}
                      label="user_id"
                      value={String(user.id)}
                    />
                  </Stack>

                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      bgcolor: "#050816",
                      borderRadius: 3,
                      border: "1px solid rgba(34,211,238,0.16)",
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 900,
                        mb: 1,
                        color: "#f8fafc",
                        fontFamily: "monospace",
                      }}
                    >
                      &gt; eventsense_account.permissions
                    </Typography>

                    <Typography
                      sx={{
                        color: "#94a3b8",
                        lineHeight: 1.8,
                        fontFamily: "monospace",
                      }}
                    >
                      This account manages datasets, NSA anomaly scans,
                      sentiment reports, insight generation, and system
                      configuration.
                    </Typography>
                  </Paper>

                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    startIcon={<LogOut size={18} />}
                    onClick={logout}
                    sx={{
                      py: 1.6,
                      borderRadius: 2,
                      bgcolor: "rgba(248,113,113,0.14)",
                      color: "#fca5a5",
                      border: "1px solid rgba(248,113,113,0.35)",
                      fontWeight: 900,
                      fontFamily: "monospace",
                      boxShadow: "none",
                      "&:hover": {
                        bgcolor: "rgba(248,113,113,0.22)",
                        boxShadow: "0 0 24px rgba(248,113,113,0.18)",
                      },
                    }}
                  >
                    logout --session
                  </Button>
                </Box>
              </TabPanel>
              <TabPanel value="2">
                {nsaLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                    <CircularProgress size={28} sx={{ color: "#22d3ee" }} />
                  </Box>
                ) : (
                  <Stack spacing={3} sx={{ mt: 2 }}>
                    {/* Header */}
                    <Stack direction="row" spacing={1.5} sx={{alignItems:"center"}}>
                      <Cpu size={18} color="#22d3ee" />
                      <Typography sx={{ fontFamily: "monospace", fontWeight: 900, color: "#f8fafc" }}>
                        nsa_engine.configure()
                      </Typography>
                    </Stack>

                    <Typography sx={{ fontFamily: "monospace", color: "#64748b", fontSize: 13 }}>
                      These parameters control detector generation and anomaly detection sensitivity.
                      Changes take effect on the next analysis run.
                    </Typography>

                    {/* Detector Count */}
                    <Paper elevation={0} sx={{ p: 3, bgcolor: "#050816", borderRadius: 3, border: "1px solid rgba(34,211,238,0.16)" }}>
                      <Stack direction="row"  sx={{justifyContent:"space-between", alignItems:"center", mb: 1}} >
                        <Typography sx={{ fontFamily: "monospace", fontWeight: 800, color: "#e5e7eb", fontSize: 14 }}>
                          detector_count
                        </Typography>
                        <Chip
                          label={nsaConfig.detectorCount}
                          size="small"
                          sx={{ bgcolor: "rgba(34,211,238,0.1)", color: "#67e8f9", border: "1px solid rgba(34,211,238,0.3)", fontFamily: "monospace", fontWeight: 800 }}
                        />
                      </Stack>
                      <Typography sx={{ fontFamily: "monospace", color: "#64748b", fontSize: 12, mb: 2 }}>
                        Number of non-self detectors to generate during training. More detectors = broader anomaly coverage but slower training. Range: 10–2000.
                      </Typography>
                      <Slider
                        value={nsaConfig.detectorCount}
                        min={10}
                        max={2000}
                        step={10}
                        onChange={(_, v) => setNsaConfig((c) => ({ ...c, detectorCount: v as number }))}
                        sx={{
                          color: "#22d3ee",
                          "& .MuiSlider-thumb": { border: "2px solid #22d3ee" },
                          "& .MuiSlider-track": { bgcolor: "#22d3ee" },
                          "& .MuiSlider-rail": { bgcolor: "rgba(34,211,238,0.2)" },
                        }}
                      />
                      <Stack direction="row" sx={{justifyContent:"space-between"}}>
                        <Typography sx={{ fontFamily: "monospace", color: "#475569", fontSize: 11 }}>10</Typography>
                        <Typography sx={{ fontFamily: "monospace", color: "#475569", fontSize: 11 }}>2000</Typography>
                      </Stack>
                    </Paper>

                    {/* Detector Radius */}
                    <Paper elevation={0} sx={{ p: 3, bgcolor: "#050816", borderRadius: 3, border: "1px solid rgba(34,211,238,0.16)" }}>
                      <Stack direction="row"  sx={{justifyContent:"space-between", alignItems:"center",  mb: 1}} >
                        <Typography sx={{ fontFamily: "monospace", fontWeight: 800, color: "#e5e7eb", fontSize: 14 }}>
                          detector_radius
                        </Typography>
                        <Chip
                          label={nsaConfig.detectorRadius.toFixed(2)}
                          size="small"
                          sx={{ bgcolor: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)", fontFamily: "monospace", fontWeight: 800 }}
                        />
                      </Stack>
                      <Typography sx={{ fontFamily: "monospace", color: "#64748b", fontSize: 12, mb: 2 }}>
                        Detection radius — how far a feature vector must be from a detector centre to trigger a match. Higher = more aggressive flagging. Range: 0.01–1.0.
                      </Typography>
                      <Slider
                        value={nsaConfig.detectorRadius}
                        min={0.01}
                        max={1.0}
                        step={0.01}
                        onChange={(_, v) => setNsaConfig((c) => ({ ...c, detectorRadius: v as number }))}
                        sx={{
                          color: "#8b5cf6",
                          "& .MuiSlider-thumb": { border: "2px solid #8b5cf6" },
                          "& .MuiSlider-track": { bgcolor: "#8b5cf6" },
                          "& .MuiSlider-rail": { bgcolor: "rgba(139,92,246,0.2)" },
                        }}
                      />
                      <Stack direction="row" sx={{justifyContent:"space-between"}}>
                        <Typography sx={{ fontFamily: "monospace", color: "#475569", fontSize: 11 }}>0.01</Typography>
                        <Typography sx={{ fontFamily: "monospace", color: "#475569", fontSize: 11 }}>1.00</Typography>
                      </Stack>
                    </Paper>

                    {/* Self-Match Threshold */}
                    <Paper elevation={0} sx={{ p: 3, bgcolor: "#050816", borderRadius: 3, border: "1px solid rgba(34,211,238,0.16)" }}>
                      <Stack direction="row"  sx={{ justifyContent:"space-between", alignItems:"center",  mb: 1}} >
                        <Typography sx={{ fontFamily: "monospace", fontWeight: 800, color: "#e5e7eb", fontSize: 14 }}>
                          self_match_threshold
                        </Typography>
                        <Chip
                          label={nsaConfig.selfMatchThreshold.toFixed(2)}
                          size="small"
                          sx={{ bgcolor: "rgba(16,185,129,0.1)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.3)", fontFamily: "monospace", fontWeight: 800 }}
                        />
                      </Stack>
                      <Typography sx={{ fontFamily: "monospace", color: "#64748b", fontSize: 12, mb: 2 }}>
                        Minimum distance a candidate detector must have from all self (normal) vectors to be accepted. Higher = stricter — fewer but more confident detectors. Range: 0.01–1.0.
                      </Typography>
                      <Slider
                        value={nsaConfig.selfMatchThreshold}
                        min={0.01}
                        max={1.0}
                        step={0.01}
                        onChange={(_, v) => setNsaConfig((c) => ({ ...c, selfMatchThreshold: v as number }))}
                        sx={{
                          color: "#10b981",
                          "& .MuiSlider-thumb": { border: "2px solid #10b981" },
                          "& .MuiSlider-track": { bgcolor: "#10b981" },
                          "& .MuiSlider-rail": { bgcolor: "rgba(16,185,129,0.2)" },
                        }}
                      />
                      <Stack direction="row" sx={{justifyContent:"space-between"}}>
                        <Typography sx={{ fontFamily: "monospace", color: "#475569", fontSize: 11 }}>0.01</Typography>
                        <Typography sx={{ fontFamily: "monospace", color: "#475569", fontSize: 11 }}>1.00</Typography>
                      </Stack>
                    </Paper>

                    {/* API URL */}
                    <Paper elevation={0} sx={{ p: 3, bgcolor: "#050816", borderRadius: 3, border: "1px solid rgba(34,211,238,0.16)" }}>
                      <Stack direction="row" spacing={1} sx={{alignItems:"center", mb: 1}} >
                        <Link size={14} color="#22d3ee" />
                        <Typography sx={{ fontFamily: "monospace", fontWeight: 800, color: "#e5e7eb", fontSize: 14 }}>
                          api_url
                        </Typography>
                      </Stack>
                      <Typography sx={{ fontFamily: "monospace", color: "#64748b", fontSize: 12, mb: 2 }}>
                        Optional external endpoint that feeds feedback data directly into the NSA pipeline. Leave blank to use manual input.
                      </Typography>
                      {/* <TextField
                        fullWidth
                        placeholder="https://your-api.example.com/feedback"
                        value={nsaConfig.apiUrl ?? ""}
                        onChange={(e) => setNsaConfig((c) => ({ ...c, apiUrl: e.target.value || null }))}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Link size={14} color="#475569" />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            fontFamily: "monospace",
                            fontSize: 13,
                            color: "#e5e7eb",
                            bgcolor: "#020617",
                            "& fieldset": { borderColor: "rgba(34,211,238,0.2)" },
                            "&:hover fieldset": { borderColor: "rgba(34,211,238,0.4)" },
                            "&.Mui-focused fieldset": { borderColor: "#22d3ee" },
                          },
                          "& .MuiInputBase-input::placeholder": { color: "#475569", opacity: 1 },
                        }}
                      /> */}
                      <TextField
  fullWidth
  placeholder="https://example.com"
  value={nsaConfig.apiUrl ?? ""}
  onChange={(e) => setNsaConfig((c) => ({ ...c, apiUrl: e.target.value || null }))}
  // Change InputProps to slotProps.input
  slotProps={{
    input: {
      startAdornment: (
        <InputAdornment position="start">
          <Link size={14} color="#475569" />
        </InputAdornment>
      ),
    },
  }}
  sx={{
    "& .MuiOutlinedInput-root": {
      fontFamily: "monospace",
      fontSize: 13,
      color: "#e5e7eb",
      bgcolor: "#020617",
      "& fieldset": { borderColor: "rgba(34,211,238,0.2)" },
      "&:hover fieldset": { borderColor: "rgba(34,211,238,0.4)" },
      "&.Mui-focused fieldset": { borderColor: "#22d3ee" },
    },
    "& .MuiInputBase-input::placeholder": { color: "#475569", opacity: 1 },
  }}
/>

                    </Paper>

                    {/* Action buttons */}
                    <Stack direction="row" spacing={2}>
                      <Button
                        variant="contained"
                        onClick={handleNsaSave}
                        disabled={nsaSaving}
                        startIcon={nsaSaving ? <CircularProgress size={14} sx={{ color: "#020617" }} /> : null}
                        sx={{
                          flex: 1,
                          py: 1.4,
                          borderRadius: 2,
                          bgcolor: "#22d3ee",
                          color: "#020617",
                          fontWeight: 900,
                          fontFamily: "monospace",
                          boxShadow: "none",
                          "&:hover": { bgcolor: "#67e8f9", boxShadow: "0 0 20px rgba(34,211,238,0.3)" },
                          "&.Mui-disabled": { bgcolor: "rgba(34,211,238,0.3)", color: "#020617" },
                        }}
                      >
                        {nsaSaving ? "saving..." : "save_config()"}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handleNsaReset}
                        sx={{
                          py: 1.4,
                          borderRadius: 2,
                          borderColor: "rgba(148,163,184,0.3)",
                          color: "#94a3b8",
                          fontWeight: 800,
                          fontFamily: "monospace",
                          "&:hover": { borderColor: "#94a3b8", bgcolor: "rgba(148,163,184,0.06)" },
                        }}
                      >
                        reset_defaults()
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </TabPanel>
            </TabContext>
          </Box>
        </Stack>
      </Paper>

      <Snackbar
        open={nsaSnack.open}
        autoHideDuration={4000}
        onClose={() => setNsaSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={nsaSnack.sev} onClose={() => setNsaSnack((s) => ({ ...s, open: false }))} sx={{ width: "100%" }}>
          {nsaSnack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

interface RowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function ProfileRow({ icon, label, value }: RowProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.2,
        borderRadius: 3,
        bgcolor: "#050816",
        border: "1px solid rgba(148,163,184,0.16)",
        display: "flex",
        gap: 2,
        alignItems: "center",
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: 2.5,
          bgcolor: "rgba(34,211,238,0.08)",
          color: "#22d3ee",
          border: "1px solid rgba(34,211,238,0.2)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            color: "#64748b",
            fontFamily: "monospace",
            fontWeight: 800,
          }}
        >
          {label}
        </Typography>

        <Typography
          sx={{
            fontWeight: 800,
            color: "#e5e7eb",
            fontFamily: "monospace",
            wordBreak: "break-word",
          }}
        >
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}
