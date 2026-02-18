#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";
import { registerControlTools } from "./tools/control.js";

// ── Server Setup ─────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "midas-pro",
  version: "0.1.0",
});

// ── Register Tools ───────────────────────────────────────────────────────────

// Phase 1: Knowledge base - browse and search the OSC command database
registerKnowledgeTools(server);

// Phase 2: Live control - connect to and control a real console
registerControlTools(server);

// ── Auto-connect if configured via MCPB user_config ─────────────────────────

const configIp = process.env.MIDAS_IP;
const configPort = process.env.MIDAS_PORT;

if (configIp && configIp.length > 0) {
  // Import the client for auto-connect
  const { midasClient } = await import("./osc-client.js");
  const port = configPort ? parseInt(configPort, 10) : 10023;
  try {
    await midasClient.connect(configIp, port);
    console.error(`[midas-pro] Auto-connected to ${configIp}:${port}`);
  } catch (err) {
    console.error(
      `[midas-pro] Auto-connect failed: ${err instanceof Error ? err.message : err}`
    );
  }
}

// ── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
