export type { Agent, AgentTool } from './types.js';
export { AgentsManager } from './manager.js';
export { WebSearchAgent, webSearchAgent } from './web-search.js';

import { AgentsManager } from './manager.js';
import { webSearchAgent } from './web-search.js';

// Default agents manager with web search agent
const agentsManager = new AgentsManager();
agentsManager.registerAgent(webSearchAgent);

export default agentsManager;
