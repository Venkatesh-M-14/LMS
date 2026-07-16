import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  mcqPayloadSchema,
  multiSelectPayloadSchema,
  outputPredictionPayloadSchema,
  reflectionPayloadSchema,
  type AttemptResult,
  type ItemResult,
} from '@academy/shared';
import { CodeSnippet } from './ItemInputs';

/**
 * Post-submission review. For GRADED items the payload includes answer keys
 * and explanations; reflections pending manual grading stay sanitized.
 */

const answerRecord = z.record(z.string(), z.unknown());

function ItemReview({ item }: { item: ItemResult }) {
  const { t } = useTranslation();
  const answer = answerRecord.safeParse(item.answer).success
    ? (item.answer as Record<string, unknown>)
    : {};

  const statusIcon =
    item.earned === null ? (
      <HourglassTopIcon color="warning" />
    ) : item.correct === true ? (
      <CheckCircleIcon color="success" />
    ) : item.correct === false && (item.earned ?? 0) > 0 ? (
      <RemoveCircleOutlineIcon color="warning" />
    ) : item.correct === false ? (
      <CancelIcon color="error" />
    ) : (
      <CheckCircleIcon color="disabled" />
    );

  const body = (() => {
    switch (item.type) {
      case 'MCQ': {
        const full = mcqPayloadSchema.safeParse(item.payload);
        if (!full.success) return null;
        const selected =
          typeof answer.selectedOptionId === 'string' ? answer.selectedOptionId : null;
        return (
          <Stack spacing={1}>
            <Typography>{full.data.prompt}</Typography>
            {full.data.options.map((option) => {
              const isCorrect = option.id === full.data.correctOptionId;
              const isSelected = option.id === selected;
              return (
                <Stack key={option.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography
                    sx={{
                      fontWeight: isCorrect ? 700 : 400,
                      color: isCorrect
                        ? 'success.main'
                        : isSelected
                          ? 'error.main'
                          : 'text.primary',
                    }}
                  >
                    {option.text}
                  </Typography>
                  {isCorrect ? (
                    <Chip size="small" color="success" label={t('quiz.correctAnswer')} />
                  ) : null}
                  {isSelected && !isCorrect ? (
                    <Chip size="small" variant="outlined" label={t('quiz.yourChoice')} />
                  ) : null}
                </Stack>
              );
            })}
            {full.data.explanation ? <Alert severity="info">{full.data.explanation}</Alert> : null}
          </Stack>
        );
      }
      case 'MULTI_SELECT': {
        const full = multiSelectPayloadSchema.safeParse(item.payload);
        if (!full.success) return null;
        const selected = new Set(
          Array.isArray(answer.selectedOptionIds) ? (answer.selectedOptionIds as string[]) : [],
        );
        const correct = new Set(full.data.correctOptionIds);
        return (
          <Stack spacing={1}>
            <Typography>{full.data.prompt}</Typography>
            {full.data.options.map((option) => (
              <Stack key={option.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography
                  sx={{
                    fontWeight: correct.has(option.id) ? 700 : 400,
                    color: correct.has(option.id)
                      ? 'success.main'
                      : selected.has(option.id)
                        ? 'error.main'
                        : 'text.primary',
                  }}
                >
                  {option.text}
                </Typography>
                {correct.has(option.id) ? (
                  <Chip size="small" color="success" label={t('quiz.correctAnswer')} />
                ) : null}
                {selected.has(option.id) && !correct.has(option.id) ? (
                  <Chip size="small" variant="outlined" label={t('quiz.yourChoice')} />
                ) : null}
              </Stack>
            ))}
            {full.data.explanation ? <Alert severity="info">{full.data.explanation}</Alert> : null}
          </Stack>
        );
      }
      case 'OUTPUT_PREDICTION': {
        const full = outputPredictionPayloadSchema.safeParse(item.payload);
        if (!full.success) return null;
        const predicted = typeof answer.predictedOutput === 'string' ? answer.predictedOutput : '';
        return (
          <Stack spacing={1.5}>
            <Typography>{full.data.prompt}</Typography>
            <CodeSnippet code={full.data.code} language={full.data.language} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('quiz.yourPrediction')}
                </Typography>
                <Typography sx={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
                  {predicted || '—'}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('quiz.expectedOutput')}
                </Typography>
                <Typography
                  sx={{ fontFamily: 'ui-monospace, Menlo, monospace', color: 'success.main' }}
                >
                  {full.data.expectedOutput}
                </Typography>
              </Box>
            </Stack>
            {full.data.explanation ? <Alert severity="info">{full.data.explanation}</Alert> : null}
          </Stack>
        );
      }
      case 'REFLECTION': {
        const full = reflectionPayloadSchema.safeParse(item.payload);
        if (!full.success) return null;
        const text = typeof answer.text === 'string' ? answer.text : '';
        return (
          <Stack spacing={1.5}>
            <Typography>{full.data.prompt}</Typography>
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{text || '—'}</Typography>
            </Box>
            {item.earned === null ? (
              <Alert severity="warning">{t('quiz.reflectionPending')}</Alert>
            ) : item.graderFeedback ? (
              <Alert severity="info">
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                  {t('quiz.instructorFeedback')}
                </Typography>
                {item.graderFeedback}
              </Alert>
            ) : null}
          </Stack>
        );
      }
      default:
        return null;
    }
  })();

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          {statusIcon}
          <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
            {t(`quiz.types.${item.type}`)}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={
              item.earned === null
                ? t('quiz.pointsPending', { max: item.points })
                : t('quiz.pointsEarned', { earned: item.earned, max: item.points })
            }
          />
        </Stack>
        {body}
      </CardContent>
    </Card>
  );
}

export function ResultsView({ result }: { result: AttemptResult }) {
  const { t } = useTranslation();
  const graded = result.status === 'GRADED';

  return (
    <Box sx={{ maxWidth: 780, mx: 'auto' }} data-testid="attempt-results">
      <Typography variant="h1" gutterBottom>
        {result.assessmentTitle}
      </Typography>

      {graded ? (
        <Alert severity={result.passed ? 'success' : 'error'} sx={{ mb: 3 }}>
          <Typography variant="h6" component="p">
            {result.passed ? t('quiz.passedBanner') : t('quiz.failedBanner')}
          </Typography>
          {t('quiz.scoreLine', {
            pct: result.scorePct,
            raw: result.rawScore,
            max: result.maxScore,
            passing: result.passingScorePct,
          })}
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" component="p">
            {t('quiz.gradingBanner')}
          </Typography>
          {t('quiz.gradingBannerBody', { count: result.pendingManualCount })}
        </Alert>
      )}

      <Divider sx={{ mb: 3 }} />
      <Stack spacing={2.5}>
        {result.items.map((item) => (
          <ItemReview key={item.itemId} item={item} />
        ))}
      </Stack>
    </Box>
  );
}
