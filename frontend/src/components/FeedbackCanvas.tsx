import { useEffect, useState } from "react";
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
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import {
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from "lucide-react";

import type {
  AnalysisResult,
  SentimentItem,
} from "../types";

type FeedbackResult = AnalysisResult | SentimentItem;

interface Props {
  results: FeedbackResult[];
}

function isAnalysisResult(
  item: FeedbackResult,
): item is AnalysisResult {
  return "nsaStatus" in item && "anomalyScore" in item;
}

function isSentimentItem(
  item: FeedbackResult,
): item is SentimentItem {
  return "label" in item && "confidence" in item;
}

export function FeedbackCanvas({ results }: Props) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    const lastPage = Math.max(
      0,
      Math.ceil(results.length / rowsPerPage) - 1,
    );

    if (page > lastPage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(lastPage);
    }
  }, [results.length, rowsPerPage, page]);

  const handleChangePage = (
    _event: unknown,
    newPage: number,
  ) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRowsPerPage(
      Number.parseInt(event.target.value, 10),
    );
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
          <strong style={{ color: "#22d3ee" }}>
            ./run_analysis
          </strong>
        </Typography>
      </Paper>
    );
  }

  const visibleResults = results.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  const hasNsaResults = results.some(isAnalysisResult);
  const hasSentimentResults = results.some(isSentimentItem);

  const resultTypeLabel =
    hasNsaResults && hasSentimentResults
      ? "NSA and sentiment results"
      : hasNsaResults
        ? "NSA inspection results"
        : "Sentiment analysis results";

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
          borderBottom:
            "1px solid rgba(148,163,184,0.18)",
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
          ~/eventsense-ai/analysis-output
        </Typography>

        <Typography
          variant="h5"
          sx={{
            fontWeight: 900,
            mt: 0.5,
            color: "#f8fafc",
          }}
        >
          Feedback Analysis Results
        </Typography>

        <Typography sx={{ color: "#94a3b8", mt: 1 }}>
          Displaying {resultTypeLabel}. Click a record to
          inspect its full details.
        </Typography>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#020617" }}>
              {[
                "",
                "Record",
                "Feedback",
                "Result",
                "Score",
              ].map((header) => (
                <TableCell
                  key={header}
                  sx={{
                    color: "#94a3b8",
                    fontWeight: 900,
                    borderBottom:
                      "1px solid rgba(148,163,184,0.18)",
                    fontFamily: "monospace",
                  }}
                >
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {visibleResults.map((item, index) => (
              <ExpandableRecordRow
                key={`${isAnalysisResult(item) ? "nsa" : "sentiment"}-${item.id}-${index}`}
                item={item}
              />
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
          borderTop:
            "1px solid rgba(148,163,184,0.18)",

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

function ExpandableRecordRow({
  item,
}: {
  item: FeedbackResult;
}) {
  const [open, setOpen] = useState(false);

  const analysisResult = isAnalysisResult(item);
  const sentimentResult = isSentimentItem(item);

  const suspicious =
    analysisResult &&
    item.nsaStatus.toLowerCase() === "suspicious";

  const score = analysisResult
    ? item.anomalyScore
    : item.confidence;

  const safeScore = Math.min(
    100,
    Math.max(0, Number(score) || 0),
  );

  const displayScore = Number.isInteger(safeScore)
    ? safeScore.toString()
    : safeScore.toFixed(1);

  const resultLabel = analysisResult
    ? item.nsaStatus
    : item.label;

  const rowBackground = analysisResult
    ? suspicious
      ? "rgba(127,29,29,0.25)"
      : "rgba(6,78,59,0.14)"
    : getSentimentRowBackground(item.label);

  const rowHoverBackground = analysisResult
    ? suspicious
      ? "rgba(127,29,29,0.38)"
      : "rgba(6,78,59,0.24)"
    : getSentimentRowBackground(item.label, true);

  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen((value) => !value)}
        sx={{
          cursor: "pointer",
          bgcolor: rowBackground,
          "&:hover": {
            bgcolor: rowHoverBackground,
          },
        }}
      >
        <TableCell
          sx={{
            width: 48,
            borderBottom:
              "1px solid rgba(148,163,184,0.12)",
          }}
        >
          <IconButton
            size="small"
            aria-label={
              open ? "Collapse record" : "Expand record"
            }
            aria-expanded={open}
            sx={{ color: "#cbd5e1" }}
          >
            {open ? (
              <ChevronDown size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
          </IconButton>
        </TableCell>

        <TableCell
          sx={{
            borderBottom:
              "1px solid rgba(148,163,184,0.12)",
          }}
        >
          <Typography
            sx={{
              color: "#f8fafc",
              fontWeight: 900,
              whiteSpace: "nowrap",
            }}
          >
            #{item.id}
          </Typography>

          <Typography
            variant="caption"
            sx={{
              color: "#64748b",
              fontFamily: "monospace",
            }}
          >
            {analysisResult ? "NSA" : "SENTIMENT"}
          </Typography>
        </TableCell>

        <TableCell
          sx={{
            maxWidth: 420,
            borderBottom:
              "1px solid rgba(148,163,184,0.12)",
          }}
        >
          <Typography
            noWrap
            title={item.originalText}
            sx={{
              color: "#cbd5e1",
              fontSize: "0.88rem",
            }}
          >
            {item.originalText || "No feedback text"}
          </Typography>
        </TableCell>

        <TableCell
          sx={{
            borderBottom:
              "1px solid rgba(148,163,184,0.12)",
          }}
        >
          <ResultChip item={item} />
        </TableCell>

        <TableCell
          sx={{
            minWidth: 170,
            borderBottom:
              "1px solid rgba(148,163,184,0.12)",
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center" }}
          >
            <Typography
              sx={{
                minWidth: 54,
                color: "#f8fafc",
                fontWeight: 900,
              }}
            >
              {displayScore}%
            </Typography>

            <LinearProgress
              variant="determinate"
              value={safeScore}
              aria-label={`${resultLabel} score`}
              sx={{
                flex: 1,
                height: 7,
                borderRadius: 99,
                bgcolor: "rgba(148,163,184,0.18)",

                "& .MuiLinearProgress-bar": {
                  borderRadius: 99,
                  bgcolor: analysisResult
                    ? suspicious
                      ? "#f87171"
                      : "#22d3ee"
                    : getSentimentProgressColour(
                        item.label,
                      ),
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
            borderBottom: open
              ? "1px solid rgba(148,163,184,0.14)"
              : "none",
            bgcolor: "#020617",
          }}
        >
          <Collapse
            in={open}
            timeout="auto"
            unmountOnExit
          >
            <Box sx={{ p: 3 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "1fr 1fr",
                  },
                  gap: 2,
                }}
              >
                {analysisResult && (
                  <AnalysisResultDetails item={item} />
                )}

                {sentimentResult && (
                  <SentimentResultDetails item={item} />
                )}
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function ResultChip({
  item,
}: {
  item: FeedbackResult;
}) {
  if (isAnalysisResult(item)) {
    const suspicious =
      item.nsaStatus.toLowerCase() === "suspicious";

    return (
      <Chip
        icon={
          suspicious ? (
            <ShieldAlert size={14} />
          ) : (
            <ShieldCheck size={14} />
          )
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

          "& .MuiChip-icon": {
            color: "inherit",
          },
        }}
      />
    );
  }

  const sentimentStyle = getSentimentChipStyle(
    item.label,
  );

  return (
    <Chip
      icon={<BrainCircuit size={14} />}
      label={item.label}
      size="small"
      sx={{
        fontWeight: 900,
        fontFamily: "monospace",
        bgcolor: sentimentStyle.background,
        color: sentimentStyle.color,
        border: "1px solid",
        borderColor: sentimentStyle.border,

        "& .MuiChip-icon": {
          color: "inherit",
        },
      }}
    />
  );
}

function AnalysisResultDetails({
  item,
}: {
  item: AnalysisResult;
}) {
  return (
    <>
      <DetailBlock
        title="Raw feedback"
        value={item.originalText || "No feedback text"}
      />

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
        <DetailTitle>Tokens</DetailTitle>

        <Stack
          direction="row"
          spacing={0.7}
          sx={{ flexWrap: "wrap" }}
          useFlexGap
        >
          {item.tokens?.length > 0 ? (
            item.tokens.map((token, index) => (
              <Chip
                key={`${token}-${index}`}
                label={token}
                size="small"
                sx={{
                  bgcolor: "rgba(15,23,42,0.95)",
                  color: "#cbd5e1",
                  border:
                    "1px solid rgba(148,163,184,0.22)",
                  fontFamily: "monospace",
                }}
              />
            ))
          ) : (
            <Typography
              variant="caption"
              sx={{ color: "#64748b" }}
            >
              No meaningful tokens
            </Typography>
          )}
        </Stack>
      </Box>

      <DetailBlock
        title="Anomaly reason"
        value={
          item.anomalyReason ||
          "No anomaly reason provided"
        }
      />

      <DetailBlock
        title="NSA status"
        value={item.nsaStatus}
        mono
      />

      <DetailBlock
        title="Anomaly score"
        value={`${item.anomalyScore}%`}
        mono
      />
    </>
  );
}

function SentimentResultDetails({
  item,
}: {
  item: SentimentItem;
}) {
  return (
    <>
      <DetailBlock
        title="Raw feedback"
        value={item.originalText || "No feedback text"}
      />

      <DetailBlock
        title="Sentiment label"
        value={item.label}
        mono
      />

      <DetailBlock
        title="Confidence"
        value={`${item.confidence.toFixed(2)}%`}
        mono
      />

      <DetailBlock
        title="Model"
        value={item.model || "Unknown model"}
        mono
      />
    </>
  );
}

function DetailTitle({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
      {children}
    </Typography>
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
      <DetailTitle>{title}</DetailTitle>

      <Typography
        sx={{
          color: "#cbd5e1",
          lineHeight: 1.7,
          fontFamily: mono ? "monospace" : "inherit",
          overflowWrap: "anywhere",
          whiteSpace: "pre-wrap",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function getSentimentChipStyle(label: string) {
  const normalisedLabel = label.toLowerCase();

  if (normalisedLabel === "positive") {
    return {
      background: "rgba(34,197,94,0.14)",
      color: "#86efac",
      border: "rgba(74,222,128,0.35)",
    };
  }

  if (normalisedLabel === "negative") {
    return {
      background: "rgba(239,68,68,0.15)",
      color: "#fca5a5",
      border: "rgba(248,113,113,0.35)",
    };
  }

  return {
    background: "rgba(99,102,241,0.15)",
    color: "#c4b5fd",
    border: "rgba(139,92,246,0.35)",
  };
}

function getSentimentProgressColour(label: string) {
  const normalisedLabel = label.toLowerCase();

  if (normalisedLabel === "positive") {
    return "#4ade80";
  }

  if (normalisedLabel === "negative") {
    return "#f87171";
  }

  return "#a78bfa";
}

function getSentimentRowBackground(
  label: string,
  hover = false,
) {
  const normalisedLabel = label.toLowerCase();

  if (normalisedLabel === "positive") {
    return hover
      ? "rgba(20,83,45,0.32)"
      : "rgba(20,83,45,0.20)";
  }

  if (normalisedLabel === "negative") {
    return hover
      ? "rgba(127,29,29,0.38)"
      : "rgba(127,29,29,0.25)";
  }

  return hover
    ? "rgba(76,29,149,0.28)"
    : "rgba(76,29,149,0.16)";
}