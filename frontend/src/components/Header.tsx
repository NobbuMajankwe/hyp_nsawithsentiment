import {
  Avatar,
  Box,
  Chip,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  //BarChart2,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  FileText,
  LogOut,
  ShieldCheck,
  User,
} from "lucide-react";
import logo from "../assets/logo.png";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import type { Page } from "../App";

// ── Exported so App.tsx can offset the main content ──────────────────────
export const SIDENAV_WIDTH = 220;
export const SIDENAV_COLLAPSED_WIDTH = 64;
export const HEADER_HEIGHT = 56;

// ── Nav items ──────────────────────────────────────────────────────────────
interface NavItem {
  page: Page;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    page: "nsa",
    icon: <ShieldCheck size={18} />,
    label: "NSA Analysis",
    sublabel: "Anomaly detection",
  },
  {
    page: "sentiment",
    icon: <BrainCircuit size={18} />,
    label: "Sentiment",
    sublabel: "Coming soon",
  },
  {
    page: "insight",
    icon: <FileText size={18} />,
    label: "Insight Story",
    sublabel: "Coming soon",
  },
];

// ── Shared dark background ─────────────────────────────────────────────────
const DARK_BG = "#050816";
const PANEL_BG = "#020617";

const CYAN = "#22d3ee";
const GREEN = "#22c55e";
//const RED = '#f87171';

const BORDER_CLR = "rgba(34,211,238,0.12)";

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  expanded: boolean;
  onToggle: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────
export function Header({ currentPage, onNavigate, expanded, onToggle }: Props) {
  const { user, logout } = useAuth();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const initials =
    user?.fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";
  const roleLabel =
    user?.role === "SYSTEM_ADMIN" ? "System Admin" : "Event Organiser";
  const roleColor = user?.role === "SYSTEM_ADMIN" ? "#7c3aed" : "#0891b2";
  const navWidth = expanded ? SIDENAV_WIDTH : SIDENAV_COLLAPSED_WIDTH;

  return (
    <>
      {/* ── Top AppBar ─────────────────────────────────────────────────── */}
      <Box
        component="header"
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: HEADER_HEIGHT,

          bgcolor: DARK_BG,

          backdropFilter: "blur(18px)",

          borderBottom: "1px solid rgba(34,211,238,.12)",

          backgroundImage: `
linear-gradient(
90deg,
rgba(34,211,238,.04),
transparent
)`,

          zIndex: 1200,

          display: "flex",
          alignItems: "center",

          px: 2,

          gap: 2,

          boxShadow: "0 10px 50px rgba(0,0,0,.45)",
        }}
      >
        {/* Logo + wordmark — sits in the sidenav column */}
        <Box
          onClick={() => onNavigate("nsa")}
          sx={{
            width: navWidth - 16,
            minWidth: navWidth - 16,
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            cursor: "pointer",
            overflow: "hidden",
            transition: "width 0.25s ease, min-width 0.25s ease",
            flexShrink: 0,
          }}
        >
          <Box
            component="img"
            src={logo}
            alt="EventSense AI"
            sx={{
              width: 30,
              height: 30,
              borderRadius: 2,
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
          {expanded && (
            <Typography
              sx={{
                fontWeight: 900,
                color: "#f8fafc",

                fontFamily: "monospace",

                letterSpacing: "-0.5px",
              }}
            >
              {">"} EventSense_AI
            </Typography>
          )}
        </Box>

        {/* Vertical divider between sidenav column and content area */}
        <Box
          sx={{ width: "1px", height: 28, bgcolor: BORDER_CLR, flexShrink: 0 }}
        />

        {/* Collapse toggle */}
        <IconButton
          size="small"
          onClick={onToggle}
          sx={{
            color: "rgba(255,255,255,0.5)",
            "&:hover": { color: "white", bgcolor: "rgba(255,255,255,0.06)" },
          }}
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </IconButton>

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* NSA status badge */}
        <Chip
          icon={<ShieldCheck size={12} />}
          label="$ nsa_engine --active"
          size="small"
          sx={{
            bgcolor: "rgba(34,197,94,.08)",

            color: GREEN,

            border: "1px solid rgba(34,197,94,.22)",

            fontFamily: "monospace",

            "& .MuiChip-icon": {
              color: GREEN,
            },
          }}
        />

        {/* Avatar */}
        <Tooltip title="Account">
          <IconButton
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            sx={{ p: 0.5 }}
          >
            <Avatar
              sx={{
                width: 34,

                height: 34,

                fontWeight: 900,

                fontFamily: "monospace",

                background: "linear-gradient(135deg,#22d3ee,#2563eb)",

                boxShadow: "0 0 22px rgba(34,211,238,.4)",

                border: "1px solid rgba(34,211,238,.35)",
              }}
            >
              {initials}
            </Avatar>
          </IconButton>
        </Tooltip>

        {/* Account dropdown */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          transformOrigin={{ horizontal: "right", vertical: "top" }}
          anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
          slotProps={{
            paper: {
              sx: {
                mt: 1,
                minWidth: 220,
                borderRadius: 3,
                border: "1px solid",
                borderColor: "grey.200",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              },
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }} noWrap>
              {user?.fullName}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: "block" }}
            >
              {user?.email}
            </Typography>
            <Chip
              label={roleLabel}
              size="small"
              sx={{
                mt: 0.75,
                height: 20,
                fontSize: "0.68rem",
                fontWeight: 700,
                bgcolor: `${roleColor}18`,
                color: roleColor,
                border: `1px solid ${roleColor}30`,
              }}
            />
          </Box>
          <Divider />
          <MenuItem
            
            onClick={() => onNavigate("profile")}
            sx={{ gap: 1.5, py: 1.25, color: "text.secondary" }}
          >
            <ListItemIcon sx={{ minWidth: "unset" }}>
              <User size={16} />
            </ListItemIcon>
            Profile
          </MenuItem>
         
          <Divider />
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              logout();
            }}
            sx={{ gap: 1.5, py: 1.25, color: "error.main" }}
          >
            <ListItemIcon sx={{ minWidth: "unset", color: "error.main" }}>
              <LogOut size={16} />
            </ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>
      </Box>

      {/* ── Left SideNav — fixed, starts directly below AppBar ─────────── */}
      <Box
        component="nav"
        sx={{
          position: "fixed",

          top: HEADER_HEIGHT,

          left: 0,

          bottom: 0,

          width: navWidth,

          bgcolor: PANEL_BG,

          borderRight: "1px solid rgba(34,211,238,.12)",

          backgroundImage: `
linear-gradient(
rgba(34,211,238,.015),
transparent
)`,

          display: {
            xs: "none",
            lg: "flex",
          },

          flexDirection: "column",

          overflow: "hidden",

          transition: "width .25s ease",
        }}
      >
        {/* Nav items */}
        <Box
          sx={{
            flex: 1,
            px: 1,
            pt: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = item.page === currentPage;
            const isComingSoon = item.page !== "nsa";
            return (
              <Tooltip
                key={item.page}
                title={!expanded ? item.label : ""}
                placement="right"
                arrow
              >
                <Box
                  onClick={() => onNavigate(item.page)}
                  sx={{
                    position: "relative",

                    display: "flex",

                    alignItems: "center",

                    gap: 1.5,

                    px: expanded ? 1.5 : 0,

                    py: 1.3,

                    borderRadius: 2,

                    minHeight: 48,

                    cursor: "pointer",

                    justifyContent: expanded ? "flex-start" : "center",

                    bgcolor: active ? "rgba(34,211,238,.08)" : "transparent",

                    border: active
                      ? "1px solid rgba(34,211,238,.28)"
                      : "1px solid transparent",

                    "&::before": active
                      ? {
                          content: '""',

                          position: "absolute",

                          left: 0,

                          top: 6,

                          bottom: 6,

                          width: 3,

                          bgcolor: CYAN,

                          borderRadius: 999,

                          boxShadow: "0 0 18px #22d3ee",
                        }
                      : {},

                    "&:hover": {
                      bgcolor: "rgba(255,255,255,.04)",
                    },
                  }}
                >
                  <Box
                    sx={{
                      color: active
                        ? "#a5b4fc"
                        : isComingSoon
                        ? "rgba(255,255,255,0.25)"
                        : "rgba(255,255,255,0.55)",
                      flexShrink: 0,
                      display: "flex",
                    }}
                  >
                    {item.icon}
                  </Box>
                  {expanded && (
                    <Box sx={{ overflow: "hidden" }}>
                      <Typography
                        sx={{
                          color: active ? "#f8fafc" : "#94a3b8",

                          fontFamily: "monospace",

                          fontWeight: active ? 800 : 500,
                        }}
                      >
                        {item.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "rgba(148,163,184,.5)",

                          fontFamily: "monospace",

                          fontSize: ".68rem",
                        }}
                      >
                        {item.sublabel}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        {/* Bottom analytics row */}
        <Box
          sx={{
            p: 2,

            borderTop: "1px solid rgba(34,211,238,.08)",
          }}
        >
          <Typography
            sx={{
              color: CYAN,

              fontSize: ".7rem",

              fontWeight: 900,

              mb: 1,

              fontFamily: "monospace",
            }}
          >
            SYSTEM
          </Typography>

          <Chip
            label="analytics.online"
            size="small"
            sx={{
              bgcolor: "rgba(34,211,238,.08)",

              color: CYAN,

              fontFamily: "monospace",
            }}
          />
        </Box>
      </Box>
    </>
  );
}
