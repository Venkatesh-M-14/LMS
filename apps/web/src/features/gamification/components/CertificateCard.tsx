import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SchoolIcon from '@mui/icons-material/School';
import { useTranslation } from 'react-i18next';

interface CertificateCardProps {
  holderName: string;
  scope: 'MODULE' | 'PATH';
  scopeTitle: string;
  serial: string;
  issuedAt: string;
  verificationUrl?: string;
}

/** The visual certificate — used both in-app and (from the print page) on paper. */
export function CertificateCard({
  holderName,
  scope,
  scopeTitle,
  serial,
  issuedAt,
  verificationUrl,
}: CertificateCardProps) {
  const { t, i18n } = useTranslation();

  return (
    <Box
      sx={{
        border: '3px double',
        borderColor: 'primary.main',
        borderRadius: 2,
        p: { xs: 3, sm: 6 },
        textAlign: 'center',
        bgcolor: 'background.paper',
        maxWidth: 720,
        mx: 'auto',
      }}
    >
      <Stack spacing={1} sx={{ alignItems: 'center' }}>
        <SchoolIcon color="primary" sx={{ fontSize: 48 }} />
        <Typography variant="overline" color="text.secondary" letterSpacing={2}>
          {t('app.name')}
        </Typography>
        <Typography variant="h5" component="p" color="text.secondary">
          {t('certificate.heading')}
        </Typography>
        <Typography variant="h3" component="p" sx={{ fontWeight: 700, my: 1 }}>
          {holderName}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {scope === 'PATH' ? t('certificate.completedPath') : t('certificate.completedModule')}
        </Typography>
        <Typography variant="h5" component="p" color="primary" sx={{ fontWeight: 600 }}>
          {scopeTitle}
        </Typography>
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', mt: 5, pt: 2, borderTop: 1, borderColor: 'divider' }}
      >
        <Box sx={{ textAlign: 'left' }}>
          <Typography variant="caption" color="text.secondary" display="block">
            {t('certificate.issued')}
          </Typography>
          <Typography variant="body2">
            {new Date(issuedAt).toLocaleDateString(i18n.resolvedLanguage, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary" display="block">
            {t('certificate.serial')}
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
            {serial}
          </Typography>
        </Box>
      </Stack>

      {verificationUrl ? (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          {t('certificate.verifyAt')} {verificationUrl}
        </Typography>
      ) : null}
    </Box>
  );
}
