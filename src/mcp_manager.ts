import { experimental_createMCPClient as createMCPClient } from "ai";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "ai/mcp-stdio";

type MCPServer = { command: string; args: string[] };
type MCPClient = Awaited<ReturnType<typeof createMCPClient>>;
type MCPTools = Awaited<ReturnType<MCPClient["tools"]>>;
type MCPTool = MCPTools[string];

export class MCPManager {
  mcpServers: Record<string, MCPServer> = {};
  mcpClients: Record<string, Promise<MCPClient>> = {};

  constructor(mcpServers: Record<string, MCPServer>) {
    this.mcpServers = mcpServers;

    for (const [name, server] of Object.entries(mcpServers)) {
      this.mcpClients[name] = createMCPClient({
        name: name,
        transport: new StdioMCPTransport({
          command: server.command,
          args: server.args,
        }),
      });
    }
  }

  async listTools(): Promise<MCPTools> {
    const allTools = await Promise.all(
      Object.keys(this.mcpServers).map(async (name) => {
        return await (await this.mcpClients[name]).tools();
      }),
    );

    const tools = allTools.reduce((acc, tool) => {
      return { ...acc, ...tool };
    }, {} as MCPTools);

    return tools;
  }

  async close() {
    await Promise.all(
      Object.keys(this.mcpClients).map(async (name) => {
        const client = await this.mcpClients[name];
        await client.close();
      }),
    );
  }
}
