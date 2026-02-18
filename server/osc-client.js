import { Client, Message, Server } from "node-osc";
import { getEndpointInfo, buildOscPath } from "./endpoints.js";
// ── Dangerous commands that require explicit confirmation ─────────────────────
const DANGEROUS_ENDPOINTS = new Set([
    "enRebootConsole",
    "enResetGlobalsToDefault",
]);
// ── OSC Client ───────────────────────────────────────────────────────────────
export class MidasOscClient {
    client = null;
    listener = null;
    config = null;
    responseBuffer = new Map();
    get isConnected() {
        return this.client !== null;
    }
    get connectionInfo() {
        return this.config;
    }
    /**
     * Connect to a Midas console.
     */
    async connect(ip, port = 10023, listenPort = 10024) {
        if (this.client) {
            await this.disconnect();
        }
        this.config = { ip, port, listenPort };
        this.client = new Client(ip, port);
        // Start a listener for responses (meter reads, value queries)
        this.listener = new Server(listenPort, "0.0.0.0");
        this.listener.on("message", (msg) => {
            const [address, ...args] = msg;
            this.responseBuffer.set(address, {
                address: address,
                args,
                timestamp: Date.now(),
            });
        });
    }
    /**
     * Disconnect from the console.
     */
    async disconnect() {
        if (this.client) {
            await this.client.close();
            this.client = null;
        }
        if (this.listener) {
            this.listener.close();
            this.listener = null;
        }
        this.config = null;
        this.responseBuffer.clear();
    }
    /**
     * Check if an endpoint is dangerous (requires confirmation).
     */
    isDangerous(endpoint) {
        return DANGEROUS_ENDPOINTS.has(endpoint);
    }
    /**
     * Send an OSC message to get the current value of a parameter.
     * Returns the cached response if available within timeout.
     */
    async getValue(group, endpoint, index, timeoutMs = 2000) {
        if (!this.client) {
            throw new Error("Not connected. Use the connect tool first.");
        }
        const path = buildOscPath(group, endpoint, index);
        if (!path) {
            throw new Error(`Invalid endpoint: ${group}/${endpoint}`);
        }
        // Clear any stale response for this path
        this.responseBuffer.delete(path);
        // Send query (no arguments = GET)
        await this.client.send(new Message(path));
        // Wait for response with timeout
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const response = this.responseBuffer.get(path);
            if (response && response.timestamp > Date.now() - timeoutMs) {
                return response;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return null; // Timeout - no response received
    }
    /**
     * Set a value on the console.
     */
    async setValue(group, endpoint, value, index) {
        if (!this.client) {
            throw new Error("Not connected. Use the connect tool first.");
        }
        const spec = getEndpointInfo(group, endpoint);
        if (!spec) {
            throw new Error(`Invalid endpoint: ${group}/${endpoint}`);
        }
        if (spec.argumentType === null) {
            throw new Error(`Endpoint ${endpoint} is read-only (meter) and cannot be set.`);
        }
        const path = buildOscPath(group, endpoint, index);
        if (!path) {
            throw new Error(`Failed to build OSC path for ${group}/${endpoint}`);
        }
        // Build type-safe message
        const msg = new Message(path);
        switch (spec.argumentType) {
            case "float":
                if (typeof value !== "number") {
                    throw new Error(`Expected a number for float argument, got ${typeof value}`);
                }
                // Fader messages need exclusive range (not exactly 0 or 1)
                if (spec.type === "enPPCFaderMessage") {
                    value = Math.max(0.0000001, Math.min(0.9999999, value));
                }
                else {
                    value = Math.max(0, Math.min(1, value));
                }
                msg.append({ type: "f", value });
                break;
            case "integer":
                if (typeof value !== "number") {
                    throw new Error(`Expected a number for integer argument, got ${typeof value}`);
                }
                msg.append({ type: "i", value: Math.round(value) });
                break;
            case "string":
                msg.append({ type: "s", value: String(value) });
                break;
        }
        await this.client.send(msg);
    }
}
// Singleton instance
export const midasClient = new MidasOscClient();
//# sourceMappingURL=osc-client.js.map