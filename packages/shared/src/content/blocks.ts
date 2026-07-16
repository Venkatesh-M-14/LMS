import { z } from 'zod';

/**
 * Content-block payloads — the single source of truth for what each block
 * type carries. Validated at the API boundary on every write, rendered by
 * the web reader, and versioned per row via payloadSchemaVersion.
 */

export const CONTENT_BLOCK_PAYLOAD_SCHEMA_VERSION = 1;

export const ContentBlockTypes = [
  'MARKDOWN',
  'CODE',
  'CALLOUT',
  'VIDEO',
  'IMAGE',
  'EMBED',
] as const;
export const contentBlockTypeSchema = z.enum(ContentBlockTypes);
export type ContentBlockType = z.infer<typeof contentBlockTypeSchema>;

export const markdownPayloadSchema = z.object({
  markdown: z.string().min(1, 'Markdown content is required').max(50_000),
});

export const CODE_LANGUAGES = [
  'html',
  'css',
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'json',
  'bash',
  'sql',
  'text',
] as const;

export const codePayloadSchema = z.object({
  language: z.enum(CODE_LANGUAGES),
  code: z.string().min(1, 'Code is required').max(20_000),
  filename: z.string().max(120).optional(),
  caption: z.string().max(300).optional(),
});

export const calloutPayloadSchema = z.object({
  variant: z.enum(['info', 'tip', 'warning', 'danger']),
  title: z.string().max(120).optional(),
  markdown: z.string().min(1, 'Callout content is required').max(5_000),
});

export const videoPayloadSchema = z.object({
  provider: z.enum(['youtube', 'vimeo', 'url']),
  url: z.string().url().max(500),
  title: z.string().max(200).optional(),
});

export const imagePayloadSchema = z.object({
  url: z.string().url().max(500),
  alt: z.string().min(1, 'Alt text is required for accessibility').max(300),
  caption: z.string().max(300).optional(),
});

export const embedPayloadSchema = z.object({
  url: z.string().url().max(500),
  title: z.string().min(1, 'Embeds need an accessible title').max(200),
  heightPx: z.number().int().min(100).max(2000).default(400),
});

/** Discriminated union used for every block write and read. */
export const contentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MARKDOWN'), payload: markdownPayloadSchema }),
  z.object({ type: z.literal('CODE'), payload: codePayloadSchema }),
  z.object({ type: z.literal('CALLOUT'), payload: calloutPayloadSchema }),
  z.object({ type: z.literal('VIDEO'), payload: videoPayloadSchema }),
  z.object({ type: z.literal('IMAGE'), payload: imagePayloadSchema }),
  z.object({ type: z.literal('EMBED'), payload: embedPayloadSchema }),
]);
export type ContentBlockInput = z.infer<typeof contentBlockSchema>;

export const contentBlockDtoSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  type: contentBlockTypeSchema,
  payload: z.unknown(),
  payloadSchemaVersion: z.number().int(),
});
export type ContentBlockDto = z.infer<typeof contentBlockDtoSchema>;
