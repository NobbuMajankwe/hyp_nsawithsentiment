import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  //MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutlined,
  CloudDownloadOutlined,
  SaveOutlined,
  SettingsOutlined,
} from "@mui/icons-material";

type ApiSettings = {
  apiUrl: string;
  bearerToken: string;
  dataPath: string;
  idField: string;
  reviewField: string;
  ratingField: string;
  dateField: string;
  reviewerField: string;
};

type PreviewItem = Record<string, unknown>;

const defaultSettings: ApiSettings = {
  apiUrl: "",
  bearerToken: "",
  dataPath: "",
  idField: "id",
  reviewField: "review",
  ratingField: "rating",
  dateField: "createdAt",
  reviewerField: "reviewer",
};

const STORAGE_KEY = "eventsense-api-settings";

function getValueByPath(
  object: unknown,
  path: string
): unknown {
  if (!path.trim()) {
    return object;
  }

  return path.split(".").reduce<unknown>((current, key) => {
    if (
      current &&
      typeof current === "object" &&
      key in current
    ) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, object);
}

function getDisplayValue(
  item: PreviewItem,
  fieldName: string
): string {
  if (!fieldName.trim()) {
    return "-";
  }

  const value = getValueByPath(item, fieldName);

  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export default function SettingsPage() {
  const [settings, setSettings] =
    useState<ApiSettings>(defaultSettings);

  const [previewData, setPreviewData] = useState<
    PreviewItem[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEY);

    if (!savedSettings) {
      return;
    }

    try {
      const parsedSettings = JSON.parse(
        savedSettings
      ) as ApiSettings;

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettings({
        ...defaultSettings,
        ...parsedSettings,
      });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const updateSetting = (
    field: keyof ApiSettings,
    value: string
  ) => {
    setSettings((previous) => ({
      ...previous,
      [field]: value,
    }));

    setConnectionStatus("idle");
    setMessage("");
  };

  const testConnection = async () => {
    if (!settings.apiUrl.trim()) {
      setConnectionStatus("error");
      setMessage("Please enter an API URL.");
      return;
    }

    setLoading(true);
    setConnectionStatus("idle");
    setMessage("");
    setPreviewData([]);

    try {
      const headers: HeadersInit = {
        Accept: "application/json",
      };

      if (settings.bearerToken.trim()) {
        headers.Authorization =
          `Bearer ${settings.bearerToken.trim()}`;
      }

      const response = await fetch(
        settings.apiUrl.trim(),
        {
          method: "GET",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Request failed with status ${response.status}`
        );
      }

      const responseBody: unknown =
        await response.json();

      const extractedData = getValueByPath(
        responseBody,
        settings.dataPath
      );

      if (!Array.isArray(extractedData)) {
        throw new Error(
          settings.dataPath
            ? `The path "${settings.dataPath}" does not contain an array.`
            : "The API response is not an array. Enter the path containing the reviews, for example: data.reviews"
        );
      }

      const validItems = extractedData.filter(
        (item): item is PreviewItem =>
          item !== null && typeof item === "object"
      );

      setPreviewData(validItems.slice(0, 5));
      setConnectionStatus("success");
      setMessage(
        `Connection successful. ${validItems.length} review record(s) found.`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unable to connect to the API.";

      setConnectionStatus("error");
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(settings)
    );

    setMessage("API settings saved successfully.");
    setConnectionStatus("success");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f5f7fb",
        px: { xs: 2, md: 4 },
        py: 4,
      }}
    >
      <Box sx={{ maxWidth: 1000, mx: "auto" }}>
        <Stack
          direction="row"
          spacing={1.5}
          
          sx= {{mb:3, alignItems:"center"}}
        >
          <SettingsOutlined
            sx={{ fontSize: 32, color: "primary.main" }}
          />

          <Box>
            <Typography
              variant="h4"
              sx= {{fontWeight:700}}
            >
              Settings
            </Typography>

            <Typography color="text.secondary">
              Configure the external API used to retrieve
              review data.
            </Typography>
          </Box>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 4 },
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography
            variant="h6"
            sx= {{fontWeight:700}}
            gutterBottom
          >
            Review API
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx= {{mb:3}}
          >
            The API must support a GET request and return
            JSON data.
          </Typography>

          <Stack spacing={2.5}>
            <TextField
              label="API URL"
              placeholder="https://api.example.com/reviews"
              fullWidth
              required
              value={settings.apiUrl}
              onChange={(event) =>
                updateSetting(
                  "apiUrl",
                  event.target.value
                )
              }
              helperText="The GET endpoint that returns the review dataset."
            />

            <TextField
              label="Bearer token"
              placeholder="Optional API access token"
              type="password"
              fullWidth
              value={settings.bearerToken}
              onChange={(event) =>
                updateSetting(
                  "bearerToken",
                  event.target.value
                )
              }
              helperText="Leave blank when the API does not require authentication."
            />

            <TextField
              label="Reviews data path"
              placeholder="data.reviews"
              fullWidth
              value={settings.dataPath}
              onChange={(event) =>
                updateSetting(
                  "dataPath",
                  event.target.value
                )
              }
              helperText='For a response such as { "data": { "reviews": [] } }, enter data.reviews. Leave blank if the response itself is an array.'
            />

            <Divider />

            <Box>
              <Typography
                variant="subtitle1"
                sx= {{fontWeight:700}}
                gutterBottom
              >
                Review field mapping
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{mb:2}}
              >
                Enter the field names used by the API.
              </Typography>

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
                <TextField
                  label="Review ID field"
                  value={settings.idField}
                  onChange={(event) =>
                    updateSetting(
                      "idField",
                      event.target.value
                    )
                  }
                  placeholder="id"
                  fullWidth
                />

                <TextField
                  label="Review text field"
                  value={settings.reviewField}
                  onChange={(event) =>
                    updateSetting(
                      "reviewField",
                      event.target.value
                    )
                  }
                  placeholder="review"
                  required
                  fullWidth
                />

                <TextField
                  label="Rating field"
                  value={settings.ratingField}
                  onChange={(event) =>
                    updateSetting(
                      "ratingField",
                      event.target.value
                    )
                  }
                  placeholder="rating"
                  fullWidth
                />

                <TextField
                  label="Review date field"
                  value={settings.dateField}
                  onChange={(event) =>
                    updateSetting(
                      "dateField",
                      event.target.value
                    )
                  }
                  placeholder="createdAt"
                  fullWidth
                />

                <TextField
                  label="Reviewer field"
                  value={settings.reviewerField}
                  onChange={(event) =>
                    updateSetting(
                      "reviewerField",
                      event.target.value
                    )
                  }
                  placeholder="reviewer"
                  fullWidth
                />
              </Box>
            </Box>

            {message && (
              <Alert
                severity={
                  connectionStatus === "error"
                    ? "error"
                    : "success"
                }
              >
                {message}
              </Alert>
            )}

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
            >
              <Button
                variant="outlined"
                size="large"
                startIcon={
                  loading ? (
                    <CircularProgress size={18} />
                  ) : (
                    <CloudDownloadOutlined />
                  )
                }
                onClick={testConnection}
                disabled={loading}
              >
                {loading
                  ? "Testing..."
                  : "Test connection"}
              </Button>

              <Button
                variant="contained"
                size="large"
                startIcon={<SaveOutlined />}
                onClick={saveSettings}
              >
                Save settings
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {previewData.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              mt: 3,
              p: { xs: 2, md: 3 },
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx= {{mb:2, alignItems:"center"}}
            >
              <CheckCircleOutlined color="success" />

              <Typography
                variant="h6"
                sx={{fontWeight:700}}
              >
                Data preview
              </Typography>
            </Stack>

            <Stack spacing={2}>
              {previewData.map((item, index) => (
                <Paper
                  key={
                    getDisplayValue(
                      item,
                      settings.idField
                    ) || index
                  }
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 2 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    ID:{" "}
                    {getDisplayValue(
                      item,
                      settings.idField
                    )}
                  </Typography>

                  <Typography
                    sx={{
                      mt: 1,
                      mb: 1.5,
                      fontWeight: 500,
                    }}
                  >
                    {getDisplayValue(
                      item,
                      settings.reviewField
                    )}
                  </Typography>

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={{ xs: 0.5, sm: 3 }}
                  >
                    <Typography variant="body2">
                      <strong>Rating:</strong>{" "}
                      {getDisplayValue(
                        item,
                        settings.ratingField
                      )}
                    </Typography>

                    <Typography variant="body2">
                      <strong>Reviewer:</strong>{" "}
                      {getDisplayValue(
                        item,
                        settings.reviewerField
                      )}
                    </Typography>

                    <Typography variant="body2">
                      <strong>Date:</strong>{" "}
                      {getDisplayValue(
                        item,
                        settings.dateField
                      )}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>
        )}
      </Box>
    </Box>
  );
}