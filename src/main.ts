import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { initAI, waitForAI } from "@obsidian-ai-providers/sdk";
import { streamText } from "ai";
import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { MCPManager } from "./mcp_manager.ts";

interface McpAgentPluginSettings {
  mySetting: string;
  mcpServers: Record<string, {
    command: string;
    args: string[];
  }>;
}

const DEFAULT_SETTINGS: McpAgentPluginSettings = {
  mySetting: "default",
  mcpServers: {
    filesystem: {
      command: "cmd",
      args: ["/c", "npx", "-y", "@modelcontextprotocol/server-filesystem", "~"],
    },
  },
};

export default class McpAgentPlugin extends Plugin {
  settings: McpAgentPluginSettings = DEFAULT_SETTINGS;

  override async onload() {
    await this.loadSettings();

    initAI(this.app, this, async () => {
      const aiResolver = await waitForAI();
      const aiProviders = await aiResolver.promise;
      console.log("AI Providers:", aiProviders);

      const { apiKey, model: modelId } = aiProviders.providers[0];
      const google = createGoogleGenerativeAI({ apiKey });
      const model = google(modelId!);

      const mcpManager = new MCPManager(this.settings.mcpServers);
      const tools = await mcpManager.listTools();
      console.log("Tools:", tools);

      const abortController = new AbortController();
      const result = streamText({
        model,
        tools,
        messages: [{
          role: "user",
          content:
            "List the files in ./, then research the Obsidian.exe's size",
        }],
        onFinish: async () => {
          console.log("Finished streaming text");
          await mcpManager.close();
        },
        maxSteps: 10,
        abortSignal: abortController.signal,
      });

      for await (const part of result.fullStream) {
        if (part.type === "tool-call") {
          if (!confirm("Tool call:" + part.toolName)) {
            abortController.abort();
            await mcpManager.close();
            break;
          }
        }

        console.log("Part:", part);
      }

      this.addSettingTab(new McpAgentSettingTab(this.app, this));
    });
  }

  override onunload() {
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class McpAgentSettingTab extends PluginSettingTab {
  plugin: McpAgentPlugin;

  constructor(app: App, plugin: McpAgentPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Setting #1")
      .setDesc("It's a secret")
      .addText((text) =>
        text
          .setPlaceholder("Enter your secret")
          .setValue(this.plugin.settings.mySetting)
          .onChange(async (value) => {
            this.plugin.settings.mySetting = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
