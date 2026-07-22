import {
  Box,
  Container,
} from "@mui/material";
import {
  Clock,
  FileText,
} from "lucide-react";
import { PipelineTracker } from "../components/PipelineTracker";
import { buildSteps } from "../data/pipelineSteps";
import { PageHero } from "../components/PageHero";

export function InsightStoryPage() {
  return (
    <Box sx={{ py: 4 }}>
      <Container maxWidth={false} sx={{ maxWidth: 1600 }}>
        
<PageHero
        icon={<FileText size={28} color="#fb923c" />}
        iconColor="#fb923c"
        badge="$ insight_story --pending"
        badgeIcon={<Clock size={11} />}
        title={<> &gt; Insight_Story<span style={{ color: "#f97316" }}>.</span></>}
        description="Generate AI-powered narrative reports from NSA anomaly detection
              and sentiment analysis. Convert raw feedback signals into
              executive-ready decisions, risk indicators, and event performance
              insights."
        chips={[
          "generate_summary()", "detect_patterns()", "build_story()"
        ]}
        statusLine="STATUS -> awaiting sentiment engine integration..."
      />
        {/* ── Pipeline context ── */}
        <PipelineTracker
          subtitle="Step 4 of 4 — final output stage"
          steps={buildSteps(3)}
          activeColor="#ea580c"
        />

        
      </Container>
    </Box>
  );
}


