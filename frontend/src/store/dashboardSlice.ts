import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchDashboardSummary, type DashboardSummary } from '../services/api';

// ── Async thunk ──────────────────────────────────────────────────────────────

export const loadDashboard = createAsyncThunk<DashboardSummary, string>(
  'dashboard/load',
  async (token, { rejectWithValue }) => {
    try {
      return await fetchDashboardSummary(token);
    } catch {
      return rejectWithValue('Could not load dashboard data.');
    }
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
