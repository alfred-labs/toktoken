import type { AnthropicRequest, AnthropicResponse, OpenAIRequest, OpenAIResponse, AnthropicContentBlock } from '../types/index.js';

export function convertAnthropicToOpenAI(request: AnthropicRequest): OpenAIRequest {
  const messages: OpenAIRequest['messages'] = [];

  if (request.system) {
    messages.push({ role: 'system', content: request.system });
  }

  for (const msg of request.messages) {
    if (typeof msg.content === 'string') {
      messages.push({ role: msg.role, content: msg.content });
    } else {
      const content: { type: string; text?: string; image_url?: { url: string } }[] = [];
      for (const block of msg.content) {
        if (block.type === 'text') {
          content.push({ type: 'text', text: block.text || '' });
        } else if (block.type === 'image' && block.source) {
          content.push({
            type: 'image_url',
            image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` }
          });
        }
      }
      messages.push({ role: msg.role, content });
    }
  }

  return {
    model: request.model,
    messages,
    max_tokens: request.max_tokens,
    temperature: request.temperature,
    stream: request.stream,
  };
}

export function convertOpenAIToAnthropic(response: OpenAIResponse, originalModel: string): AnthropicResponse {
  const choice = response.choices[0];
  const content: AnthropicContentBlock[] = [];

  if (choice?.message?.content) {
    content.push({ type: 'text', text: choice.message.content });
  }

  return {
    id: response.id,
    type: 'message',
    role: 'assistant',
    content,
    model: originalModel,
    stop_reason: choice?.finish_reason === 'stop' ? 'end_turn' : null,
    usage: {
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || 0,
    },
  };
}
