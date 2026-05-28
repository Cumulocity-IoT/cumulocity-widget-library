---
name: c8y-mcp-server
description: Critical implementation patterns for building Cumulocity microservices that act as MCP (Model Context Protocol) servers. Use when developing MCP servers.
---

# Cumulocity MCP Server Guidelines

When implementing an MCP (Model Context Protocol) server as a Cumulocity microservice using Python and FastAPI, follow these critical patterns to ensure compatibility with the platform's proxy and security layers.

## 1. FastMCP and Tool Decorators
Use `FastMCP` for a high-level API. Be cautious with initialization arguments; stick to the server name unless you've verified support for other parameters in the current version.

```python
mcp_server = FastMCP("my-mcp-server")
```

## 2. Proxy Compatibility (Relative Paths)
The standard `SseServerTransport` enforces a leading slash on the message endpoint, which breaks when served under a Cumulocity context path (e.g., `/service/my-microservice/`).

**Subclass `SseServerTransport` to return truly relative paths:**

```python
class CustomSseServerTransport(SseServerTransport):
    def __init__(self, endpoint: str):
        super().__init__(endpoint)
        self._endpoint = endpoint # Relative path (e.g., "messages/")

    @asynccontextmanager
    async def connect_sse(self, scope, receive, send):
        # Implementation should return self._endpoint directly in the 'endpoint' event
        # to ensure the client POSTs back to the correct relative URL.
        ...
```

## 3. Explicit Routing vs. Greedy Mounts
Cumulocity's proxy can be sensitive to trailing slash redirects (307). 
**Explicitly register routes for both trailing and non-trailing slash paths:**

```python
app.add_route("/sse", SseHandler(), methods=["GET"])
app.add_route("/sse/", SseHandler(), methods=["GET"])
app.add_route("/sse/messages", MessagesHandler(), methods=["POST"])
app.add_route("/sse/messages/", MessagesHandler(), methods=["POST"])
```

## 4. Middleware for Proxy Headers
Always add `ProxyHeadersMiddleware` to correctly handle `X-Forwarded-*` headers. 

```python
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
```

## 5. Context Propagation & Fallbacks
Tool execution often occurs in a different task/context than the initial request. 
**Use `contextvars` with robust fallbacks to environment variables:**

```python
# context.py
base_url: ContextVar[Optional[str]] = ContextVar(
    "base_url", 
    default=os.environ.get("C8Y_BASEURL")
)

# dtm_client.py fallback pattern
if not auth and os.environ.get("C8Y_USER"):
    # Build Basic Auth header from env for PER_TENANT isolation
    ...
```

## 6. Handler Integration
For maximum control over SSE lifecycles, implement handlers as ASGI classes rather than simple FastAPI decorators. This avoids issues with `Request` object serialization and `send` callable access.

```python
class SseHandler:
    async def __call__(self, scope, receive, send):
        async with sse.connect_sse(scope, receive, send) as (read_stream, write_stream):
            await mcp_server._mcp_server.run(read_stream, write_stream, ...)
```
