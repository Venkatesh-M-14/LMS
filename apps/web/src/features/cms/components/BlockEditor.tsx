import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import { CODE_LANGUAGES, type ContentBlockInput, type ContentBlockType } from '@academy/shared';

/** Fresh payloads for newly added blocks. */
export function defaultBlock(type: ContentBlockType): ContentBlockInput {
  switch (type) {
    case 'MARKDOWN':
      return { type, payload: { markdown: '' } };
    case 'CODE':
      return { type, payload: { language: 'javascript', code: '' } };
    case 'CALLOUT':
      return { type, payload: { variant: 'info', markdown: '' } };
    case 'VIDEO':
      return { type, payload: { provider: 'youtube', url: '' } };
    case 'IMAGE':
      return { type, payload: { url: '', alt: '' } };
    case 'EMBED':
      return { type, payload: { url: '', title: '', heightPx: 400 } };
  }
}

interface BlockEditorItemProps {
  index: number;
  total: number;
  block: ContentBlockInput;
  onChange: (block: ContentBlockInput) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}

export function BlockEditorItem({
  index,
  total,
  block,
  onChange,
  onMove,
  onDelete,
}: BlockEditorItemProps) {
  const { t } = useTranslation();

  const patch = (payloadPatch: Record<string, unknown>) => {
    onChange({ ...block, payload: { ...block.payload, ...payloadPatch } } as ContentBlockInput);
  };

  const fields = (() => {
    switch (block.type) {
      case 'MARKDOWN':
        return (
          <TextField
            label={t('cms.blocks.markdown')}
            value={block.payload.markdown}
            onChange={(e) => patch({ markdown: e.target.value })}
            multiline
            minRows={6}
            fullWidth
          />
        );
      case 'CODE':
        return (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label={t('cms.blocks.language')}
                value={block.payload.language}
                onChange={(e) => patch({ language: e.target.value })}
                sx={{ minWidth: 160 }}
              >
                {CODE_LANGUAGES.map((lang) => (
                  <MenuItem key={lang} value={lang}>
                    {lang}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t('cms.blocks.filename')}
                value={block.payload.filename ?? ''}
                onChange={(e) => patch({ filename: e.target.value || undefined })}
                fullWidth
              />
            </Stack>
            <TextField
              label={t('cms.blocks.code')}
              value={block.payload.code}
              onChange={(e) => patch({ code: e.target.value })}
              multiline
              minRows={6}
              fullWidth
              slotProps={{
                input: {
                  sx: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.85rem' },
                },
              }}
            />
            <TextField
              label={t('cms.blocks.caption')}
              value={block.payload.caption ?? ''}
              onChange={(e) => patch({ caption: e.target.value || undefined })}
              fullWidth
            />
          </Stack>
        );
      case 'CALLOUT':
        return (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label={t('cms.blocks.variant')}
                value={block.payload.variant}
                onChange={(e) => patch({ variant: e.target.value })}
                sx={{ minWidth: 160 }}
              >
                {(['info', 'tip', 'warning', 'danger'] as const).map((variant) => (
                  <MenuItem key={variant} value={variant}>
                    {t(`cms.blocks.variants.${variant}`)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t('cms.blocks.title')}
                value={block.payload.title ?? ''}
                onChange={(e) => patch({ title: e.target.value || undefined })}
                fullWidth
              />
            </Stack>
            <TextField
              label={t('cms.blocks.markdown')}
              value={block.payload.markdown}
              onChange={(e) => patch({ markdown: e.target.value })}
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        );
      case 'VIDEO':
        return (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label={t('cms.blocks.provider')}
              value={block.payload.provider}
              onChange={(e) => patch({ provider: e.target.value })}
              sx={{ minWidth: 140 }}
            >
              {(['youtube', 'vimeo', 'url'] as const).map((provider) => (
                <MenuItem key={provider} value={provider}>
                  {provider}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="URL"
              value={block.payload.url}
              onChange={(e) => patch({ url: e.target.value })}
              fullWidth
            />
            <TextField
              label={t('cms.blocks.title')}
              value={block.payload.title ?? ''}
              onChange={(e) => patch({ title: e.target.value || undefined })}
              fullWidth
            />
          </Stack>
        );
      case 'IMAGE':
        return (
          <Stack spacing={2}>
            <TextField
              label="URL"
              value={block.payload.url}
              onChange={(e) => patch({ url: e.target.value })}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={t('cms.blocks.alt')}
                value={block.payload.alt}
                onChange={(e) => patch({ alt: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label={t('cms.blocks.caption')}
                value={block.payload.caption ?? ''}
                onChange={(e) => patch({ caption: e.target.value || undefined })}
                fullWidth
              />
            </Stack>
          </Stack>
        );
      case 'EMBED':
        return (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="URL"
              value={block.payload.url}
              onChange={(e) => patch({ url: e.target.value })}
              fullWidth
            />
            <TextField
              label={t('cms.blocks.title')}
              value={block.payload.title}
              onChange={(e) => patch({ title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label={t('cms.blocks.height')}
              type="number"
              value={block.payload.heightPx}
              onChange={(e) => patch({ heightPx: Number(e.target.value) })}
              sx={{ minWidth: 120 }}
            />
          </Stack>
        );
    }
  })();

  return (
    <Card variant="outlined">
      <CardHeader
        title={t(`cms.blocks.types.${block.type}`)}
        titleTypographyProps={{ variant: 'subtitle2' }}
        action={
          <Stack direction="row">
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
            <Tooltip title={t('cms.blocks.delete')}>
              <IconButton size="small" onClick={onDelete} aria-label={t('cms.blocks.delete')}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />
      <CardContent sx={{ pt: 0 }}>{fields}</CardContent>
    </Card>
  );
}
