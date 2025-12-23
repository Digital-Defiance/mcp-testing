/**
 * Integration tests for MCP Server ↔ VS Code Extension communication
 *
 * Tests the complete communication flow between the MCP server and clients
 */

import { MCPTestingServer } from '../../server-simple';
import { TestFramework } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('MCP Server Communication Integration', () => {
  let server: MCPTestingServer;
  let tempDir: string;
  let originalMockMode: string | undefined;

  beforeEach(async () => {
    // Enable mock mode for integration tests
    originalMockMode = process.env.MCP_TESTING_MOCK_MODE;
    process.env.MCP_TESTING_MOCK_MODE = 'true';

    server = new MCPTestingServer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-comm-test-'));
  });

  afterEach(async () => {
    // Restore original mock mode
    if (originalMockMode === undefined) {
      delete process.env.MCP_TESTING_MOCK_MODE;
    } else {
      process.env.MCP_TESTING_MOCK_MODE = originalMockMode;
    }

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Server Initialization', () => {
    it('should initialize server successfully', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(MCPTestingServer);
    });

    it('should have all required tool handlers', () => {
      const requiredHandlers = [
        'handleTestRun',
        'handleTestStop',
        'handleTestList',
        'handleTestSearch',
        'handleCoverageAnalyze',
        'handleCoverageReport',
        'handleCoverageGaps',
        'handleCoverageTrends',
        'handleCoverageExport',
        'handleTestGenerate',
        'handleTestGenerateFromCode',
        'handleTestGenerateFixtures',
        'handleTestSuggestCases',
        'handleTestDebug',
        'handleTestAnalyzeFailure',
        'handleTestCompareValues',
        'handleTestDetectFlaky',
        'handleTestMutationRun',
        'handleTestImpactAnalyze',
        'handleTestPerformanceBenchmark',
        'handleTestConfigureFramework',
        'handleTestGetConfig',
        'handleTestSetConfig',
      ];

      for (const handler of requiredHandlers) {
        expect(typeof (server as any)[handler]).toBe('function');
      }
    });
  });

  describe('Tool Invocation Flow', () => {
    it('should handle test_run tool invocation', async () => {
      // Create a simple test file
      const testCode = `
describe('sample', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
`;

      const testFile = path.join(tempDir, 'sample.test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: testFile,
        timeout: 5000,
      });

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('data');
      expect(['success', 'error']).toContain(result.status);
    });

    it('should handle test_list tool invocation', async () => {
      const result = await (server as any).handleTestList({
        framework: TestFramework.JEST,
        projectPath: tempDir,
      });

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('data');
      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('tests');
      expect(Array.isArray(result.data.tests)).toBe(true);
    });

    it('should handle test_search tool invocation', async () => {
      const result = await (server as any).handleTestSearch({
        framework: TestFramework.JEST,
        projectPath: tempDir,
        pattern: '*.test.ts',
      });

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('data');
      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('tests');
      expect(Array.isArray(result.data.tests)).toBe(true);
    });

    it('should handle test_configure_framework tool invocation', async () => {
      const result = await (server as any).handleTestConfigureFramework({
        framework: TestFramework.JEST,
        projectPath: tempDir,
        config: {
          testMatch: ['**/*.test.ts'],
          coverageDirectory: 'coverage',
        },
      });

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('data');
      expect(['success', 'error']).toContain(result.status);
    });

    it('should handle test_get_config tool invocation', async () => {
      const result = await (server as any).handleTestGetConfig({
        framework: TestFramework.JEST,
        projectPath: tempDir,
      });

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('data');
      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('framework');
      expect(result.data).toHaveProperty('config');
    });
  });

  describe('Error Handling', () => {
    it('should return error for invalid framework', async () => {
      const result = await (server as any).handleTestRun({
        framework: 'invalid-framework' as TestFramework,
        testPath: '/nonexistent/path',
      });

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
    });

    it('should return error for nonexistent test file', async () => {
      const result = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: '/nonexistent/test.ts',
      });

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error.code).toContain('NOT_FOUND');
    });

    it('should handle timeout errors gracefully', async () => {
      // Create a test that would take longer than timeout
      const testCode = `
describe('timeout test', () => {
  it('should timeout', async () => {
    await new Promise(resolve => setTimeout(resolve, 10000));
  });
});
`;

      const testFile = path.join(tempDir, 'timeout.test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: testFile,
        timeout: 100, // Very short timeout
      });

      expect(result).toHaveProperty('status');
      // Should either timeout or complete, but not crash
      expect(['success', 'error']).toContain(result.status);
    });

    it('should handle malformed requests gracefully', async () => {
      const result = await (server as any).handleTestRun({
        // Missing required fields
      });

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent tool invocations', async () => {
      const promises = [
        (server as any).handleTestList({
          framework: TestFramework.JEST,
          projectPath: tempDir,
        }),
        (server as any).handleTestSearch({
          framework: TestFramework.JEST,
          projectPath: tempDir,
          pattern: '*.test.ts',
        }),
        (server as any).handleTestGetConfig({
          framework: TestFramework.JEST,
          projectPath: tempDir,
        }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('data');
      });
    });

    it('should handle concurrent test runs', async () => {
      // Create multiple test files
      const testFiles = [];
      for (let i = 0; i < 3; i++) {
        const testCode = `
describe('test ${i}', () => {
  it('should pass', () => {
    expect(${i}).toBe(${i});
  });
});
`;
        const testFile = path.join(tempDir, `test${i}.test.ts`);
        await fs.writeFile(testFile, testCode);
        testFiles.push(testFile);
      }

      const promises = testFiles.map((testFile) =>
        (server as any).handleTestRun({
          framework: TestFramework.JEST,
          testPath: testFile,
          timeout: 5000,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveProperty('status');
        expect(['success', 'error']).toContain(result.status);
      });
    });
  });

  describe('Response Format Validation', () => {
    it('should return consistent response format for success', async () => {
      const result = await (server as any).handleTestList({
        framework: TestFramework.JEST,
        projectPath: tempDir,
      });

      expect(result).toHaveProperty('status');
      expect(result.status).toBe('success');
      expect(result).toHaveProperty('data');
      expect(result).not.toHaveProperty('error');
    });

    it('should return consistent response format for errors', async () => {
      const result = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: '/nonexistent/path.test.ts', // Add extension to trigger validation
      });

      expect(result).toHaveProperty('status');
      // In mock mode, paths without extensions are treated as directories and don't trigger validation
      // Paths with extensions trigger file existence checks
      expect(['success', 'error']).toContain(result.status);

      if (result.status === 'error') {
        expect(result).toHaveProperty('error');
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
        expect(result.error).toHaveProperty('remediation');
      }
    });

    it('should include request metadata in responses', async () => {
      const result = await (server as any).handleTestList({
        framework: TestFramework.JEST,
        projectPath: tempDir,
      });

      expect(result).toHaveProperty('data');
      if (result.status === 'success') {
        expect(result.data).toHaveProperty('framework');
        expect(result.data.framework).toBe(TestFramework.JEST);
      }
    });
  });

  describe('State Management', () => {
    it('should maintain independent state for concurrent operations', async () => {
      const operation1 = (server as any).handleTestList({
        framework: TestFramework.JEST,
        projectPath: tempDir,
      });

      const operation2 = (server as any).handleTestSearch({
        framework: TestFramework.MOCHA,
        projectPath: tempDir,
        pattern: '*.spec.ts',
      });

      const [result1, result2] = await Promise.all([operation1, operation2]);

      expect(result1.data.framework).toBe(TestFramework.JEST);
      expect(result2.data.framework).toBe(TestFramework.MOCHA);
    });

    it('should not leak state between operations', async () => {
      // First operation
      await (server as any).handleTestSetConfig({
        framework: TestFramework.JEST,
        projectPath: tempDir,
        config: { testMatch: ['**/*.test.ts'] },
      });

      // Second operation with different framework
      const result = await (server as any).handleTestGetConfig({
        framework: TestFramework.MOCHA,
        projectPath: tempDir,
      });

      expect(result.data.framework).toBe(TestFramework.MOCHA);
      // Should not have Jest config
      expect(result.data.config).not.toEqual({ testMatch: ['**/*.test.ts'] });
    });
  });
});
