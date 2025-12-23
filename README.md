# MCP Testing Server

Enterprise-grade Model Context Protocol server providing comprehensive testing capabilities for AI agents.

## Features

- **Test Execution**: Run tests across multiple frameworks (Jest, Mocha, Pytest, Vitest)
- **Coverage Analysis**: Analyze test coverage with detailed metrics
- **Test Generation**: Generate tests from code analysis
- **Debugging Integration**: Debug failing tests with mcp-debugger-server
- **Mutation Testing**: Verify test suite effectiveness
- **Flaky Test Detection**: Identify and analyze unreliable tests
- **Visual Regression**: Compare screenshots with mcp-screenshot
- **Impact Analysis**: Determine which tests are affected by code changes
- **Performance Benchmarking**: Identify and optimize slow tests

## Installation

```bash
npm install -g @ai-capabilities-suite/mcp-testing
```

## Usage

### As MCP Server

```bash
mcp-testing
```

### Programmatic Usage

```typescript
import { MCPTestingServer } from '@ai-capabilities-suite/mcp-testing';

const server = new MCPTestingServer();
await server.start();
```

## Configuration

The server can be configured through environment variables or configuration files.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run property-based tests
npm run test:property

# Run with coverage
npm run test:coverage
```

## License

MIT
