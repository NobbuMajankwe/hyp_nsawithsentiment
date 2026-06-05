import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiLogin, apiRegister } from '../services/api';
import logo from '../assets/logo.png';

interface Props {
  onSwitchToRegister: () => void;
}

export function LoginPage({ onSwitchToRegister }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await apiLogin(email, password);
      login(token, user);
    } catch (err: unknown) {
      const msg =
        axios_detail(err) ?? 'Login failed. Check your credentials and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
        Welcome back
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Sign in to your EventSense AI account
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField
            label="Email address"
            type="email"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <LogIn size={16} />}
            sx={{
              py: 1.4,
              borderRadius: 999,
              background: 'linear-gradient(135deg,#312e81,#6d28d9)',
              '&:hover': { opacity: 0.92 },
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </Stack>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
        No account?{' '}
        <Box
          component="span"
          onClick={onSwitchToRegister}
          sx={{ color: 'primary.main', cursor: 'pointer', fontWeight: 700 }}
        >
          Create one
        </Box>
      </Typography>
    </AuthLayout>
  );
}

// ---------------------------------------------------------------------------
// Register page
// ---------------------------------------------------------------------------

interface RegisterProps {
  onSwitchToLogin: () => void;
}

export function RegisterPage({ onSwitchToLogin }: RegisterProps) {
  const { login } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'event_organiser' as 'event_organiser' | 'system_admin',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await apiRegister({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      login(token, user);
    } catch (err: unknown) {
      const msg = axios_detail(err) ?? 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
        Create account
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Register as an event organiser or system administrator
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField
            label="Full name"
            fullWidth
            required
            value={form.fullName}
            onChange={set('fullName')}
            autoComplete="name"
          />
          <TextField
            label="Email address"
            type="email"
            fullWidth
            required
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
          />

          {/* Role selector rendered as two toggle cards */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1, display: 'block' }}>
              ACCOUNT TYPE
            </Typography>
            <Stack direction="row" spacing={1.5}>
              {(
                [
                  { value: 'event_organiser', label: 'Event Organiser' },
                  { value: 'system_admin', label: 'System Admin' },
                ] as const
              ).map((opt) => (
                <Box
                  key={opt.value}
                  onClick={() => setForm((p) => ({ ...p, role: opt.value }))}
                  sx={{
                    flex: 1,
                    p: 1.5,
                    borderRadius: 3,
                    border: '2px solid',
                    borderColor: form.role === opt.value ? 'primary.main' : 'grey.300',
                    bgcolor: form.role === opt.value ? 'rgba(99,102,241,0.06)' : 'grey.50',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: '0.2s',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      color: form.role === opt.value ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {opt.label}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            value={form.password}
            onChange={set('password')}
            helperText="Min 8 chars, one uppercase, one lowercase, one number"
            autoComplete="new-password"
          />
          <TextField
            label="Confirm password"
            type="password"
            fullWidth
            required
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            autoComplete="new-password"
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{
              py: 1.4,
              borderRadius: 999,
              background: 'linear-gradient(135deg,#312e81,#6d28d9)',
              '&:hover': { opacity: 0.92 },
            }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </Stack>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
        Already have an account?{' '}
        <Box
          component="span"
          onClick={onSwitchToLogin}
          sx={{ color: 'primary.main', cursor: 'pointer', fontWeight: 700 }}
        >
          Sign in
        </Box>
      </Typography>
    </AuthLayout>
  );
}

// ---------------------------------------------------------------------------
// Shared layout wrapper
// ---------------------------------------------------------------------------

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #111827 0%, #312e81 55%, #7c2d12 100%)',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 440 }}>
          <Box
              component="img"
              src={logo}
              alt="EventSense AI"
              sx={{ width: 120, height: 120, borderRadius: 2, objectFit: 'cover', flexShrink: 0, alignSelf: 'center' }}
            />
        {/* Branding */}
        <Stack spacing={0.5} sx={{ mb: 4, textAlign: 'center' }}>
          
          <Typography
            variant="h3"
            sx={{ fontWeight: 800, color: 'white', lineHeight: 1 }}
          >
            EventSense AI
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            Hybrid Feedback Analysis System
          </Typography>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 5,
            bgcolor: 'white',
          }}
        >
          {children}
        </Paper>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Helper — extract FastAPI detail message from axios errors
// ---------------------------------------------------------------------------

function axios_detail(err: unknown): string | null {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response
  ) {
    const data = (err.response as { data: unknown }).data;
    if (data && typeof data === 'object' && 'detail' in data) {
      return String((data as { detail: unknown }).detail);
    }
  }
  return null;
}
