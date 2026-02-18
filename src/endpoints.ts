import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Types ────────────────────────────────────────────────────────────────────

export interface EndpointSpec {
  multiPath: boolean;
  type: OscMessageType;
  argumentType: "float" | "integer" | "string" | null;
  description: string;
  isAbsolute?: boolean;
}

export type OscMessageType =
  | "enPPCFaderMessage"
  | "enPPCRotaryMessage"
  | "enPPCSwitchMessage"
  | "enPPCStringMessage"
  | "enPPCMeterMessage"
  | "enPPCOtherMessage";

export interface GroupInfo {
  name: string;
  endpointCount: number;
  messageTypes: Record<string, number>;
}

export interface SearchResult {
  group: string;
  endpoint: string;
  spec: EndpointSpec;
  oscPath: string;
}

// ── Data Store ───────────────────────────────────────────────────────────────

type EndpointStore = Record<string, Record<string, EndpointSpec>>;

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJson(filename: string): EndpointStore {
  const filePath = resolve(__dirname, "..", "data", filename);
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as EndpointStore;
}

let mainEndpoints: EndpointStore | null = null;
let fxEndpoints: EndpointStore | null = null;

function getMainEndpoints(): EndpointStore {
  if (!mainEndpoints) {
    mainEndpoints = loadJson("pro-series-endpoints.json");
  }
  return mainEndpoints;
}

function getFxEndpoints(): EndpointStore {
  if (!fxEndpoints) {
    fxEndpoints = loadJson(
      "pro-series-internal-fx-parameters-endpoints.json"
    );
  }
  return fxEndpoints;
}

function getAllEndpoints(): EndpointStore {
  return { ...getMainEndpoints(), ...getFxEndpoints() };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * List all control groups with summary info.
 */
export function listGroups(): GroupInfo[] {
  const all = getAllEndpoints();
  return Object.entries(all).map(([name, endpoints]) => {
    const messageTypes: Record<string, number> = {};
    for (const spec of Object.values(endpoints)) {
      messageTypes[spec.type] = (messageTypes[spec.type] ?? 0) + 1;
    }
    return {
      name,
      endpointCount: Object.keys(endpoints).length,
      messageTypes,
    };
  });
}

/**
 * List all endpoints within a specific group.
 */
export function listEndpoints(
  group: string
): { endpoint: string; spec: EndpointSpec }[] | null {
  const all = getAllEndpoints();
  const groupData = all[group];
  if (!groupData) return null;

  return Object.entries(groupData).map(([endpoint, spec]) => ({
    endpoint,
    spec,
  }));
}

/**
 * Get detailed info for a single endpoint.
 */
export function getEndpointInfo(
  group: string,
  endpoint: string
): EndpointSpec | null {
  const all = getAllEndpoints();
  return all[group]?.[endpoint] ?? null;
}

/**
 * Build the full OSC path for a command.
 */
export function buildOscPath(
  group: string,
  endpoint: string,
  index?: number
): string | null {
  const spec = getEndpointInfo(group, endpoint);
  if (!spec) return null;

  // The OSC path format: /messageType/group/endpoint[/index]
  let path = `/${spec.type}/${group}/${endpoint}`;
  if (spec.multiPath && index !== undefined) {
    path += `/${index}`;
  }
  return path;
}

/**
 * Search across all endpoints by keyword. Matches against endpoint names,
 * descriptions, group names, and message types.
 */
export function searchEndpoints(
  query: string,
  options?: { group?: string; type?: OscMessageType }
): SearchResult[] {
  const all = getAllEndpoints();
  const terms = query.toLowerCase().split(/\s+/);
  const results: SearchResult[] = [];

  for (const [groupName, endpoints] of Object.entries(all)) {
    // Filter by group if specified
    if (options?.group && groupName !== options.group) continue;

    for (const [endpointName, spec] of Object.entries(endpoints)) {
      // Filter by type if specified
      if (options?.type && spec.type !== options.type) continue;

      // Build a searchable string from all fields
      const searchable = [
        groupName,
        endpointName,
        spec.description,
        spec.type,
      ]
        .join(" ")
        .toLowerCase();

      // All search terms must match
      if (terms.every((term) => searchable.includes(term))) {
        results.push({
          group: groupName,
          endpoint: endpointName,
          spec,
          oscPath: `/${spec.type}/${groupName}/${endpointName}`,
        });
      }
    }
  }

  return results;
}

/**
 * Get all valid group names.
 */
export function getGroupNames(): string[] {
  return Object.keys(getAllEndpoints());
}

/**
 * Get stats about the endpoint database.
 */
export function getStats(): {
  totalGroups: number;
  totalEndpoints: number;
  documentedEndpoints: number;
  byMessageType: Record<string, number>;
} {
  const all = getAllEndpoints();
  let totalEndpoints = 0;
  let documentedEndpoints = 0;
  const byMessageType: Record<string, number> = {};

  for (const endpoints of Object.values(all)) {
    for (const spec of Object.values(endpoints)) {
      totalEndpoints++;
      byMessageType[spec.type] = (byMessageType[spec.type] ?? 0) + 1;
      if (spec.description && !spec.description.includes("(unknown)")) {
        documentedEndpoints++;
      }
    }
  }

  return {
    totalGroups: Object.keys(all).length,
    totalEndpoints,
    documentedEndpoints,
    byMessageType,
  };
}
