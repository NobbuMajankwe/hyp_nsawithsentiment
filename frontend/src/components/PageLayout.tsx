/**
 * PageLayout — consistent page wrapper used on all main content pages.
 * Provides the outer Box with bg colour + py spacing and a max-width Container.
 */

import { Box, Container } from '@mui/material';
import { HEADER_HEIGHT } from './Header';

interface Props {
  children: React.ReactNode;
  /** Override background. Defaults to the shared dark page bg. */
  bgcolor?: string;
}

export function PageLayout({ children, bgcolor = '#030b1a' }: Props) {
  return (
    <Box
      sx={{
        minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
        bgcolor,
        py: 4,
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1600 }}>
        {children}
      </Container>
    </Box>
  );
}
