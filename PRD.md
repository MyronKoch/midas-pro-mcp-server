# PRD: Midas Pro Series MCP Server

## Overview

An MCP (Model Context Protocol) server that enables AI assistants (Claude, etc.) to discover, query, and control Midas Pro Series mixing consoles over OSC (Open Sound Control). This turns a 4,596-endpoint reverse-engineered OSC specification into a natural-language-accessible control surface.

## Problem Statement

The Midas Pro Series OSC command set is massive (3,896 main endpoints + 700 FX endpoints across 33 control groups) and was reverse-engineered from firmware. Only ~14% of endpoints have meaningful documentation. A sound engineer wanting to automate their console via OSC faces:

1. **Discovery burden** - Finding the right command among thousands
2. **Protocol complexity** - Knowing the correct message type, argument type, and value ranges
3. **No official API docs** - Relying on community-contributed descriptions
4. **Manual OSC tooling** - Writing code or using low-level OSC utilities

An MCP server solves all of these by letting an AI assistant act as an intelligent intermediary.

## Target Users

- Live sound engineers automating Midas Pro Series consoles
- Theater/broadcast technicians building show control systems
- Developers integrating mixer control into automation workflows
- Anyone using Claude Desktop or Claude Code who wants to talk to their mixer

## Architecture

```
┌─────────────────┐     stdio      ┌──────────────────────┐     UDP/OSC     ┌──────────────┐
│  Claude Desktop  │◄──────────────►│  MCP Server (this)   │◄──────────────►│  Midas Pro2C  │
│  or Claude Code  │                │                      │                │  Console      │
└─────────────────┘                │  ┌────────────────┐  │                └──────────────┘
                                    │  │ Endpoint DB    │  │
                                    │  │ (JSON specs)   │  │
                                    │  └────────────────┘  │
                                    │  ┌────────────────┐  │
                                    │  │ OSC Transport   │  │
                                    │  │ (node-osc)     │  │
                                    │  └────────────────┘  │
                                    └──────────────────────┘
```

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node.js / Bun | TypeScript-native, async I/O |
| Language | TypeScript | Type safety for OSC message construction |
| MCP SDK | `@modelcontextprotocol/sdk` | Official Anthropic MCP server SDK |
| OSC Library | `node-osc` | Active maintenance, native TS types, clean API |
| Transport | stdio | Standard for Claude Desktop/Code integration |

## Phased Roadmap

### Phase 1: Knowledge Base (Offline Mode) - MVP

**Goal:** Let the AI browse and search the entire Midas command spec without a live mixer.

**Tools:**

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_groups` | List all 33 control groups with endpoint counts | none |
| `list_endpoints` | List all endpoints in a group with descriptions | `group: string` |
| `search_endpoints` | Full-text search across all endpoint names and descriptions | `query: string`, `group?: string`, `type?: string` |
| `get_endpoint_info` | Get full details for a specific endpoint | `group: string`, `endpoint: string` |
| `build_osc_command` | Construct the full OSC path for a command | `group: string`, `endpoint: string`, `index?: number` |

**Deliverables:**
- [ ] MCP server scaffold (package.json, tsconfig, entry point)
- [ ] JSON endpoint loader (both main + FX files)
- [ ] All 5 knowledge base tools implemented
- [ ] Works in Claude Desktop via stdio

**Success Criteria:** A user can ask "How do I control the EQ on mic input 3?" and get a complete, correct answer with the exact OSC path.

---

### Phase 2: Live Console Control

**Goal:** Actually send OSC commands to and receive data from a Midas mixer on the network.

**Tools:**

| Tool | Description | Parameters |
|------|-------------|------------|
| `connect` | Connect to a Midas console by IP | `ip: string`, `port?: number` |
| `disconnect` | Disconnect from the console | none |
| `get_value` | Read current value of a parameter | `group: string`, `endpoint: string`, `index?: number` |
| `set_value` | Set a parameter value on the console | `group: string`, `endpoint: string`, `value: number\|string`, `index?: number` |
| `connection_status` | Check if connected and to which console | none |

**Deliverables:**
- [ ] OSC client wrapper with connection management
- [ ] Type-safe value encoding (float vs int vs string based on endpoint spec)
- [ ] Response listener for get operations
- [ ] Connection state management
- [ ] Safety: confirmation prompt for destructive operations (reboot, reset)

**Success Criteria:** User says "Set mic input 1 fader to 75%" and the physical fader moves on the console.

---

### Phase 3: High-Level Operations

**Goal:** Composite operations that combine multiple low-level commands into useful workflows.

**Tools:**

| Tool | Description |
|------|-------------|
| `get_channel_overview` | Read all parameters for a channel at once |
| `mute_group` | Mute/unmute a group of channels |
| `snapshot_channel` | Capture all settings for a channel as JSON |
| `label_channels` | Batch-rename channels from a list |
| `meter_levels` | Read current meter levels for a range of inputs |

**Deliverables:**
- [ ] Composite tool framework
- [ ] Batch OSC message sending
- [ ] Channel snapshot/restore
- [ ] Human-readable value formatting (dB, Hz, etc.)

---

### Phase 4: Polish and Community

**Goal:** Make it production-ready and shareable.

- [ ] npm package publication
- [ ] Claude Desktop config generator
- [ ] Comprehensive README with setup guide
- [ ] Value mapping tables (0-1 float to real-world units)
- [ ] Community contribution guide for undocumented endpoints

## Configuration

The MCP server is configured via Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "midas-pro": {
      "command": "npx",
      "args": ["-y", "midas-pro-mcp-server"],
      "env": {
        "MIDAS_IP": "192.168.1.100",
        "MIDAS_PORT": "10023"
      }
    }
  }
}
```

Or for local development:

```json
{
  "mcpServers": {
    "midas-pro": {
      "command": "bun",
      "args": ["run", "/path/to/mcp-server/src/index.ts"]
    }
  }
}
```

## Safety Considerations

1. **No auto-send on first use** - Phase 1 is purely informational
2. **Connection is explicit** - Must call `connect` before any live commands
3. **Destructive commands gated** - `enRebootConsole`, `enResetGlobalsToDefault` require confirmation
4. **Read-only meter access** - Meter endpoints cannot accidentally write
5. **Value validation** - Fader/rotary values clamped to 0-1 range before sending

## File Structure

```
mcp-server/
├── PRD.md                 # This file
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Entry point, MCP server setup
│   ├── endpoints.ts       # JSON loader and search engine
│   ├── osc-client.ts      # OSC transport wrapper (Phase 2)
│   └── tools/
│       ├── knowledge.ts   # Phase 1: browse/search tools
│       ├── control.ts     # Phase 2: get/set tools
│       └── composite.ts   # Phase 3: high-level operations
└── data/
    ├── pro-series-endpoints.json           # (symlink to repo root)
    └── pro-series-internal-fx-parameters-endpoints.json
```

## Open Questions

1. What OSC port does the Midas Pro Series listen on? (Commonly 10023, needs verification)
2. Does the console require a heartbeat/subscription to receive meter data?
3. Are there any OSC commands that require a specific sequence (e.g., select channel before editing)?
4. What firmware versions are compatible with these reverse-engineered commands?
