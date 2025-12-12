import type { Agent, AgentTool } from './types.js';

export class AgentsManager {
  private agents = new Map<string, Agent>();

  registerAgent(agent: Agent): void {
    this.agents.set(agent.name, agent);
  }

  getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAllTools(): AgentTool[] {
    const allTools: AgentTool[] = [];
    for (const agent of this.agents.values()) {
      allTools.push(...agent.tools.values());
    }
    return allTools;
  }

  getToolByName(name: string): { agent: Agent; tool: AgentTool } | undefined {
    for (const agent of this.agents.values()) {
      const tool = agent.tools.get(name);
      if (tool) {
        return { agent, tool };
      }
    }
    return undefined;
  }
}
