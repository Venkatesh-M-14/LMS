import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import {
  mcqAnswerSchema,
  multiSelectAnswerSchema,
  outputPredictionAnswerSchema,
  reflectionAnswerSchema,
  type StudentItemView,
} from '@academy/shared';
import { z } from 'zod';

/**
 * Per-type answer inputs for an in-progress attempt. Student payloads are
 * parsed with the sanitized schemas — no answer keys exist here by design.
 */

const studentMcqSchema = z.object({
  prompt: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })),
});
const studentOutputSchema = z.object({
  prompt: z.string(),
  language: z.string(),
  code: z.string(),
});
const studentReflectionSchema = z.object({
  prompt: z.string(),
  guidance: z.string().optional(),
  minWords: z.number().optional(),
});

export function CodeSnippet({ code, language }: { code: string; language: string }) {
  return (
    <Box
      component="pre"
      aria-label={`${language} code`}
      sx={{
        m: 0,
        p: 2,
        bgcolor: 'grey.900',
        color: 'grey.100',
        overflowX: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '0.85rem',
        lineHeight: 1.6,
        borderRadius: 2,
      }}
    >
      <code>{code}</code>
    </Box>
  );
}

interface ItemInputProps {
  item: StudentItemView;
  value: unknown;
  onChange: (answer: unknown) => void;
  disabled?: boolean;
}

export function ItemInput({ item, value, onChange, disabled }: ItemInputProps) {
  const { t } = useTranslation();

  switch (item.type) {
    case 'MCQ': {
      const payload = studentMcqSchema.parse(item.payload);
      const answer = mcqAnswerSchema.safeParse(value);
      return (
        <FormControl disabled={disabled} fullWidth>
          <FormLabel sx={{ typography: 'body1', color: 'text.primary', mb: 1 }}>
            {payload.prompt}
          </FormLabel>
          <RadioGroup
            value={answer.success ? answer.data.selectedOptionId : ''}
            onChange={(e) => onChange({ selectedOptionId: e.target.value })}
          >
            {payload.options.map((option) => (
              <FormControlLabel
                key={option.id}
                value={option.id}
                control={<Radio />}
                label={option.text}
              />
            ))}
          </RadioGroup>
        </FormControl>
      );
    }
    case 'MULTI_SELECT': {
      const payload = studentMcqSchema.parse(item.payload);
      const answer = multiSelectAnswerSchema.safeParse(value);
      const selected = new Set(answer.success ? answer.data.selectedOptionIds : []);
      const toggle = (id: string, checked: boolean) => {
        const next = new Set(selected);
        if (checked) next.add(id);
        else next.delete(id);
        onChange({ selectedOptionIds: [...next] });
      };
      return (
        <FormControl disabled={disabled} fullWidth component="fieldset">
          <FormLabel sx={{ typography: 'body1', color: 'text.primary', mb: 0.5 }}>
            {payload.prompt}
          </FormLabel>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
            {t('quiz.selectAll')}
          </Typography>
          <FormGroup>
            {payload.options.map((option) => (
              <FormControlLabel
                key={option.id}
                control={
                  <Checkbox
                    checked={selected.has(option.id)}
                    onChange={(e) => toggle(option.id, e.target.checked)}
                  />
                }
                label={option.text}
              />
            ))}
          </FormGroup>
        </FormControl>
      );
    }
    case 'OUTPUT_PREDICTION': {
      const payload = studentOutputSchema.parse(item.payload);
      const answer = outputPredictionAnswerSchema.safeParse(value);
      return (
        <Stack spacing={2}>
          <Typography>{payload.prompt}</Typography>
          <CodeSnippet code={payload.code} language={payload.language} />
          <TextField
            label={t('quiz.yourPrediction')}
            value={answer.success ? answer.data.predictedOutput : ''}
            onChange={(e) => onChange({ predictedOutput: e.target.value })}
            disabled={disabled}
            multiline
            minRows={1}
            slotProps={{
              input: { sx: { fontFamily: 'ui-monospace, Menlo, monospace' } },
            }}
          />
        </Stack>
      );
    }
    case 'REFLECTION': {
      const payload = studentReflectionSchema.parse(item.payload);
      const answer = reflectionAnswerSchema.safeParse(value);
      const text = answer.success ? answer.data.text : '';
      const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
      return (
        <Stack spacing={1.5}>
          <Typography>{payload.prompt}</Typography>
          {payload.guidance ? (
            <Typography variant="body2" color="text.secondary">
              {payload.guidance}
            </Typography>
          ) : null}
          <TextField
            label={t('quiz.yourAnswer')}
            value={text}
            onChange={(e) => onChange({ text: e.target.value })}
            disabled={disabled}
            multiline
            minRows={4}
            helperText={
              payload.minWords
                ? t('quiz.wordCountOf', { words, min: payload.minWords })
                : t('quiz.wordCount', { words })
            }
          />
        </Stack>
      );
    }
    default:
      return null;
  }
}
