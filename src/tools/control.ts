import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { midasClient } from "../osc-client.js";
import { getEndpointInfo, buildOscPath } from "../endpoints.js";

/**
 * Register all Phase 2 live-control tools on the MCP server.
 */
export function registerControlTools(server: McpServer): void {
  // ── connect ──────────────────────────────────────────────────────────────

  server.tool(
    "connect",
    "Connect to a Midas Pro Series console on the network. You must connect before using get_value or set_value. Requires the console's IP address. Default OSC port is 10023.",
    {
      ip: z.string().describe("IP address of the Midas console (e.g. 192.168.1.100)"),
      port: z
        .number()
        .int()
        .optional()
        .default(10023)
        .describe("OSC port (default: 10023)"),
      listen_port: z
        .number()
        .int()
        .optional()
        .default(10024)
        .describe("Local port for receiving responses (default: 10024)"),
    },
    async ({ ip, port, listen_port }) => {
      try {
        await midasClient.connect(ip, port, listen_port);
        return {
          content: [
            {
              type: "text" as const,
              text: `Connected to Midas console at ${ip}:${port}\nListening for responses on port ${listen_port}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to connect: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ── disconnect ───────────────────────────────────────────────────────────

  server.tool(
    "disconnect",
    "Disconnect from the Midas console.",
    {},
    async () => {
      await midasClient.disconnect();
      return {
        content: [
          { type: "text" as const, text: "Disconnected from Midas console." },
        ],
      };
    }
  );

  // ── connection_status ────────────────────────────────────────────────────

  server.tool(
    "connection_status",
    "Check whether the MCP server is currently connected to a Midas console, and if so, which one.",
    {},
    async () => {
      if (!midasClient.isConnected) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Not connected to any console. Use the connect tool to connect.",
            },
          ],
        };
      }
      const info = midasClient.connectionInfo!;
      return {
        content: [
          {
            type: "text" as const,
            text: `Connected to ${info.ip}:${info.port}\nListening on port ${info.listenPort}`,
          },
        ],
      };
    }
  );

  // ── get_value ────────────────────────────────────────────────────────────

  server.tool(
    "get_value",
    "Read the current value of a parameter from the connected Midas console. Sends an OSC query and waits for the response. Works for all endpoint types including meters.",
    {
      group: z.string().describe("Control group name (e.g. enVirtualMicInputs)"),
      endpoint: z.string().describe("Endpoint/parameter name"),
      index: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Channel/instance index (0-based) for multi-path endpoints"),
    },
    async ({ group, endpoint, index }) => {
      if (!midasClient.isConnected) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Not connected. Use the connect tool first.",
            },
          ],
          isError: true,
        };
      }

      try {
        const response = await midasClient.getValue(group, endpoint, index);
        const path = buildOscPath(group, endpoint, index);

        if (!response) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No response received for ${path} within timeout. The console may not support this query, or the response port may be misconfigured.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `Path: ${response.address}`,
                `Value: ${JSON.stringify(response.args)}`,
              ].join("\n"),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ── set_value ────────────────────────────────────────────────────────────

  server.tool(
    "set_value",
    "Set a parameter value on the connected Midas console. Sends an OSC message with the appropriate argument type. Float values are clamped to 0-1 range. DANGEROUS commands (reboot, reset) are blocked and flagged.",
    {
      group: z.string().describe("Control group name"),
      endpoint: z.string().describe("Endpoint/parameter name"),
      value: z
        .union([z.number(), z.string()])
        .describe(
          "Value to set. Float 0-1 for faders/rotaries, 0 or 1 for switches, string for labels."
        ),
      index: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Channel/instance index (0-based) for multi-path endpoints"),
    },
    async ({ group, endpoint, value, index }) => {
      if (!midasClient.isConnected) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Not connected. Use the connect tool first.",
            },
          ],
          isError: true,
        };
      }

      // Safety gate for dangerous commands
      if (midasClient.isDangerous(endpoint)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `BLOCKED: "${endpoint}" is a potentially destructive command (could reboot or reset the console). This command requires manual confirmation. If you really intend to do this, please confirm explicitly.`,
            },
          ],
          isError: true,
        };
      }

      try {
        const spec = getEndpointInfo(group, endpoint);
        if (!spec) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Endpoint "${endpoint}" not found in group "${group}".`,
              },
            ],
            isError: true,
          };
        }

        await midasClient.setValue(group, endpoint, value, index);
        const path = buildOscPath(group, endpoint, index);

        return {
          content: [
            {
              type: "text" as const,
              text: `Sent: ${path} = ${JSON.stringify(value)}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
