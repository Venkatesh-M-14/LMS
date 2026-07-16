import type { LlmMessage, LlmProvider, LlmStreamResult } from '../application/llmProvider';

/**
 * Deterministic mentor for dev and CI — no API key, no network. It echoes a
 * canned tutor-style reply that references the latest question and, when the
 * system prompt carries lesson grounding, notes the lesson. Token usage is
 * estimated from text length so budget logic is still exercised.
 */
export class FakeMentorProvider implements LlmProvider {
  isConfigured(): boolean {
    return true;
  }

  streamReply(system: string, messages: LlmMessage[]): LlmStreamResult {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const grounded = /Lesson context:/.test(system);
    const reply = [
      `Great question! Let me help you think it through.`,
      lastUser ? `You asked: "${truncate(lastUser.content, 120)}".` : '',
      grounded
        ? `Based on this lesson, focus on the core idea first, then work an example by hand.`
        : `Break the problem into the smallest step you can verify, then build up.`,
      `Try explaining it back in your own words — that's the fastest way to find the gap.`,
    ]
      .filter(Boolean)
      .join(' ');

    async function* deltas(): AsyncIterable<string> {
      for (const word of reply.split(' ')) {
        yield word + ' ';
      }
    }

    const inputText = system + messages.map((m) => m.content).join(' ');
    return {
      stream: deltas(),
      usage: async () => ({
        inputTokens: estimateTokens(inputText),
        outputTokens: estimateTokens(reply),
      }),
    };
  }
}

/** Absent-key placeholder: reports itself unconfigured so the API 409s cleanly. */
export class UnconfiguredMentorProvider implements LlmProvider {
  isConfigured(): boolean {
    return false;
  }
  streamReply(): LlmStreamResult {
    throw new Error('Mentor provider is not configured');
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/** ~4 characters per token is a good rough estimate for English. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
