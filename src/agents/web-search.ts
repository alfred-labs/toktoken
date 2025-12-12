import type { AnthropicRequest } from '../types/index.js';
import type { Agent, AgentTool } from './types.js';

const WEB_SEARCH_SYSTEM_PROMPT = `# Web Search Guidelines

You have access to MCP web search tools. Use them for current information:

## Available MCP Search Tools

- **brave_web_search**: Search the web using Brave Search API
- **brave_local_search**: Search for local businesses and places
- **tavily_search**: Alternative web search via Tavily API
- **exa_search**: Semantic web search via Exa API

## When to Use Web Search

You MUST use a web search MCP tool when the user asks for:
- Latest versions, releases, or updates
- Current pricing, costs, or billing information
- Recent news, events, or developments
- Documentation, tutorials, or guides
- Comparisons, reviews, or evaluations
- Any information that may be outdated in your training data
- Real-time or location-specific information

## Important Rules

- ALWAYS use an MCP search tool for queries requiring current information
- Do NOT use deprecated "WebSearch" tool - use MCP tools instead
- Do NOT answer from memory when a search is appropriate
- Formulate clear, specific search queries
- Cite sources when providing information from searches

## Example Usage

To search for "latest Node.js version":
\`\`\`
brave_web_search(query: "latest Node.js LTS version 2024")
\`\`\`

Follow these guidelines EXACTLY.`;

export class WebSearchAgent implements Agent {
  name = 'web-search';
  tools: Map<string, AgentTool>;

  constructor() {
    this.tools = new Map<string, AgentTool>();
    this.registerTools();
  }

  private registerTools(): void {
    // Intercept legacy WebSearch calls and redirect to MCP
    this.tools.set('WebSearch', {
      name: 'WebSearch',
      description: 'DEPRECATED: Use brave_web_search or other MCP search tools instead',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
      handler: async (args) => {
        const query = args.query as string;
        return `ERROR: WebSearch tool is deprecated.

Please use one of these MCP search tools instead:
- brave_web_search(query: "${query}")
- tavily_search(query: "${query}")
- exa_search(query: "${query}")

To configure MCP search:
1. Add a search MCP server to your Claude configuration
2. Use the MCP tool directly instead of WebSearch

See: https://modelcontextprotocol.io/`;
      },
    });
  }

  shouldHandle(request: AnthropicRequest): boolean {
    // Always handle to inject web search guidance
    return request.messages?.length > 0;
  }

  processRequest(request: AnthropicRequest): AnthropicRequest {
    // Convert system to string format for vLLM compatibility
    let existingSystem = '';
    
    if (typeof request.system === 'string') {
      existingSystem = request.system;
    } else if (Array.isArray(request.system)) {
      existingSystem = request.system
        .map(block => block.text || '')
        .filter(Boolean)
        .join('\n\n');
    }

    const newSystem = existingSystem
      ? `${existingSystem}\n\n${WEB_SEARCH_SYSTEM_PROMPT}`
      : WEB_SEARCH_SYSTEM_PROMPT;

    return {
      ...request,
      system: newSystem,
    };
  }
}

export const webSearchAgent = new WebSearchAgent();
