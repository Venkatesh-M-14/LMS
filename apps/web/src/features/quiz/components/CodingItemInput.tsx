import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { codingAnswerSchema } from '@academy/shared';
import { runClientTests, type ClientTestResult } from '../clientRunner';

const studentCodingSchema = z.object({
  challengeId: z.string(),
  title: z.string().optional(),
  environment: z.enum(['JS', 'DOM']).optional(),
  instructionsMd: z.string().optional(),
  starterFiles: z.record(z.string(), z.string()).optional(),
  visibleTests: z
    .array(z.object({ id: z.string(), name: z.string(), specCode: z.string() }))
    .optional(),
  hiddenTestCount: z.number().optional(),
});

interface CodingItemInputProps {
  payload: unknown;
  value: unknown;
  onChange: (answer: unknown) => void;
  disabled?: boolean;
}

/** Multi-file code editor with instant, advisory client-side test runs. */
export function CodingItemInput({ payload, value, onChange, disabled }: CodingItemInputProps) {
  const { t } = useTranslation();
  const parsed = studentCodingSchema.safeParse(payload);
  const starter = useMemo(() => parsed.data?.starterFiles ?? { 'main.js': '' }, [parsed.data]);

  const answer = codingAnswerSchema.safeParse(value);
  const files = answer.success ? answer.data.files : starter;
  const fileNames = Object.keys(files);
  const [activeFile, setActiveFile] = useState(fileNames[0] ?? 'main.js');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ClientTestResult[] | null>(null);

  if (!parsed.success) {
    return <Alert severity="warning">{t('quiz.coding.invalid')}</Alert>;
  }
  const {
    instructionsMd,
    environment,
    visibleTests = [],
    hiddenTestCount = 0,
    title,
  } = parsed.data;

  const updateFile = (content: string) => {
    onChange({ files: { ...files, [activeFile]: content } });
    setResults(null);
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      setResults(await runClientTests(environment ?? 'JS', files, visibleTests));
    } finally {
      setRunning(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const target = event.currentTarget;
      const { selectionStart, selectionEnd, value: current } = target;
      const next = `${current.slice(0, selectionStart)}  ${current.slice(selectionEnd)}`;
      updateFile(next);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = selectionStart + 2;
      });
    }
  };

  return (
    <Stack spacing={2}>
      {title ? <Typography sx={{ fontWeight: 600 }}>{title}</Typography> : null}
      {instructionsMd ? (
        <Box
          sx={{
            '& p': { my: 0.5 },
            '& li': { my: 0.25 },
            '& code': {
              fontFamily: 'ui-monospace, Menlo, monospace',
              bgcolor: 'action.hover',
              px: 0.5,
              borderRadius: 0.5,
            },
          }}
        >
          <Markdown remarkPlugins={[remarkGfm]}>{instructionsMd}</Markdown>
        </Box>
      ) : null}

      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <Tabs
          value={activeFile}
          onChange={(_e, file: string) => setActiveFile(file)}
          variant="scrollable"
          sx={{ minHeight: 36, bgcolor: 'action.hover' }}
        >
          {fileNames.map((name) => (
            <Tab
              key={name}
              value={name}
              label={name}
              sx={{ minHeight: 36, textTransform: 'none' }}
            />
          ))}
        </Tabs>
        <Box
          component="textarea"
          aria-label={t('quiz.coding.editor', { file: activeFile })}
          value={files[activeFile] ?? ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateFile(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          spellCheck={false}
          sx={{
            display: 'block',
            width: '100%',
            minHeight: 260,
            p: 2,
            border: 0,
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            bgcolor: 'grey.900',
            color: 'grey.100',
            tabSize: 2,
          }}
        />
      </Box>

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<PlayArrowIcon />}
          disabled={disabled || running || visibleTests.length === 0}
          onClick={() => void handleRun()}
        >
          {running
            ? t('quiz.coding.running')
            : t('quiz.coding.runVisible', { count: visibleTests.length })}
        </Button>
        <Button
          size="small"
          startIcon={<RestartAltIcon />}
          disabled={disabled}
          onClick={() => {
            onChange({ files: starter });
            setResults(null);
          }}
        >
          {t('quiz.coding.reset')}
        </Button>
        {hiddenTestCount > 0 ? (
          <Chip
            size="small"
            variant="outlined"
            label={t('quiz.coding.hiddenNote', { count: hiddenTestCount })}
          />
        ) : null}
      </Stack>

      {results ? (
        <List dense disablePadding data-testid="client-test-results">
          {results.map((result) => (
            <ListItem key={result.id} disableGutters>
              <ListItemIcon sx={{ minWidth: 32 }}>
                {result.passed ? (
                  <CheckCircleIcon fontSize="small" color="success" />
                ) : (
                  <CancelIcon fontSize="small" color="error" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={result.name}
                secondary={result.passed ? null : result.message}
              />
            </ListItem>
          ))}
        </List>
      ) : null}
    </Stack>
  );
}
