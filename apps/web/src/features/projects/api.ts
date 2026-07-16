import type {
  ApproveProjectRequest,
  ProjectQueueEntry,
  ProjectReviewDetail,
  ProjectView,
  SubmitProjectRequest,
} from '@academy/shared';
import { apiRequest } from '../../shared/api/client';

export interface BriefSummary {
  briefId: string;
  topicId: string;
  kind: 'MINI_PROJECT' | 'MACHINE_CODING';
  title: string;
}

export const projectKeys = {
  briefs: ['projects', 'briefs'] as const,
  topic: (topicId: string) => ['projects', 'topic', topicId] as const,
  queue: ['projects', 'queue'] as const,
  review: (submissionId: string) => ['projects', 'review', submissionId] as const,
};

export function fetchBriefSummaries(): Promise<BriefSummary[]> {
  return apiRequest('/projects/briefs');
}

export function fetchProjectForTopic(topicId: string): Promise<ProjectView> {
  return apiRequest(`/projects/topics/${topicId}`);
}

export function submitProject(
  briefId: string,
  request: SubmitProjectRequest,
): Promise<ProjectView> {
  return apiRequest(`/projects/briefs/${briefId}/submit`, { method: 'POST', body: request });
}

export function addProjectMessage(submissionId: string, body: string): Promise<void> {
  return apiRequest(`/projects/submissions/${submissionId}/messages`, {
    method: 'POST',
    body: { body },
  });
}

// ── Instructor ──────────────────────────────────────────────────────────────

export function fetchProjectQueue(): Promise<ProjectQueueEntry[]> {
  return apiRequest('/cms/projects');
}

export function fetchReviewDetail(submissionId: string): Promise<ProjectReviewDetail> {
  return apiRequest(`/cms/projects/${submissionId}`);
}

export function startReview(submissionId: string): Promise<void> {
  return apiRequest(`/cms/projects/${submissionId}/start-review`, { method: 'POST' });
}

export function requestChanges(submissionId: string, message: string): Promise<void> {
  return apiRequest(`/cms/projects/${submissionId}/request-changes`, {
    method: 'POST',
    body: { message },
  });
}

export function approveProject(
  submissionId: string,
  request: ApproveProjectRequest,
): Promise<void> {
  return apiRequest(`/cms/projects/${submissionId}/approve`, { method: 'POST', body: request });
}

export function addReviewMessage(submissionId: string, body: string): Promise<void> {
  return apiRequest(`/cms/projects/${submissionId}/messages`, { method: 'POST', body: { body } });
}
