import Anthropic from '@anthropic-ai/sdk';
import type { LlmMessage, LlmProvider, LlmStreamResult } from '../application/llmProvider';

interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  maxTokens?: number;
}

/**
 * The real mentor backend: Anthropic Messages API with streaming. The system
 * prompt carries the tutoring persona and any lesson grounding; message
 * history is the prior conversation.
 */
export class AnthropicProvider implements LlmProvider {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(options: AnthropicProviderOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model;
    this.maxTokens = options.maxTokens ?? 1024;
  }

  isConfigured(): boolean {
    return true;
  }

  streamReply(system: string, messages: LlmMessage[]): LlmStreamResult {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    async function* deltas(): AsyncIterable<string> {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
    }

    return {
      stream: deltas(),
      usage: async () => {
        const final = await stream.finalMessage();
        return {
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
        };
      },
    };
  }
}
