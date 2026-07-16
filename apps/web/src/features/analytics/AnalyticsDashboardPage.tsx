import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import InsightsIcon from '@mui/icons-material/Insights';
import { useTranslation } from 'react-i18next';
import type { AnalyticsDashboardView } from '@academy/shared';
import { analyticsKeys, fetchAnalyticsDashboard } from './api';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card sx={{ flex: 1, minWidth: 140 }}>
      <CardContent>
        <Typography variant="h2" component="p">
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

function Timeseries({ data }: { data: AnalyticsDashboardView['timeseries'] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...data.map((d) => d.lessonsOpened + d.quizzesSubmitted));
  if (data.length === 0) {
    return <Typography color="text.secondary">{t('analytics.noData')}</Typography>;
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 160, overflowX: 'auto' }}>
      {data.map((d) => (
        <Stack key={d.day} sx={{ alignItems: 'center', minWidth: 28, flex: 1 }} spacing={0.5}>
          <Box
            sx={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 130 }}
            title={`${d.day}: ${d.lessonsOpened} lessons, ${d.quizzesSubmitted} quizzes`}
          >
            <Box sx={{ height: `${(d.quizzesSubmitted / max) * 100}%`, bgcolor: 'secondary.main', borderRadius: '3px 3px 0 0' }} />
            <Box sx={{ height: `${(d.lessonsOpened / max) * 100}%`, bgcolor: 'primary.main' }} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
            {d.day.slice(5)}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}

export function AnalyticsDashboardPage() {
  const { t } = useTranslation();
  const [windowDays, setWindowDays] = useState(14);
  const { data, isPending, isError } = useQuery({
    queryKey: analyticsKeys.dashboard(windowDays),
    queryFn: () => fetchAnalyticsDashboard(windowDays),
  });

  if (isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !data) return <Alert severity="error">{t('analytics.loadError')}</Alert>;

  const funnelMax = Math.max(1, ...data.funnel.map((f) => f.count));

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <InsightsIcon color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h1">{t('analytics.title')}</Typography>
          <Typography color="text.secondary">{t('analytics.subtitle')}</Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={windowDays}
          onChange={(_e, v) => v && setWindowDays(v)}
          aria-label={t('analytics.window')}
        >
          <ToggleButton value={7}>{t('analytics.days', { count: 7 })}</ToggleButton>
          <ToggleButton value={14}>{t('analytics.days', { count: 14 })}</ToggleButton>
          <ToggleButton value={30}>{t('analytics.days', { count: 30 })}</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        <StatCard label={t('analytics.activeLearners')} value={data.totals.activeLearners} />
        <StatCard label={t('analytics.lessonsOpened')} value={data.totals.lessonsOpened} />
        <StatCard label={t('analytics.quizzesSubmitted')} value={data.totals.quizzesSubmitted} />
        <StatCard label={t('analytics.passRate')} value={`${data.totals.quizPassRate}%`} />
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h3" component="h2" gutterBottom>
          {t('analytics.activity')}
        </Typography>
        <Timeseries data={data.timeseries} />
        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
          <Legend color="primary.main" label={t('analytics.lessonsOpened')} />
          <Legend color="secondary.main" label={t('analytics.quizzesSubmitted')} />
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="h3" component="h2" gutterBottom>
            {t('analytics.funnel')}
          </Typography>
          <Stack spacing={1.5}>
            {data.funnel.map((step) => (
              <Box key={step.step}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">{step.label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {step.count}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={(step.count / funnelMax) * 100}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            ))}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="h3" component="h2" gutterBottom>
            {t('analytics.topLessons')}
          </Typography>
          {data.topLessons.length === 0 ? (
            <Typography color="text.secondary">{t('analytics.noData')}</Typography>
          ) : (
            <Stack spacing={1}>
              {data.topLessons.map((l) => (
                <Stack key={l.lessonId} direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" noWrap sx={{ mr: 2 }}>
                    {l.title}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {l.opens}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>
    </Stack>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}
