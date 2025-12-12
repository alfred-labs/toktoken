import type { AnthropicRequest, AnthropicResponse, OpenAIRequest, OpenAIResponse, AnthropicContentBlock } from '../types/index.js';

export function convertAnthropicToOpenAI(request: AnthropicRequest): OpenAIRequest {
  const messages: OpenAIRequest['messages'] = [];

  if (request.system) {
    const systemContent = typeof request.system === 'string' 
      ? request.system 
      : request.system.map(b => b.text || '').join('\n');
    messages.push({ role: 'system', content: systemContent });
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

  // Convert Anthropic tools to OpenAI tools format
  let tools: OpenAIRequest['tools'];
  if (request.tools && request.tools.length > 0) {
    tools = request.tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  return {
    model: request.model,
    messages,
    max_tokens: request.max_tokens,
    temperature: request.temperature,
    stream: request.stream,
    tools,
  };
}

export function convertOpenAIToAnthropic(response: OpenAIResponse, originalModel: string): AnthropicResponse {
  const choice = response.choices[0];
  const content: AnthropicContentBlock[] = [];

  if (choice?.message?.content) {
    content.push({ type: 'text', text: choice.message.content });
  }

  // Convert OpenAI tool_calls to Anthropic tool_use blocks
  if (choice?.message?.tool_calls) {
    for (const toolCall of choice.message.tool_calls) {
      if (toolCall.type === 'function') {
        let input = {};
        try {
          input = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          // Keep empty object if parsing fails
        }
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input,
        } as AnthropicContentBlock);
      }
    }
  }

  return {
    id: response.id,
    type: 'message',
    role: 'assistant',
    content,
    model: originalModel,
    stop_reason: choice?.finish_reason === 'stop' ? 'end_turn' : (choice?.finish_reason === 'tool_calls' ? 'tool_use' : null),
    usage: {
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || 0,
    },
  };
}
