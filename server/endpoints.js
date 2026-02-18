import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadJson(filename) {
    const filePath = resolve(__dirname, "..", "data", filename);
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
}
let mainEndpoints = null;
let fxEndpoints = null;
function getMainEndpoints() {
    if (!mainEndpoints) {
        mainEndpoints = loadJson("pro-series-endpoints.json");
    }
    return mainEndpoints;
}
function getFxEndpoints() {
    if (!fxEndpoints) {
        fxEndpoints = loadJson("pro-series-internal-fx-parameters-endpoints.json");
    }
    return fxEndpoints;
}
function getAllEndpoints() {
    return { ...getMainEndpoints(), ...getFxEndpoints() };
}
// ── Public API ───────────────────────────────────────────────────────────────
/**
 * List all control groups with summary info.
 */
export function listGroups() {
    const all = getAllEndpoints();
    return Object.entries(all).map(([name, endpoints]) => {
        const messageTypes = {};
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
export function listEndpoints(group) {
    const all = getAllEndpoints();
    const groupData = all[group];
    if (!groupData)
        return null;
    return Object.entries(groupData).map(([endpoint, spec]) => ({
        endpoint,
        spec,
    }));
}
/**
 * Get detailed info for a single endpoint.
 */
export function getEndpointInfo(group, endpoint) {
    const all = getAllEndpoints();
    return all[group]?.[endpoint] ?? null;
}
/**
 * Build the full OSC path for a command.
 */
export function buildOscPath(group, endpoint, index) {
    const spec = getEndpointInfo(group, endpoint);
    if (!spec)
        return null;
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
export function searchEndpoints(query, options) {
    const all = getAllEndpoints();
    const terms = query.toLowerCase().split(/\s+/);
    const results = [];
    for (const [groupName, endpoints] of Object.entries(all)) {
        // Filter by group if specified
        if (options?.group && groupName !== options.group)
            continue;
        for (const [endpointName, spec] of Object.entries(endpoints)) {
            // Filter by type if specified
            if (options?.type && spec.type !== options.type)
                continue;
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
export function getGroupNames() {
    return Object.keys(getAllEndpoints());
}
/**
 * Get stats about the endpoint database.
 */
export function getStats() {
    const all = getAllEndpoints();
    let totalEndpoints = 0;
    let documentedEndpoints = 0;
    const byMessageType = {};
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
//# sourceMappingURL=endpoints.js.map