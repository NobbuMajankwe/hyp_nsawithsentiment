import { Box, Paper, Stack, Typography } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Terminal } from "lucide-react";
import type { AnalysisResult } from "../types";

interface Props {
  results: AnalysisResult[];
}

const VALID_COLOR = "#22d3ee";
const SUSPICIOUS_COLOR = "#f87171";
const SCORE_COLOR = "#67e8f9";
const TOKEN_COLOR = "#a78bfa";
const GRID_COLOR = "rgba(148,163,184,0.16)";
const TEXT_COLOR = "#94a3b8";

export function AnalyticsCharts({ results }: Props) {
  if (results.length === 0) return null;

  const valid = results.filter((r) => r.nsaStatus === "Valid").length;
  const suspicious = results.filter((r) => r.nsaStatus === "Suspicious").length;

  const donutData = [
    { name: "Valid", value: valid, color: VALID_COLOR },
    { name: "Suspicious", value: suspicious, color: SUSPICIOUS_COLOR },
  ];

  const scoreData = results.map((r) => ({
    name: `#${r.id}`,
    score: r.anomalyScore,
    status: r.nsaStatus,
  }));

  const tokenFreq: Record<string, number> = {};
  results.forEach((r) => {
    r.tokens.forEach((t) => {
      tokenFreq[t] = (tokenFreq[t] ?? 0) + 1;
    });
  });

  const tokenData = Object.entries(tokenFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([token, count]) => ({ token, count }));

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 4,
        bgcolor: "#050816",
        color: "#e5e7eb",
        border: "1px solid rgba(34,211,238,0.25)",
        boxShadow: "0 0 40px rgba(34,211,238,0.08)",
        fontFamily: "monospace",
      }}
    >
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Terminal size={16} color="#22d3ee" />
          <Typography
            variant="caption"
            sx={{
              color: "#22d3ee",
              textTransform: "uppercase",
              letterSpacing: 1,
              fontWeight: 800,
            }}
          >
            ~/eventsense-ai/analytics
          </Typography>
        </Stack>

        <Typography variant="h5" sx={{ fontWeight: 900, color: "#f8fafc" }}>
          &gt; render_scan_visuals<span style={{ color: "#22d3ee" }}>()</span>
        </Typography>

        <Typography sx={{ color: "#94a3b8" }}>
          Terminal-style charts generated from NSA analysis output.
        </Typography>
      </Stack>

      <Stack spacing={4}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 3,
          }}
        >
          <ChartCard title="valid_vs_suspicious">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) =>
                    percent !== undefined
                      ? `${name} ${(percent * 100).toFixed(0)}%`
                      : name
                  }
                  labelLine={false}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>

                <Tooltip
                  contentStyle={{
                    backgroundColor: "#020617",
                    border: "1px solid rgba(34,211,238,0.3)",
                    borderRadius: 12,
                    color: "#e5e7eb",
                    fontFamily: "monospace",
                  }}
                  formatter={(v) => [`${v} records`, "count"]}
                />

                <Legend
                  wrapperStyle={{
                    color: TEXT_COLOR,
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="anomaly_score_per_record">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoreData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />

                <XAxis
                  dataKey="name"
                  tick={{
                    fontSize: 11,
                    fill: TEXT_COLOR,
                    fontFamily: "monospace",
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  domain={[0, 100]}
                  tick={{
                    fontSize: 11,
                    fill: TEXT_COLOR,
                    fontFamily: "monospace",
                  }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor: "#020617",
                    border: "1px solid rgba(34,211,238,0.3)",
                    borderRadius: 12,
                    color: "#e5e7eb",
                    fontFamily: "monospace",
                  }}
                  formatter={(v) => [`${v}%`, "anomaly_score"]}
                  cursor={{ fill: "rgba(34,211,238,0.06)" }}
                />

                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {scoreData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.status === "Suspicious"
                          ? SUSPICIOUS_COLOR
                          : SCORE_COLOR
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Box>

        {tokenData.length > 0 && (
          <ChartCard title="top_token_frequency">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tokenData} barSize={22}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={GRID_COLOR}
                  vertical={false}
                />

                <XAxis
                  dataKey="token"
                  tick={{
                    fontSize: 11,
                    fill: TEXT_COLOR,
                    fontFamily: "monospace",
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{
                    fontSize: 11,
                    fill: TEXT_COLOR,
                    fontFamily: "monospace",
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor: "#020617",
                    border: "1px solid rgba(167,139,250,0.35)",
                    borderRadius: 12,
                    color: "#e5e7eb",
                    fontFamily: "monospace",
                  }}
                  formatter={(v) => [
                    `${v} occurrence${Number(v) !== 1 ? "s" : ""}`,
                    "token_count",
                  ]}
                  cursor={{ fill: "rgba(167,139,250,0.06)" }}
                />

                <Bar dataKey="count" fill={TOKEN_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </Stack>
    </Paper>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        border: "1px solid rgba(34,211,238,0.18)",
        bgcolor: "#020617",
        boxShadow: "inset 0 0 24px rgba(15,23,42,0.9)",
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 900,
          mb: 1.5,
          color: "#67e8f9",
          fontSize: "0.8rem",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          fontFamily: "monospace",
        }}
      >
        $ {title}
      </Typography>

      {children}
    </Box>
  );
}
