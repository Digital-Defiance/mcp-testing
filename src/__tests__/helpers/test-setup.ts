/**
 * Test setup helpers
 */

let originalMockMode: string | undefined;

/**
 * Enable mock mode for tests
 */
export function enableMockMode(): void {
  originalMockMode = process.env['MCP_TESTING_MOCK_MODE'];
  process.env['MCP_TESTING_MOCK_MODE'] = 'true';
}

/**
 * Disable mock mode and restore original value
 */
export function disableMockMode(): void {
  if (originalMockMode === undefined) {
    delete process.env['MCP_TESTING_MOCK_MODE'];
  } else {
    process.env['MCP_TESTING_MOCK_MODE'] = originalMockMode;
  }
}

/**
 * Setup function to be called in beforeEach
 */
export function setupMockMode(): void {
  enableMockMode();
}

/**
 * Teardown function to be called in afterEach
 */
export function teardownMockMode(): void {
  disableMockMode();
}
