import type { RevisionAssignmentView } from '@academy/shared';
import { apiRequest } from '../../shared/api/client';

export const adaptiveKeys = {
  revisions: ['adaptive', 'revisions'] as const,
};

export function fetchRevisions(): Promise<RevisionAssignmentView[]> {
  return apiRequest('/adaptive/revisions');
}
