import { Box, Paper, Stack, Typography } from "@mui/material";
import { CheckCircle2, Clock, Terminal } from "lucide-react";
import type { PipelineStep } from "../data/pipelineSteps";

interface Props {
  subtitle: string;
  steps: PipelineStep[];
  activeColor?: string;
}

export function PipelineTracker({
  subtitle,
  steps,
  activeColor = "#22d3ee",
}: Props) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 3, md: 4 },
        mb: 3,
        borderRadius: 4,
        bgcolor: "#050816",
        color: "#e5e7eb",
        border: "1px solid rgba(34,211,238,0.25)",
        boxShadow: "0 0 40px rgba(34,211,238,0.08)",
        fontFamily: "monospace",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <Terminal size={16} color="#22d3ee" />

        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            color: "#22d3ee",
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          ~/eventsense-ai/pipeline
        </Typography>
      </Stack>

      <Typography
        variant="h5"
        sx={{ fontWeight: 900, mb: 3, color: "#f8fafc" }}
      >
        &gt; {subtitle}
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {steps.map((item, i) => {
          const borderColor = item.active
            ? activeColor
            : item.done
            ? "rgba(34,211,238,0.45)"
            : "rgba(148,163,184,0.18)";

          const bgcolor = item.active
            ? "rgba(34,211,238,0.08)"
            : item.done
            ? "rgba(6,78,59,0.28)"
            : "#020617";

          const labelColor = item.active
            ? activeColor
            : item.done
            ? "#22c55e"
            : "#64748b";

          return (
            <Box key={i} sx={{ flex: 1 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  height: "70%",
                  border: "1px solid",
                  borderColor,
                  bgcolor,
                  transition: "0.2s",
                  boxShadow: item.active
                    ? "0 0 24px rgba(34,211,238,0.18)"
                    : "inset 0 0 18px rgba(15,23,42,0.7)",
                  "&:hover": {
                    transform: "translateY(-3px)",
                    borderColor: item.active
                      ? activeColor
                      : "rgba(34,211,238,0.35)",
                  },
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", mb: 1 }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 900,
                      color: labelColor,
                      fontFamily: "monospace",
                    }}
                  >
                    {item.step}
                  </Typography>

                  {item.done && <CheckCircle2 size={14} color="#22c55e" />}
                  {item.active && <Clock size={14} color={activeColor} />}
                </Stack>

                <Typography
                  sx={{
                    fontWeight: 900,
                    color: "#f8fafc",
                    fontFamily: "monospace",
                    mb: 0.5,
                  }}
                >
                  {item.label}
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    color: "#94a3b8",
                    fontFamily: "monospace",
                    lineHeight: 1.6,
                  }}
                >
                  {item.desc}
                </Typography>
              </Paper>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
