---
name: c8y-ai-service
description: REST API documentation and guidance for interacting with the Cumulocity AI service. Use when sending messages to the AI agent.
---

# Cumulocity AI Service API

The Cumulocity AI Service provides a central manager for AI agents, LLM providers, and Model Context Protocol (MCP) servers.

**Base URL**: `/service/ai`

## Authentication
Use standard Cumulocity authentication (Basic Auth or OAuth2) in the `Authorization` header.

---

## 1. Text Agents
Text agents are used for conversational interactions. They can use tools and maintain history.

### Talk to a Text Agent
`POST /agent/text/{name}`

**Parameters:**
- `fullResponse` (query, boolean): If true, returns detailed steps, tool usage, and token counts. Default is false (returns only text).
- `Accept` (header): `application/json` (default), `text/event-stream` (for SSE streaming), or `application/x-ndjson`.

**Request Body (`TextCompletionDto`):**
```json
{
  "prompt": "Simple text question", // XOR messages
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "system": "Optional system prompt override",
  "temperature": 0.7,
  "maxOutputTokens": 1024
}
```

### Manage Text Agents
- `GET /agent/text`: List all available text agents.
- `POST /agent/text`: Create a new text agent. Requires `AgentTextDefinitionDto`.
- `GET /agent/text/{name}`: Retrieve agent configuration.
- `PUT /agent/text/{name}`: Update agent configuration.
- `DELETE /agent/text/{name}`: Delete an agent.

---

## 2. Object Agents
Object agents generate structured JSON data based on a defined schema.

### Talk to an Object Agent
`POST /agent/object/{name}`

**Request Body (`ObjectCompletionDto`):**
```json
{
  "prompt": "Extract name and age from: John is 30.",
  "schema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "age": { "type": "number" }
    },
    "required": ["name", "age"]
  }
}
```

### Manage Object Agents
- `GET /agent/object`: List all available object agents.
- `POST /agent/object`: Create a new object agent.

---

## 3. MCP Tools & Servers
MCP servers provide tools that agents can use to interact with Cumulocity or external systems.

### List Available Tools
`GET /mcp/tools`
Returns a list of all tools available from all configured MCP servers.

### Manage MCP Servers
- `GET /mcp/servers`: List all configured MCP servers.
- `POST /mcp/servers`: Add a new MCP server (SSE or stdio).
- `GET /mcp/servers/{name}/tools`: List tools for a specific server.

---

## 4. AI Provider Configuration
A global provider (e.g., OpenAI, Anthropic, Google) must be configured for agents to work.

- `GET /provider`: Returns the current global provider (masked API key).
- `POST /provider`: Configure the global provider.

---

## Schema References

### `AgentTextDefinitionDto`
```json
{
  "name": "agent-name",
  "type": "text",
  "agent": {
    "system": "You are a helpful assistant.",
    "temperature": 0.7
  },
  "availability": "PRIVATE" // or "SHARED"
}
```
