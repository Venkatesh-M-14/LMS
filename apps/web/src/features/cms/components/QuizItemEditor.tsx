import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import {
  CODE_LANGUAGES,
  type AssessmentItemPayload,
  type AssessmentItemType,
} from '@academy/shared';

/** Editable quiz item as held in editor state. */
export interface EditableQuizItem {
  key: string;
  points: number;
  skillIds: string[];
  item: AssessmentItemPayload;
}

let quizItemCounter = 0;
export const nextQuizItemKey = () => `qitem-${++quizItemCounter}`;

export function defaultQuizItem(type: AssessmentItemType): AssessmentItemPayload {
  switch (type) {
    case 'MCQ':
      return {
        type,
        payload: {
          prompt: '',
          options: [
            { id: 'a', text: '' },
            { id: 'b', text: '' },
          ],
          correctOptionId: 'a',
        },
      };
    case 'MULTI_SELECT':
      return {
        type,
        payload: {
          prompt: '',
          options: [
            { id: 'a', text: '' },
            { id: 'b', text: '' },
          ],
          correctOptionIds: ['a'],
        },
      };
    case 'OUTPUT_PREDICTION':
      return {
        type,
        payload: {
          prompt: '',
          language: 'javascript',
          code: '',
          expectedOutput: '',
          matchMode: 'trimmed',
        },
      };
    case 'REFLECTION':
      return { type, payload: { prompt: '' } };
    case 'CODING':
    case 'DEBUGGING':
      return { type, payload: { challengeId: '' } };
  }
}

const nextOptionId = (existing: Array<{ id: string }>): string => {
  const alphabet = 'abcdefghij';
  for (const ch of alphabet) {
    if (!existing.some((o) => o.id === ch)) return ch;
  }
  return `o${existing.length + 1}`;
};

interface OptionListEditorProps {
  options: Array<{ id: string; text: string }>;
  isCorrect: (id: string) => boolean;
  onToggleCorrect: (id: string) => void;
  correctControl: 'radio' | 'checkbox';
  onChange: (options: Array<{ id: string; text: string }>) => void;
}

function OptionListEditor({
  options,
  isCorrect,
  onToggleCorrect,
  correctControl,
  onChange,
}: OptionListEditorProps) {
  const { t } = useTranslation();
  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        {t('cms.quiz.markCorrect')}
      </Typography>
      {options.map((option, index) => (
        <Stack key={option.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {correctControl === 'radio' ? (
            <Radio
              checked={isCorrect(option.id)}
              onChange={() => onToggleCorrect(option.id)}
              size="small"
            />
          ) : (
            <Checkbox
              checked={isCorrect(option.id)}
              onChange={() => onToggleCorrect(option.id)}
              size="small"
            />
          )}
          <TextField
            size="small"
            fullWidth
            value={option.text}
            placeholder={t('cms.quiz.optionPlaceholder', { letter: option.id.toUpperCase() })}
            onChange={(e) =>
              onChange(options.map((o, i) => (i === index ? { ...o, text: e.target.value } : o)))
            }
          />
          <IconButton
            size="small"
            disabled={options.length <= 2}
            onClick={() => onChange(options.filter((_, i) => i !== index))}
            aria-label={t('cms.quiz.removeOption')}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        disabled={options.length >= 8}
        onClick={() => onChange([...options, { id: nextOptionId(options), text: '' }])}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t('cms.quiz.addOption')}
      </Button>
    </Stack>
  );
}

interface QuizItemEditorProps {
  index: number;
  total: number;
  value: EditableQuizItem;
  skillOptions: Array<{ id: string; name: string }>;
  challengeOptions: Array<{ id: string; title: string; environment: string }>;
  onChange: (value: EditableQuizItem) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}

export function QuizItemEditor({
  index,
  total,
  value,
  skillOptions,
  challengeOptions,
  onChange,
  onMove,
  onDelete,
}: QuizItemEditorProps) {
  const { t } = useTranslation();
  const { item } = value;

  const patchPayload = (patch: Record<string, unknown>) => {
    onChange({
      ...value,
      item: { ...item, payload: { ...item.payload, ...patch } } as AssessmentItemPayload,
    });
  };

  const promptField = (
    <TextField
      label={t('cms.quiz.prompt')}
      value={(item.payload as { prompt: string }).prompt}
      onChange={(e) => patchPayload({ prompt: e.target.value })}
      multiline
      minRows={2}
      fullWidth
      required
    />
  );

  const body = (() => {
    switch (item.type) {
      case 'MCQ':
        return (
          <Stack spacing={2}>
            {promptField}
            <OptionListEditor
              options={item.payload.options}
              correctControl="radio"
              isCorrect={(id) => item.payload.correctOptionId === id}
              onToggleCorrect={(id) => patchPayload({ correctOptionId: id })}
              onChange={(options) => patchPayload({ options })}
            />
            <TextField
              label={t('cms.quiz.explanation')}
              value={item.payload.explanation ?? ''}
              onChange={(e) => patchPayload({ explanation: e.target.value || undefined })}
              multiline
              fullWidth
            />
          </Stack>
        );
      case 'MULTI_SELECT':
        return (
          <Stack spacing={2}>
            {promptField}
            <OptionListEditor
              options={item.payload.options}
              correctControl="checkbox"
              isCorrect={(id) => item.payload.correctOptionIds.includes(id)}
              onToggleCorrect={(id) => {
                const current = new Set(item.payload.correctOptionIds);
                if (current.has(id)) current.delete(id);
                else current.add(id);
                patchPayload({ correctOptionIds: [...current] });
              }}
              onChange={(options) =>
                patchPayload({
                  options,
                  correctOptionIds: item.payload.correctOptionIds.filter((id) =>
                    options.some((o) => o.id === id),
                  ),
                })
              }
            />
            <TextField
              label={t('cms.quiz.explanation')}
              value={item.payload.explanation ?? ''}
              onChange={(e) => patchPayload({ explanation: e.target.value || undefined })}
              multiline
              fullWidth
            />
          </Stack>
        );
      case 'OUTPUT_PREDICTION':
        return (
          <Stack spacing={2}>
            {promptField}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label={t('cms.blocks.language')}
                value={item.payload.language}
                onChange={(e) => patchPayload({ language: e.target.value })}
                sx={{ minWidth: 150 }}
              >
                {CODE_LANGUAGES.map((lang) => (
                  <MenuItem key={lang} value={lang}>
                    {lang}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('cms.quiz.matchMode')}
                value={item.payload.matchMode}
                onChange={(e) => patchPayload({ matchMode: e.target.value })}
                sx={{ minWidth: 170 }}
              >
                {(['exact', 'trimmed', 'normalized'] as const).map((mode) => (
                  <MenuItem key={mode} value={mode}>
                    {t(`cms.quiz.matchModes.${mode}`)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <TextField
              label={t('cms.blocks.code')}
              value={item.payload.code}
              onChange={(e) => patchPayload({ code: e.target.value })}
              multiline
              minRows={4}
              fullWidth
              required
              slotProps={{
                input: {
                  sx: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.85rem' },
                },
              }}
            />
            <TextField
              label={t('cms.quiz.expectedOutput')}
              value={item.payload.expectedOutput}
              onChange={(e) => patchPayload({ expectedOutput: e.target.value })}
              multiline
              fullWidth
              required
              slotProps={{ input: { sx: { fontFamily: 'ui-monospace, Menlo, monospace' } } }}
            />
            <TextField
              label={t('cms.quiz.explanation')}
              value={item.payload.explanation ?? ''}
              onChange={(e) => patchPayload({ explanation: e.target.value || undefined })}
              multiline
              fullWidth
            />
          </Stack>
        );
      case 'CODING':
      case 'DEBUGGING':
        return (
          <Stack spacing={2}>
            <TextField
              select
              label={t('cms.quiz.challenge')}
              value={item.payload.challengeId}
              onChange={(e) => patchPayload({ challengeId: e.target.value })}
              helperText={t('cms.quiz.challengeHelp')}
              sx={{ maxWidth: 480 }}
              required
            >
              {challengeOptions.map((challenge) => (
                <MenuItem key={challenge.id} value={challenge.id}>
                  {challenge.title} ({challenge.environment})
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        );
      case 'REFLECTION':
        return (
          <Stack spacing={2}>
            {promptField}
            <TextField
              label={t('cms.quiz.guidance')}
              value={item.payload.guidance ?? ''}
              onChange={(e) => patchPayload({ guidance: e.target.value || undefined })}
              multiline
              fullWidth
            />
            <TextField
              label={t('cms.quiz.minWords')}
              type="number"
              value={item.payload.minWords ?? ''}
              onChange={(e) =>
                patchPayload({ minWords: e.target.value ? Number(e.target.value) : undefined })
              }
              sx={{ maxWidth: 200 }}
            />
          </Stack>
        );
    }
  })();

  return (
    <Card variant="outlined">
      <CardHeader
        title={`${index + 1}. ${t(`quiz.types.${item.type}`)}`}
        titleTypographyProps={{ variant: 'subtitle2' }}
        action={
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <TextField
              label={t('cms.quiz.pointsLabel')}
              type="number"
              size="small"
              value={value.points}
              onChange={(e) =>
                onChange({ ...value, points: Math.max(1, Number(e.target.value) || 1) })
              }
              sx={{ width: 90, mr: 1 }}
            />
            <Tooltip title={t('cms.blocks.moveUp')}>
              <span>
                <IconButton
                  size="small"
                  disabled={index === 0}
                  onClick={() => onMove(-1)}
                  aria-label={t('cms.blocks.moveUp')}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('cms.blocks.moveDown')}>
              <span>
                <IconButton
                  size="small"
                  disabled={index === total - 1}
                  onClick={() => onMove(1)}
                  aria-label={t('cms.blocks.moveDown')}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('cms.quiz.deleteItem')}>
              <IconButton size="small" onClick={onDelete} aria-label={t('cms.quiz.deleteItem')}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={2}>
          {body}
          <TextField
            select
            label={t('cms.skills')}
            value={value.skillIds}
            onChange={(e) => {
              const raw = e.target.value as unknown;
              onChange({ ...value, skillIds: Array.isArray(raw) ? (raw as string[]) : [] });
            }}
            slotProps={{ select: { multiple: true } }}
            sx={{ maxWidth: 420 }}
            helperText={t('cms.skillsHelp')}
          >
            {skillOptions.map((skill) => (
              <MenuItem key={skill.id} value={skill.id}>
                {skill.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </CardContent>
    </Card>
  );
}
