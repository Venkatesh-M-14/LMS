import { z } from 'zod';

/** Projects & machine coding: briefs, rubric-scored reviews, feedback threads. */

export const projectKindSchema = z.enum(['MINI_PROJECT', 'MACHINE_CODING']);
export type ProjectKind = z.infer<typeof projectKindSchema>;

export const reviewStatusSchema = z.enum(['PENDING', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED']);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export interface RubricCriterionView {
  id: string;
  order: number;
  title: string;
  description: string;
  maxPoints: number;
}

export interface ProjectBriefView {
  id: string;
  topicId: string;
  topicTitle: string;
  kind: ProjectKind;
  title: string;
  briefMd: string;
  rubric: RubricCriterionView[];
  totalPoints: number;
}

export interface SubmissionMessageView {
  id: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export interface RubricScoreView {
  criterionId: string;
  points: number;
  comment: string;
}

export interface ProjectSubmissionView {
  id: string;
  briefId: string;
  status: ReviewStatus;
  repoUrl: string;
  demoUrl: string;
  notes: string;
  submissionRound: number;
  submittedAt: string;
  reviewedAt: string | null;
  reviewerName: string | null;
  scores: RubricScoreView[];
  earnedPoints: number | null;
  messages: SubmissionMessageView[];
}

/** Student's combined view of a topic's project. */
export interface ProjectView {
  brief: ProjectBriefView;
  submission: ProjectSubmissionView | null;
}

// ── Requests ────────────────────────────────────────────────────────────────

const httpsUrl = z
  .string()
  .trim()
  .url('A valid URL is required')
  .max(500)
  .refine((url) => url.startsWith('https://') || url.startsWith('http://'), {
    message: 'Use an http(s) URL',
  });

export const submitProjectRequestSchema = z.object({
  repoUrl: httpsUrl,
  demoUrl: httpsUrl.or(z.literal('')).default(''),
  notes: z.string().trim().max(4000).default(''),
});
export type SubmitProjectRequest = z.infer<typeof submitProjectRequestSchema>;

export const submissionMessageRequestSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(4000),
});
export type SubmissionMessageRequest = z.infer<typeof submissionMessageRequestSchema>;

export const requestChangesRequestSchema = z.object({
  message: z.string().trim().min(3, 'Tell the student what to change').max(4000),
});
export type RequestChangesRequest = z.infer<typeof requestChangesRequestSchema>;

export const approveProjectRequestSchema = z.object({
  scores: z
    .array(
      z.object({
        criterionId: z.string().min(1),
        points: z.number().min(0),
        comment: z.string().trim().max(2000).default(''),
      }),
    )
    .min(1),
  message: z.string().trim().max(4000).default(''),
});
export type ApproveProjectRequest = z.infer<typeof approveProjectRequestSchema>;

// ── Instructor queue ────────────────────────────────────────────────────────

export interface ProjectQueueEntry {
  submissionId: string;
  briefTitle: string;
  topicTitle: string;
  kind: ProjectKind;
  studentName: string;
  status: ReviewStatus;
  submissionRound: number;
  submittedAt: string;
}

export interface ProjectReviewDetail {
  submission: ProjectSubmissionView;
  brief: ProjectBriefView;
  studentName: string;
}
