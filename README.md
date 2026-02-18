# Midas Pro Series MCP Server

An MCP (Model Context Protocol) server that lets Claude browse, search, and control Midas Pro Series mixing consoles (Pro2C, Pro1, etc.) over OSC.

Includes a complete database of **4,500+ reverse-engineered OSC endpoints** across 33 control groups.

---

### Quick Install (3 clicks)

[**Download midas-pro-osc.mcpb**](https://github.com/MyronKoch/midas-pro-mcp-server/releases/latest/download/midas-pro-osc.mcpb)

> 1. Click the link above to download
> 2. Double-click the downloaded file
> 3. Claude Desktop opens and installs it automatically
>
> That's it. No terminal, no config files, no coding.

---

## What It Does

**Without a mixer connected (offline mode):**
- Search and browse the entire Midas Pro Series OSC command database
- Get the exact OSC path for any parameter (faders, EQ, mute, labels, etc.)
- Understand message types, argument formats, and value ranges

**With a mixer on your network (live mode):**
- Read current parameter values from the console
- Set fader levels, toggle mutes, rename channels, adjust EQ - all via natural language
- Safety gates on destructive commands (reboot, factory reset)

## Installation

### Option A: Desktop Extension (Recommended)

This is the easiest way. No terminal or config files needed.

1. [**Download midas-pro-osc.mcpb**](https://github.com/MyronKoch/midas-pro-mcp-server/releases/latest/download/midas-pro-osc.mcpb)
2. Open **Claude Desktop**
3. Go to **Settings > Extensions**
4. Drag the `.mcpb` file into the window, or click "Install from file"
5. (Optional) Enter your console's IP address when prompted - you can skip this to use browse/search tools without a live connection

### Option B: Manual Configuration

If you prefer to configure Claude Desktop manually:

**Prerequisites:** [Node.js](https://nodejs.org/) v18 or later

1. Clone the repo:
   ```bash
   git clone https://github.com/MyronKoch/midas-pro-mcp-server.git
   cd midas-pro-mcp-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build:
   ```bash
   npm run build
   ```

4. Open your Claude Desktop config file:
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

5. Add the server to your config:
   ```json
   {
     "mcpServers": {
       "midas-pro": {
         "command": "node",
         "args": ["/full/path/to/midas-pro-mcp-server/server/index.js"],
         "env": {
           "MIDAS_IP": "",
           "MIDAS_PORT": "10023"
         }
       }
     }
   }
   ```
   Set `MIDAS_IP` to your console's IP address, or leave it blank for offline mode.

6. Restart Claude Desktop.

### Option C: Using npx

```json
{
  "mcpServers": {
    "midas-pro": {
      "command": "npx",
      "args": ["-y", "midas-pro-mcp-server"]
    }
  }
}
```

## Usage Examples

Once installed, just talk to Claude naturally:

> **"What control groups are available on the Midas Pro?"**
> Lists all 33 groups: mic inputs, masters, aux returns, GEQ, internal FX, mute groups, VCA groups, etc.

> **"How do I control the fader on mic input 3?"**
> Returns the exact OSC path, message type, argument format, and value range.

> **"Search for all mute-related commands"**
> Finds all 196 mute endpoints across every control group.

> **"Connect to my mixer at 192.168.1.100 and set channel 1 fader to 75%"**
> Connects via OSC and sends the command. The physical fader moves.

> **"What's the OSC path to rename a channel label?"**
> Returns `/enPPCStringMessage/enVirtualMicInputs/enPathname/<index>` with usage details.

## Available Tools

| Tool | Description |
|------|-------------|
| `list_groups` | List all 33 control groups with endpoint counts |
| `list_endpoints` | List all endpoints in a specific group |
| `search_endpoints` | Full-text search across all 4,500+ endpoints |
| `get_endpoint_info` | Detailed info for a specific endpoint |
| `build_osc_command` | Build the exact OSC path for a command |
| `connect` | Connect to a console by IP address |
| `disconnect` | Disconnect from the console |
| `connection_status` | Check current connection state |
| `get_value` | Read a live parameter from the console |
| `set_value` | Set a parameter on the console |

## Console Setup

To use live control (not required for browsing/searching):

1. On your Midas Pro console, go to **Setup > Network**
2. Assign an IP address to the console (e.g. `192.168.1.100`)
3. Enable **Ethernet Remote Control**
4. Make sure your computer is on the same network/subnet

The default OSC port is **10023**. If your console uses a different port, set it during installation or in the config.

## Control Groups

The database covers these areas of the console:

| Group | What It Controls |
|-------|-----------------|
| VirtualMicInputs | Input channels - faders, EQ, dynamics, routing, labels |
| VirtualMasters | Master bus controls |
| VirtualSubMixes | Submix outputs |
| VirtualAuxReturns | Aux return channels |
| VirtualMainOuts | Main output bus |
| VirtualMuteGroups | Mute group assignments |
| VirtualVCAGroups | VCA group controls |
| VirtualGEQPool | Graphic EQ |
| VirtualInternalFX | Internal effects (700+ parameters) |
| VirtualMonitors | Monitor outputs |
| VirtualTalkGroups | Talkback groups |
| Globals | System-wide settings |
| CommandPathType | Scene recall, safes, system commands |
| ...and 20 more | DL stage boxes, I/O modules, bay areas, etc. |

## OSC Message Types

| Type | Value Format | Example Use |
|------|-------------|-------------|
| `enPPCFaderMessage` | Float 0.0-1.0 (exclusive) | Fader levels |
| `enPPCRotaryMessage` | Float 0.0-1.0 (inclusive) | EQ freq/gain, pan, sends |
| `enPPCSwitchMessage` | Integer 0 or 1 (toggle) | Mute, solo, link toggles |
| `enPPCStringMessage` | String | Channel names/labels |
| `enPPCMeterMessage` | Read-only float 0.0-1.0 | Meter levels |

## Development

```bash
# Install dependencies
bun install    # or npm install

# Build
bun run build  # or npm run build

# Run directly (for testing)
bun run src/index.ts

# Build .mcpb extension
mcpb pack _bundle/ midas-pro-osc.mcpb
```

## Credits

The OSC command database is based on the reverse-engineering work by [Guffawker](https://github.com/Guffawker/midas-pro-series-osc-commands) and community contributors who brute-forced and documented thousands of parameter endpoints from Midas Pro Series firmware.

## License

MIT
