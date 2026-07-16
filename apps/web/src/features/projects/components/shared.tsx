import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SendIcon from '@mui/icons-material/Send';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import type {
  ProjectBriefView,
  ReviewStatus,
  RubricScoreView,
  SubmissionMessageView,
} from '@academy/shared';

export function ReviewStatusChip({ status }: { status: ReviewStatus }) {
  const { t } = useTranslation();
  const color =
    status === 'APPROVED'
      ? 'success'
      : status === 'CHANGES_REQUESTED'
        ? 'warning'
        : status === 'IN_REVIEW'
          ? 'info'
          : 'default';
  return <Chip size="small" color={color} label={t(`projects.status.${status}`)} />;
}

export function BriefBody({ brief }: { brief: ProjectBriefView }) {
  const { t } = useTranslation();
  return (
    <Stack spacing={2}>
      <Box
        sx={{
          '& h2': { typography: 'h6', mt: 2, mb: 1 },
          '& p, & li': { lineHeight: 1.7 },
          '& code': {
            fontFamily: 'ui-monospace, Menlo, monospace',
            bgcolor: 'action.hover',
            px: 0.5,
            borderRadius: 0.5,
          },
        }}
      >
        <Markdown remarkPlugins={[remarkGfm]}>{brief.briefMd}</Markdown>
      </Box>

      <Typography variant="subtitle2">{t('projects.rubric')}</Typography>
      <Table size="small" aria-label={t('projects.rubric')}>
        <TableHead>
          <TableRow>
            <TableCell>{t('projects.criterion')}</TableCell>
            <TableCell align="right">{t('projects.maxPoints')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {brief.rubric.map((criterion) => (
            <TableRow key={criterion.id}>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {criterion.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {criterion.description}
                </Typography>
              </TableCell>
              <TableCell align="right">{criterion.maxPoints}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>{t('projects.total')}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              {brief.totalPoints}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Stack>
  );
}

export function ScoresTable({
  brief,
  scores,
  earned,
}: {
  brief: ProjectBriefView;
  scores: RubricScoreView[];
  earned: number | null;
}) {
  const { t } = useTranslation();
  const byCriterion = new Map(scores.map((score) => [score.criterionId, score]));
  return (
    <Table size="small" aria-label={t('projects.scores')}>
      <TableBody>
        {brief.rubric.map((criterion) => {
          const score = byCriterion.get(criterion.id);
          return (
            <TableRow key={criterion.id}>
              <TableCell>
                <Typography variant="body2">{criterion.title}</Typography>
                {score?.comment ? (
                  <Typography variant="caption" color="text.secondary">
                    {score.comment}
                  </Typography>
                ) : null}
              </TableCell>
              <TableCell align="right">
                {score?.points ?? '—'}/{criterion.maxPoints}
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow>
          <TableCell sx={{ fontWeight: 700 }}>{t('projects.total')}</TableCell>
          <TableCell align="right" sx={{ fontWeight: 700 }}>
            {earned ?? '—'}/{brief.totalPoints}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

export function MessageThread({
  messages,
  onSend,
  sending,
}: {
  messages: SubmissionMessageView[];
  onSend: (body: string) => void;
  sending: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState('');

  return (
    <Stack spacing={1.5} data-testid="feedback-thread">
      <Typography variant="subtitle2">{t('projects.thread')}</Typography>
      {messages.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('projects.threadEmpty')}
        </Typography>
      ) : (
        messages.map((message) => (
          <Paper key={message.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
              <Typography variant="subtitle2">{message.authorName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {message.authorRole.toLowerCase()} ·{' '}
                {new Date(message.createdAt).toLocaleString(i18n.resolvedLanguage)}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {message.body}
            </Typography>
          </Paper>
        ))
      )}
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          fullWidth
          multiline
          placeholder={t('projects.threadPlaceholder')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          variant="outlined"
          startIcon={<SendIcon />}
          disabled={sending || draft.trim().length === 0}
          onClick={() => {
            onSend(draft.trim());
            setDraft('');
          }}
        >
          {t('projects.send')}
        </Button>
      </Stack>
    </Stack>
  );
}
