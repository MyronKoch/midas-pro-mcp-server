import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  listGroups,
  listEndpoints,
  getEndpointInfo,
  buildOscPath,
  searchEndpoints,
  getStats,
  type OscMessageType,
} from "../endpoints.js";

/**
 * Register all Phase 1 knowledge-base tools on the MCP server.
 */
export function registerKnowledgeTools(server: McpServer): void {
  // ── list_groups ──────────────────────────────────────────────────────────

  server.tool(
    "list_groups",
    "List all Midas Pro Series control groups (e.g. VirtualMicInputs, VirtualMasters, VirtualGEQPool) with endpoint counts and message type breakdowns. Start here to explore what the console can do.",
    {},
    async () => {
      const groups = listGroups();
      const stats = getStats();

      const lines = [
        `Midas Pro Series OSC Command Database`,
        `${stats.totalGroups} groups | ${stats.totalEndpoints} total endpoints | ${stats.documentedEndpoints} documented`,
        ``,
        `Message types:`,
        ...Object.entries(stats.byMessageType).map(
          ([type, count]) => `  ${type}: ${count}`
        ),
        ``,
        `Control Groups:`,
        `${"─".repeat(70)}`,
      ];

      for (const group of groups) {
        const typeStr = Object.entries(group.messageTypes)
          .map(([t, c]) => `${t.replace("enPPC", "").replace("Message", "")}: ${c}`)
          .join(", ");
        lines.push(`  ${group.name} (${group.endpointCount} endpoints)`);
        lines.push(`    Types: ${typeStr}`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );

  // ── list_endpoints ───────────────────────────────────────────────────────

  server.tool(
    "list_endpoints",
    "List all endpoints in a specific control group with their descriptions, types, and argument info. Use list_groups first to see available groups.",
    {
      group: z.string().describe("Control group name (e.g. enVirtualMicInputs)"),
    },
    async ({ group }) => {
      const endpoints = listEndpoints(group);
      if (!endpoints) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Group "${group}" not found. Use list_groups to see available groups.`,
            },
          ],
          isError: true,
        };
      }

      const lines = [
        `Group: ${group} (${endpoints.length} endpoints)`,
        `${"─".repeat(70)}`,
      ];

      for (const { endpoint, spec } of endpoints) {
        const readOnly = spec.argumentType === null ? " [READ-ONLY]" : "";
        const multi = spec.multiPath ? " [indexed]" : "";
        const typeShort = spec.type.replace("enPPC", "").replace("Message", "");
        lines.push(
          `  ${endpoint}${readOnly}${multi}`,
          `    Type: ${typeShort} | Arg: ${spec.argumentType ?? "none"} | ${spec.description}`,
          ``
        );
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );

  // ── search_endpoints ─────────────────────────────────────────────────────

  server.tool(
    "search_endpoints",
    "Search across all 4,596 endpoints by keyword. Matches endpoint names, descriptions, group names, and message types. Use this to find the right command for what you want to control (e.g. 'fader', 'mute', 'eq frequency', 'label').",
    {
      query: z.string().describe("Search keywords (e.g. 'fader level', 'eq bass', 'mute')"),
      group: z
        .string()
        .optional()
        .describe("Limit search to a specific group"),
      type: z
        .enum([
          "enPPCFaderMessage",
          "enPPCRotaryMessage",
          "enPPCSwitchMessage",
          "enPPCStringMessage",
          "enPPCMeterMessage",
          "enPPCOtherMessage",
        ])
        .optional()
        .describe("Filter by message type"),
    },
    async ({ query, group, type }) => {
      const results = searchEndpoints(query, {
        group,
        type: type as OscMessageType | undefined,
      });

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No endpoints found for "${query}". Try broader keywords or check spelling.`,
            },
          ],
        };
      }

      // Cap at 50 results to avoid overwhelming output
      const capped = results.slice(0, 50);
      const lines = [
        `Found ${results.length} endpoint${results.length === 1 ? "" : "s"} matching "${query}"${results.length > 50 ? ` (showing first 50)` : ""}`,
        `${"─".repeat(70)}`,
      ];

      for (const r of capped) {
        const readOnly = r.spec.argumentType === null ? " [READ-ONLY]" : "";
        const multi = r.spec.multiPath ? "/N" : "";
        lines.push(
          `  ${r.oscPath}${multi}${readOnly}`,
          `    Group: ${r.group} | Arg: ${r.spec.argumentType ?? "none"}`,
          `    ${r.spec.description}`,
          ``
        );
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );

  // ── get_endpoint_info ────────────────────────────────────────────────────

  server.tool(
    "get_endpoint_info",
    "Get complete details for a specific endpoint including its OSC path, message type, argument type, whether it supports multiple instances, and its description.",
    {
      group: z.string().describe("Control group name"),
      endpoint: z.string().describe("Endpoint/parameter name within the group"),
    },
    async ({ group, endpoint }) => {
      const spec = getEndpointInfo(group, endpoint);
      if (!spec) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Endpoint "${endpoint}" not found in group "${group}". Use search_endpoints to find it.`,
            },
          ],
          isError: true,
        };
      }

      const oscPath = buildOscPath(group, endpoint);
      const lines = [
        `Endpoint: ${group}/${endpoint}`,
        `${"─".repeat(50)}`,
        `OSC Path:      ${oscPath}${spec.multiPath ? "/<index>" : ""}`,
        `Message Type:  ${spec.type}`,
        `Argument Type: ${spec.argumentType ?? "none (read-only)"}`,
        `Multi-Path:    ${spec.multiPath ? "Yes (append channel/instance index)" : "No (single instance)"}`,
        `Description:   ${spec.description}`,
      ];

      if (spec.isAbsolute !== undefined) {
        lines.push(
          `Absolute:      ${spec.isAbsolute ? "Yes (sets value directly, not toggle)" : "No (toggle behavior)"}`
        );
      }

      // Add usage hints based on message type
      lines.push("", "Usage:");
      switch (spec.type) {
        case "enPPCFaderMessage":
          lines.push(
            "  Send a float between 0.0 and 1.0 (exclusive).",
            "  Example: 0.75 = ~75% fader position"
          );
          break;
        case "enPPCRotaryMessage":
          lines.push(
            "  Send a float between 0.0 and 1.0 (inclusive).",
            "  The float maps to the control's range (e.g. 20Hz-20kHz for frequency).",
            "  Value mapping depends on the specific parameter."
          );
          break;
        case "enPPCSwitchMessage":
          lines.push(
            spec.isAbsolute
              ? "  Send 0 (off) or 1 (on) to set state directly."
              : "  Send 1 to TOGGLE the switch. (Most switches are toggles, not absolute.)"
          );
          break;
        case "enPPCStringMessage":
          lines.push("  Send a string value (e.g. channel label).");
          break;
        case "enPPCMeterMessage":
          lines.push(
            "  READ-ONLY. Send with no arguments to get current meter value.",
            "  Returns a float between 0.0 and 1.0."
          );
          break;
      }

      if (spec.multiPath) {
        lines.push(
          "",
          "Indexing:",
          "  Append /<index> to the OSC path (0-based).",
          "  Example: .../0 = first instance (input 1, channel 1, etc.)"
        );
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );

  // ── build_osc_command ────────────────────────────────────────────────────

  server.tool(
    "build_osc_command",
    "Construct the complete OSC path string for a command, ready to send. Validates the group, endpoint, and index. Returns the exact path you would send over UDP.",
    {
      group: z.string().describe("Control group name"),
      endpoint: z.string().describe("Endpoint/parameter name"),
      index: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Channel/instance index (0-based). Required for multi-path endpoints."),
    },
    async ({ group, endpoint, index }) => {
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

      if (spec.multiPath && index === undefined) {
        return {
          content: [
            {
              type: "text" as const,
              text: `This endpoint requires an index (0-based) because it controls multiple instances. Add an index parameter.`,
            },
          ],
          isError: true,
        };
      }

      const path = buildOscPath(group, endpoint, index)!;

      const lines = [
        `OSC Path: ${path}`,
        ``,
        `To GET current value: Send ${path} with no arguments`,
      ];

      if (spec.argumentType) {
        lines.push(`To SET value: Send ${path} with ${spec.argumentType} argument`);
      } else {
        lines.push(`This endpoint is read-only (no SET operation).`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
