import type {
  CreateSuggestionRequest,
  ReviewSuggestionRequest,
  SuggestionStatus,
  SuggestionView,
} from '@academy/shared';
import { apiRequest } from '../../shared/api/client';

export const suggestionKeys = {
  mine: ['suggestions', 'mine'] as const,
  inbox: (status: SuggestionStatus | 'ALL') => ['suggestions', 'inbox', status] as const,
};

export function fetchMySuggestions(): Promise<SuggestionView[]> {
  return apiRequest('/suggestions');
}

export function submitSuggestion(request: CreateSuggestionRequest): Promise<SuggestionView> {
  return apiRequest('/suggestions', { method: 'POST', body: request });
}

export function fetchSuggestionInbox(status: SuggestionStatus | 'ALL'): Promise<SuggestionView[]> {
  const query = status === 'ALL' ? '' : `?status=${status}`;
  return apiRequest(`/cms/suggestions${query}`);
}

export function reviewSuggestion(
  id: string,
  request: ReviewSuggestionRequest,
): Promise<void> {
  return apiRequest(`/cms/suggestions/${id}/review`, { method: 'POST', body: request });
}
