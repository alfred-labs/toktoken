# PR Summary: Web Search Tool Redirection & MCP Compatibility

## Overview

This PR implements web search tool redirection and improves MCP (Model Context Protocol) compatibility. When Claude Code uses the deprecated `WebSearch` tool, it is redirected to use MCP tools like `brave_web_search`.

## Features

### Web Search Agent
- **System prompt injection**: Guides the model to use MCP web search tools
- **Tool interception**: Intercepts deprecated `WebSearch` tool calls and returns guidance
- **MCP tool support**: Supports `brave_web_search`, `tavily_search`, `exa_search`

### Permissive Type System
- **Removed Zod validation** from Fastify routes for MCP compatibility
- **Permissive types**: Accept any MCP content format (arrays, objects, strings)
- **Content sanitization**: Converts complex `tool_result` content to JSON strings for vLLM

### Model Auto-Discovery
- **Automatic model fallback**: If configured model doesn't exist, uses first available model
- **Empty model handling**: Detects empty string models and falls back to discovered model

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `VLLM_URL` | `http://localhost:8000` | Backend URL |
| `VLLM_API_KEY` | - | Backend API key |
| `VLLM_MODEL` | auto-discovered | Model name (falls back to first available) |

## Files Changed

### New Files
- `src/agents/types.ts` - Agent and AgentTool interfaces
- `src/agents/web-search.ts` - WebSearchAgent implementation
- `src/agents/manager.ts` - AgentsManager for registering agents
- `src/agents/index.ts` - Agents module exports
- `src/transform/sanitize-content.ts` - Content sanitization for vLLM
- `tests/agents/web-search.test.ts` - Web search agent tests
- `tests/transform/sanitize-content.test.ts` - Sanitization tests

### Modified Files
- `src/types/anthropic.ts` - Permissive types without Zod (MCP compatible)
- `src/types/openai.ts` - Permissive types without Zod
- `src/types/index.ts` - Updated exports
- `src/index.ts` - Removed Zod validation from routes
- `src/router.ts` - Integrated agents and content sanitization
- `src/init.ts` - Added model discovery logging and empty model handling
- `src/handlers/routes.ts` - Removed Zod type provider

## Test Coverage

```
All files          |   98.58% Stmts | 92.27% Branch | 100% Funcs
```

- 200 tests passing
- Coverage exceeds thresholds

## Usage Example

```bash
# Start server with vLLM backend
VLLM_URL=https://inference.sir-alfred.io \
VLLM_API_KEY=your-api-key \
npm run dev
```

When Claude Code tries to use `WebSearch`:
```
> check on web how datadog custom metrics are charged
```

The agent redirects to MCP tools:
```
Use brave_web_search(query: "datadog custom metrics pricing")
```

## Architecture

```
Request → Fastify (no validation) → AgentsManager.processRequest()
        → sanitizeMessageContent() → Backend
```

The agents system:
1. Injects system prompt for web search guidance
2. Intercepts deprecated tool calls
3. Returns helpful error messages with MCP alternatives
