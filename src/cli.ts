#!/usr/bin/env node

/**
 * CLI entry point for MCP Testing Server
 * 
 * @packageDocumentation
 */

import { main } from './server';

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
