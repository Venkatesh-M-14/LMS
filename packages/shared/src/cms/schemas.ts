import { z } from 'zod';
import { contentBlockDtoSchema, contentBlockSchema } from '../content/blocks';
import { lessonVersionStatusSchema, skillDtoSchema, topicDepthSchema } from '../curriculum/schemas';

// ── CMS DTOs ────────────────────────────────────────────────────────────────

export const lessonVersionSummarySchema = z.object({
  id: z.string(),
  versionNumber: z.number().int(),
  status: lessonVersionStatusSchema,
  authorId: z.string(),
  authorName: z.string(),
  reviewerId: z.string().nullable(),
  reviewerName: z.string().nullable(),
  changelog: z.string(),
  reviewNotes: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
});
export type LessonVersionSummary = z.infer<typeof lessonVersionSummarySchema>;

export const lessonVersionDetailSchema = lessonVersionSummarySchema.extend({
  lessonId: z.string(),
  lessonTitle: z.string(),
  blocks: z.array(contentBlockDtoSchema),
});
export type LessonVersionDetail = z.infer<typeof lessonVersionDetailSchema>;

export const cmsLessonOverviewSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  order: z.number().int(),
  estimatedMinutes: z.number().int(),
  topicId: z.string(),
  topicTitle: z.string(),
  topicDepth: topicDepthSchema,
  moduleTitle: z.string(),
  skills: z.array(skillDtoSchema),
  publishedVersionNumber: z.number().int().nullable(),
  latestVersion: lessonVersionSummarySchema.nullable(),
});
export type CmsLessonOverview = z.infer<typeof cmsLessonOverviewSchema>;

// ── CMS requests ────────────────────────────────────────────────────────────

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use kebab-case: lowercase letters, digits, hyphens')
  .min(2)
  .max(80);

export const createLessonRequestSchema = z.object({
  topicId: z.string().min(1),
  slug: slugSchema,
  title: z.string().trim().min(3).max(160),
  estimatedMinutes: z.number().int().min(1).max(240),
});
export type CreateLessonRequest = z.infer<typeof createLessonRequestSchema>;

export const updateLessonSkillsRequestSchema = z.object({
  skillIds: z.array(z.string().min(1)).max(10),
});
export type UpdateLessonSkillsRequest = z.infer<typeof updateLessonSkillsRequestSchema>;

/**
 * Draft editing is a full-replace of the block list — one atomic write, no
 * per-block PATCH choreography. Order is the array order.
 */
export const replaceBlocksRequestSchema = z.object({
  blocks: z.array(contentBlockSchema).max(100),
});
export type ReplaceBlocksRequest = z.infer<typeof replaceBlocksRequestSchema>;

export const createDraftRequestSchema = z.object({
  changelog: z.string().trim().max(500).default(''),
});
export type CreateDraftRequest = z.infer<typeof createDraftRequestSchema>;

export const rejectVersionRequestSchema = z.object({
  reviewNotes: z.string().trim().min(3, 'Tell the author what to change').max(2000),
});
export type RejectVersionRequest = z.infer<typeof rejectVersionRequestSchema>;
