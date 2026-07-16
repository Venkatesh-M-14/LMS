import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import { useTranslation } from 'react-i18next';
import type { CertificateSummary } from '@academy/shared';
import { useAppSelector } from '../../app/hooks';
import { fetchCertificates, gamificationKeys } from './api';
import { CertificateCard } from './components/CertificateCard';

export function CertificatesPage() {
  const { t, i18n } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const [preview, setPreview] = useState<CertificateSummary | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: gamificationKeys.certificates,
    queryFn: fetchCertificates,
  });

  if (isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !data) {
    return <Alert severity="error">{t('curriculum.loadError')}</Alert>;
  }

  const verifyUrl = (code: string) => `${window.location.origin}/verify/${code}`;

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <WorkspacePremiumIcon color="secondary" />
        <Box>
          <Typography variant="h1">{t('certificate.title')}</Typography>
          <Typography color="text.secondary">{t('certificate.subtitle')}</Typography>
        </Box>
      </Stack>

      {data.length === 0 ? (
        <Alert severity="info">{t('certificate.empty')}</Alert>
      ) : (
        <Stack spacing={2}>
          {data.map((certificate) => (
            <Card key={certificate.id} variant="outlined">
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                >
                  <Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="h6">{certificate.scopeTitle}</Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`certificate.scope.${certificate.scope}`)}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {t('certificate.serial')}: {certificate.serial} · {t('certificate.issued')}:{' '}
                      {new Date(certificate.issuedAt).toLocaleDateString(i18n.resolvedLanguage)}
                    </Typography>
                    <Box>
                      <Link
                        href={verifyUrl(certificate.verificationCode)}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="caption"
                      >
                        {t('certificate.verifyLink')}
                      </Link>
                    </Box>
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={() => setPreview(certificate)}
                  >
                    {t('certificate.view')}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={preview !== null} onClose={() => setPreview(null)} maxWidth="md" fullWidth>
        <DialogContent>
          {preview ? (
            <>
              <Box className="certificate-print-area">
                <CertificateCard
                  holderName={user?.displayName ?? ''}
                  scope={preview.scope}
                  scopeTitle={preview.scopeTitle}
                  serial={preview.serial}
                  issuedAt={preview.issuedAt}
                  verificationUrl={verifyUrl(preview.verificationCode)}
                />
              </Box>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 2 }}>
                <Button onClick={() => setPreview(null)}>{t('common.cancel')}</Button>
                <Button
                  variant="contained"
                  startIcon={<PrintIcon />}
                  onClick={() => window.print()}
                >
                  {t('certificate.print')}
                </Button>
              </Stack>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
