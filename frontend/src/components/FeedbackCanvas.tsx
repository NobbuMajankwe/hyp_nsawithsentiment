import { useState } from "react";
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TablePagination,
} from "@mui/material";
import {
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import type { AnalysisResult } from "../types";

interface Props {
  results: AnalysisResult[];
}

export function FeedbackCanvas({ results }: Props) {
  /* if (results.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 7,
          borderRadius: 5,
          bgcolor: "#050816",
          color: "#e5e7eb",
          textAlign: "center",
          border: "1px solid rgba(34,211,238,0.25)",
          boxShadow: "0 0 40px rgba(34,211,238,0.08)",
        }}
      >
        <Terminal size={34} color="#22d3ee" />
        <Typography sx={{ mt: 2, color: "#94a3b8" }}>
          Paste feedback and run the NSA scan to inspect records.
        </Typography>
      </Paper>
    );
  } */
 
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (results.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6,
          borderRadius: 4,
          bgcolor: "#050816",
          color: "#e5e7eb",
          border: "1px solid rgba(34,211,238,0.25)",
          boxShadow: "0 0 40px rgba(34,211,238,0.08)",
          textAlign: "center",
          fontFamily: "monospace",
        }}
      >
        <Terminal size={32} color="#22d3ee" />
        <Typography sx={{ mt: 2, color: "#94a3b8" }}>
          $ paste feedback above && run{" "}
          <strong style={{ color: "#22d3ee" }}>./run_nsa_scan</strong>
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        overflow: "hidden",
        borderRadius: 5,
        bgcolor: "#050816",
        color: "#e5e7eb",
        border: "1px solid rgba(34,211,238,0.25)",
        boxShadow: "0 0 45px rgba(34,211,238,0.08)",
      }}
    >
      <Box
        sx={{
          p: 3,
          borderBottom: "1px solid rgba(148,163,184,0.18)",
          background:
            "linear-gradient(135deg, rgba(34,211,238,0.12), rgba(99,102,241,0.08), transparent)",
        }}
      >
        <Typography
          variant="overline"
          sx={{
            color: "#22d3ee",
            fontWeight: 900,
            letterSpacing: 1.5,
            fontFamily: "monospace",
          }}
        >
          ~/eventsense-ai/nsa-output
        </Typography>

        <Typography
          variant="h5"
          sx={{
            fontWeight: 900,
            mt: 0.5,
            color: "#f8fafc",
          }}
        >
          Feedback Inspection Results
        </Typography>

        <Typography sx={{ color: "#94a3b8", mt: 1 }}>
          Compact NSA table. Click a record to expand full details.
        </Typography>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#020617" }}>
              {["", "Record", "Feedback", "Status", "Score"].map((header) => (
                <TableCell
                  key={header}
                  sx={{
                    color: "#94a3b8",
                    fontWeight: 900,
                    borderBottom: "1px solid rgba(148,163,184,0.18)",
                    fontFamily: "monospace",
                  }}
                >
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {results
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((item) => (
                <ExpandableRecordRow key={item.id} item={item} />
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={results.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25, 50]}
        sx={{
          bgcolor: "#020617",
          color: "#cbd5e1",
          borderTop: "1px solid rgba(148,163,184,0.18)",

          "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
            {
              color: "#94a3b8",
              fontFamily: "monospace",
            },

          "& .MuiSelect-select": {
            color: "#22d3ee",
            fontFamily: "monospace",
          },

          "& .MuiSvgIcon-root": {
            color: "#22d3ee",
          },

          "& .MuiIconButton-root": {
            color: "#22d3ee",
          },

          "& .Mui-disabled": {
            color: "#475569",
          },
        }}
      />
    </Paper>
  );
}

function ExpandableRecordRow({ item }: { item: AnalysisResult }) {
  const [open, setOpen] = useState(false);
  const suspicious = item.nsaStatus === "Suspicious";

  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen((value) => !value)}
        sx={{
          cursor: "pointer",
          bgcolor: suspicious ? "rgba(127,29,29,0.25)" : "rgba(6,78,59,0.14)",
          "&:hover": {
            bgcolor: suspicious ? "rgba(127,29,29,0.38)" : "rgba(6,78,59,0.24)",
          },
        }}
      >
        <TableCell
          sx={{
            width: 48,
            borderBottom: "1px solid rgba(148,163,184,0.12)",
          }}
        >
          <IconButton size="small" sx={{ color: "#cbd5e1" }}>
            {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </IconButton>
        </TableCell>

        <TableCell sx={{ borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
          <Typography sx={{ color: "#f8fafc", fontWeight: 900 }}>
            #{item.id}
          </Typography>
        </TableCell>

        <TableCell
          sx={{
            maxWidth: 420,
            borderBottom: "1px solid rgba(148,163,184,0.12)",
          }}
        >
          <Typography
            noWrap
            sx={{
              color: "#cbd5e1",
              fontSize: "0.88rem",
            }}
          >
            {item.originalText}
          </Typography>
        </TableCell>

        <TableCell sx={{ borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
          <Chip
            icon={
              suspicious ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />
            }
            label={item.nsaStatus}
            size="small"
            sx={{
              fontWeight: 900,
              fontFamily: "monospace",
              bgcolor: suspicious
                ? "rgba(239,68,68,0.15)"
                : "rgba(34,211,238,0.12)",
              color: suspicious ? "#fca5a5" : "#67e8f9",
              border: "1px solid",
              borderColor: suspicious
                ? "rgba(248,113,113,0.35)"
                : "rgba(34,211,238,0.35)",
            }}
          />
        </TableCell>

        <TableCell
          sx={{
            minWidth: 160,
            borderBottom: "1px solid rgba(148,163,184,0.12)",
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Typography sx={{ color: "#f8fafc", fontWeight: 900 }}>
              {item.anomalyScore}%
            </Typography>

            <LinearProgress
              variant="determinate"
              value={item.anomalyScore}
              sx={{
                flex: 1,
                height: 7,
                borderRadius: 99,
                bgcolor: "rgba(148,163,184,0.18)",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 99,
                  bgcolor: suspicious ? "#f87171" : "#22d3ee",
                },
              }}
            />
          </Stack>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell
          colSpan={5}
          sx={{
            p: 0,
            borderBottom: open ? "1px solid rgba(148,163,184,0.14)" : "none",
            bgcolor: "#020617",
          }}
        >
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 3 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: 2,
                }}
              >
                <DetailBlock title="Raw feedback" value={item.originalText} />

                <DetailBlock
                  title="Cleaned output"
                  value={item.cleanedText || "NULL"}
                  mono
                />

                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: "#050816",
                    border: "1px solid rgba(148,163,184,0.16)",
                  }}
                >
                  <Typography
                    sx={{
                      color: "#22d3ee",
                      fontWeight: 900,
                      mb: 1,
                      fontSize: "0.78rem",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Tokens
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={0.7}
                    sx={{ flexWrap: "wrap" }}
                    useFlexGap
                  >
                    {item.tokens.length > 0 ? (
                      item.tokens.map((token) => (
                        <Chip
                          key={token}
                          label={token}
                          size="small"
                          sx={{
                            bgcolor: "rgba(15,23,42,0.95)",
                            color: "#cbd5e1",
                            border: "1px solid rgba(148,163,184,0.22)",
                            fontFamily: "monospace",
                          }}
                        />
                      ))
                    ) : (
                      <Typography variant="caption" sx={{ color: "#64748b" }}>
                        No meaningful tokens
                      </Typography>
                    )}
                  </Stack>
                </Box>

                <DetailBlock title="Reason" value={item.anomalyReason} />
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function DetailBlock({
  title,
  value,
  mono = false,
}: {
  title: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        bgcolor: "#050816",
        border: "1px solid rgba(148,163,184,0.16)",
      }}
    >
      <Typography
        sx={{
          color: "#22d3ee",
          fontWeight: 900,
          mb: 1,
          fontSize: "0.78rem",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {title}
      </Typography>

      <Typography
        sx={{
          color: "#cbd5e1",
          lineHeight: 1.7,
          fontFamily: mono ? "monospace" : "inherit",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
