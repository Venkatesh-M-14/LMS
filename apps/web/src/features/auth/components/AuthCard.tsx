import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SchoolIcon from '@mui/icons-material/School';
import { useTranslation } from 'react-i18next';

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 }, width: '100%', maxWidth: 440 }}>
        <Stack spacing={1} sx={{ alignItems: 'center', mb: 4, textAlign: 'center' }}>
          <SchoolIcon color="primary" sx={{ fontSize: 40 }} aria-hidden />
          <Typography variant="h6" component="p" color="primary" sx={{ fontWeight: 700 }}>
            {t('app.name')}
          </Typography>
          <Typography variant="h2" component="h1">
            {title}
          </Typography>
          <Typography color="text.secondary">{subtitle}</Typography>
        </Stack>
        {children}
      </Paper>
    </Box>
  );
}
