/**
 * Global test setup
 *
 * This file runs before all tests
 */

// Enable mock mode for all tests to prevent actual process spawning
process.env['MCP_TESTING_MOCK_MODE'] = 'true';

console.log('Test setup: Mock mode enabled');

// Store original cwd to restore if tests change it
const originalCwd = process.cwd();

// Global afterEach to ensure cwd is restored and cleanup config files
(global as any).afterEach(async () => {
  // Restore cwd if it was changed
  if (process.cwd() !== originalCwd) {
    process.chdir(originalCwd);
  }

  // Clean up any jest.config.json files that leaked into the project root
  try {
    const fs = require('fs/promises');
    const path = require('path');
    const configPath = path.join(originalCwd, 'jest.config.json');
    await fs.unlink(configPath);
  } catch (error) {
    // Ignore if file doesn't exist
  }
});
