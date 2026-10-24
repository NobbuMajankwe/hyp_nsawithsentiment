import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

// fetchDashboardSummary is not yet implemented in the API layer.
// This slice is intentionally excluded from the store until a
// GET /api/dashboard endpoint is added to the backend.
type DashboardSummary = Record<string, unknown>;

// ── Async thunk ──────────────────────────────────────────────────────────────

export const loadDashboard = createAsyncThunk<DashboardSummary, string>(
  'dashboard/load',
  async (_token, { rejectWithValue }) => {
    return rejectWithValue('Dashboard endpoint not yet implemented.');
  },
);

// ── State ────────────────────────────────────────────────────────────────────

interface DashboardState {
  data: DashboardSummary | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: DashboardState = {
  data: null,
  status: 'idle',
  error: null,
};

// ── Slice ────────────────────────────────────────────────────────────────────

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    resetDashboard(state) {
      state.data = null;
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDashboard.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadDashboard.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(loadDashboard.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as string) ?? 'Unknown error';
      });
  },
});

export const { resetDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;
