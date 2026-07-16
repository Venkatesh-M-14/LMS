/**
 * The LLM provider port. The mentor service depends only on this interface;
 * the Anthropic adapter and the deterministic fake both implement it, so the
 * whole feature is testable without a real API key.
 */

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmStreamResult {
  /** Async iterator of text deltas. */
  stream: AsyncIterable<string>;
  /** Resolves after the stream is fully consumed with final token usage. */
  usage: () => Promise<{ inputTokens: number; outputTokens: number }>;
}

export interface LlmProvider {
  /** True when the provider can actually serve requests (e.g. key present). */
  isConfigured(): boolean;
  streamReply(system: string, messages: LlmMessage[]): LlmStreamResult;
}
