import type {
  AssessmentSummary,
  AttemptInProgress,
  AttemptResult,
  AttemptView,
} from '@academy/shared';
import { apiRequest } from '../../shared/api/client';

export const quizKeys = {
  summary: (lessonId: string) => ['quiz', 'summary', lessonId] as const,
  attempt: (attemptId: string) => ['quiz', 'attempt', attemptId] as const,
};

export function fetchQuizSummary(lessonId: string): Promise<AssessmentSummary | null> {
  return apiRequest(`/assessments/lessons/${lessonId}/summary`);
}

export function startAttempt(assessmentId: string): Promise<AttemptInProgress> {
  return apiRequest(`/assessments/${assessmentId}/attempts`, { method: 'POST' });
}

export function fetchAttempt(attemptId: string): Promise<AttemptView> {
  return apiRequest(`/assessments/attempts/${attemptId}`);
}

export function saveAnswers(attemptId: string, answers: Record<string, unknown>): Promise<void> {
  return apiRequest(`/assessments/attempts/${attemptId}/answers`, {
    method: 'PUT',
    body: { answers },
  });
}

export function submitAttempt(
  attemptId: string,
  answers: Record<string, unknown>,
): Promise<AttemptResult> {
  return apiRequest(`/assessments/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: { answers },
  });
}
