import { useQuery } from '@tanstack/react-query';
import { useParams, Link as RouterLink } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SchoolIcon from '@mui/icons-material/School';
import VerifiedIcon from '@mui/icons-material/Verified';
import GppBadIcon from '@mui/icons-material/GppBad';
import { useTranslation } from 'react-i18next';
import { verifyCertificate } from './api';
import { CertificateCard } from './components/CertificateCard';

/**
 * Public, unauthenticated certificate verification. Rendered OUTSIDE the app
 * shell so anyone with the link can confirm a certificate's authenticity.
 */
export function VerifyCertificatePage() {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  const { data, isPending } = useQuery({
    queryKey: ['verify', code],
    queryFn: () => verifyCertificate(code),
    enabled: code.length > 0,
    retry: false,
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 6 }}>
      <Container maxWidth="md">
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 4 }}>
          <SchoolIcon color="primary" />
          <Typography variant="h6" color="primary" sx={{ fontWeight: 700, flexGrow: 1 }}>
            {t('app.name')}
          </Typography>
          <Button component={RouterLink} to="/" size="small">
            {t('certificate.goToApp')}
          </Button>
        </Stack>

        {isPending ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : data?.valid ? (
          <Stack spacing={3}>
            <Alert severity="success" icon={<VerifiedIcon />}>
              {t('certificate.verifyValid')}
            </Alert>
            <CertificateCard
              holderName={data.holderName ?? ''}
              scope={data.scope ?? 'MODULE'}
              scopeTitle={data.scopeTitle ?? ''}
              serial={data.serial ?? ''}
              issuedAt={data.issuedAt ?? new Date().toISOString()}
            />
          </Stack>
        ) : (
          <Alert severity="error" icon={<GppBadIcon />} data-testid="verify-invalid">
            <Typography sx={{ fontWeight: 600 }}>{t('certificate.verifyInvalidTitle')}</Typography>
            {t('certificate.verifyInvalidBody')}
          </Alert>
        )}
      </Container>
    </Box>
  );
}
