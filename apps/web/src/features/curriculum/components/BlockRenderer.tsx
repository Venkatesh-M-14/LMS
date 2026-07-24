import { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  calloutPayloadSchema,
  codePayloadSchema,
  embedPayloadSchema,
  imagePayloadSchema,
  markdownPayloadSchema,
  videoPayloadSchema,
  type ContentBlockDto,
} from '@academy/shared';

/**
 * Renders a lesson's content blocks. Payloads are re-validated with the same
 * shared schemas the API used at write time — a malformed block renders as a
 * warning instead of crashing the reader.
 */

const CALLOUT_SEVERITY = {
  info: 'info',
  tip: 'success',
  warning: 'warning',
  danger: 'error',
} as const;

function MarkdownBody({ markdown }: { markdown: string }) {
  return (
    <Box
      sx={{
        '& h1': { typography: 'h2', mt: 0, mb: 2 },
        '& h2': { typography: 'h3', mt: 4, mb: 1.5 },
        '& h3': { typography: 'h6', mt: 3, mb: 1 },
        '& p, & li': { typography: 'body1', lineHeight: 1.75 },
        '& code': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.875em',
          bgcolor: 'action.hover',
          px: 0.6,
          py: 0.2,
          borderRadius: 0.5,
        },
        '& pre': {
          bgcolor: 'action.hover',
          p: 2,
          borderRadius: 1,
          overflowX: 'auto',
        },
        '& pre code': { bgcolor: 'transparent', p: 0 },
        '& table': {
          borderCollapse: 'collapse',
          my: 2,
          display: 'block',
          overflowX: 'auto',
          maxWidth: '100%',
        },
        '& th, & td': { border: 1, borderColor: 'divider', px: 1.5, py: 0.75, textAlign: 'left' },
        '& blockquote': {
          borderLeft: 3,
          borderColor: 'primary.main',
          pl: 2,
          ml: 0,
          color: 'text.secondary',
        },
        '& a': { color: 'primary.main' },
      }}
    >
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </Box>
  );
}

function youtubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,20})/);
  return match?.[1] ? `https://www.youtube-nocookie.com/embed/${match[1]}` : null;
}

function Block({ block }: { block: ContentBlockDto }) {
  const invalid = (
    <Alert severity="warning" variant="outlined">
      This content block could not be displayed.
    </Alert>
  );

  switch (block.type) {
    case 'MARKDOWN': {
      const parsed = markdownPayloadSchema.safeParse(block.payload);
      return parsed.success ? <MarkdownBody markdown={parsed.data.markdown} /> : invalid;
    }
    case 'CODE': {
      const parsed = codePayloadSchema.safeParse(block.payload);
      if (!parsed.success) return invalid;
      const { code, language, filename, caption } = parsed.data;
      return (
        <Box>
          {filename ? (
            <Typography
              component="div"
              variant="caption"
              sx={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                bgcolor: 'grey.900',
                color: 'grey.400',
                px: 2,
                py: 0.75,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
              }}
            >
              {filename}
            </Typography>
          ) : null}
          <Box
            component="pre"
            aria-label={`${language} code example`}
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
              ...(filename ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : {}),
            }}
          >
            <code>{code}</code>
          </Box>
          {caption ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.75, display: 'block' }}
            >
              {caption}
            </Typography>
          ) : null}
        </Box>
      );
    }
    case 'CALLOUT': {
      const parsed = calloutPayloadSchema.safeParse(block.payload);
      if (!parsed.success) return invalid;
      return (
        <Alert severity={CALLOUT_SEVERITY[parsed.data.variant]} variant="outlined">
          {parsed.data.title ? <AlertTitle>{parsed.data.title}</AlertTitle> : null}
          <MarkdownBody markdown={parsed.data.markdown} />
        </Alert>
      );
    }
    case 'VIDEO': {
      const parsed = videoPayloadSchema.safeParse(block.payload);
      if (!parsed.success) return invalid;
      const embed =
        parsed.data.provider === 'youtube' ? youtubeEmbedUrl(parsed.data.url) : parsed.data.url;
      if (!embed) return invalid;
      return (
        <Box sx={{ position: 'relative', pt: '56.25%', borderRadius: 2, overflow: 'hidden' }}>
          <Box
            component="iframe"
            src={embed}
            title={parsed.data.title ?? 'Lesson video'}
            allowFullScreen
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        </Box>
      );
    }
    case 'IMAGE': {
      const parsed = imagePayloadSchema.safeParse(block.payload);
      if (!parsed.success) return invalid;
      return (
        <Box component="figure" sx={{ m: 0 }}>
          <Box
            component="img"
            src={parsed.data.url}
            alt={parsed.data.alt}
            sx={{ maxWidth: '100%', borderRadius: 2 }}
          />
          {parsed.data.caption ? (
            <Typography component="figcaption" variant="caption" color="text.secondary">
              {parsed.data.caption}
            </Typography>
          ) : null}
        </Box>
      );
    }
    case 'EMBED': {
      const parsed = embedPayloadSchema.safeParse(block.payload);
      if (!parsed.success) return invalid;
      return (
        <Box
          component="iframe"
          src={parsed.data.url}
          title={parsed.data.title}
          sx={{
            width: '100%',
            height: parsed.data.heightPx,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        />
      );
    }
    default:
      return invalid;
  }
}

export function BlockRenderer({ blocks }: { blocks: ContentBlockDto[] }) {
  const ordered = useMemo(() => [...blocks].sort((a, b) => a.order - b.order), [blocks]);
  return (
    <Stack spacing={3}>
      {ordered.map((block) => (
        <Block key={block.id} block={block} />
      ))}
    </Stack>
  );
}
