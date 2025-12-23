/**
 * Integration tests for all MCP tool invocations
 *
 * Tests that all MCP tools can be invoked and return expected responses
 */

import { MCPTestingServer } from '../../server-simple';
import { TestFramework } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('All MCP Tools Invocation Integration', () => {
  let server: MCPTestingServer;
  let tempDir: string;

  beforeEach(async () => {
    server = new MCPTestingServer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'all-tools-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Test Execution Tools', () => {
    it('should invoke test_run', async () => {
      const result = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: tempDir,
      });

      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
    });

    it('should invoke test_stop', async () => {
      const result = await (server as any).handleTestStop({
        runId: 'test-run-123',
      });

      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
    });

    it('should invoke test_list', async () => {
      const result = await (server as any).handleTestList({
        framework: TestFramework.JEST,
        projectPath: tempDir,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('tests');
      expect(Array.isArray(result.data.tests)).toBe(true);
    });

    it('should invoke test_search', async () => {
      const result = await (server as any).handleTestSearch({
        framework: TestFramework.JEST,
        projectPath: tempDir,
        pattern: '*.test.ts',
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('tests');
      expect(Array.isArray(result.data.tests)).toBe(true);
    });
  });

  describe('Coverage Tools', () => {
    beforeEach(async () => {
      // Create mock coverage data
      const coverageData = {
        'src/example.ts': {
          path: 'src/example.ts',
          statementMap: {
            '0': { start: { line: 1 }, end: { line: 1 } },
          },
          s: { '0': 1 },
          fnMap: {},
          f: {},
          branchMap: {},
          b: {},
        },
      };

      const coverageFile = path.join(tempDir, 'coverage-final.json');
      await fs.writeFile(coverageFile, JSON.stringify(coverageData));
    });

    it('should invoke test_coverage_analyze', async () => {
      const result = await (server as any).handleCoverageAnalyze({
        framework: TestFramework.JEST,
        coverageDataPath: tempDir,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('overall');
    });

    it('should invoke test_coverage_report', async () => {
      const result = await (server as any).handleCoverageReport({
        framework: TestFramework.JEST,
        format: 'json',
        coverageDataPath: tempDir,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('format');
      expect(result.data).toHaveProperty('content');
    });

    it('should invoke test_coverage_gaps', async () => {
      const result = await (server as any).handleCoverageGaps({
        framework: TestFramework.JEST,
        coverageDataPath: tempDir,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('gaps');
      expect(Array.isArray(result.data.gaps)).toBe(true);
    });

    it('should invoke test_coverage_trends', async () => {
      const result = await (server as any).handleCoverageTrends({
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        coverageDataPath: tempDir,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('trends');
      expect(Array.isArray(result.data.trends)).toBe(true);
    });

    it('should invoke test_coverage_export', async () => {
      const outputPath = path.join(tempDir, 'coverage-export.json');

      const result = await (server as any).handleCoverageExport({
        framework: TestFramework.JEST,
        format: 'json',
        outputPath,
        coverageDataPath: tempDir,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('outputPath');
      expect(result.data).toHaveProperty('format');
    });
  });

  describe('Test Generation Tools', () => {
    beforeEach(async () => {
      // Create sample source file
      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}

export interface User {
  id: number;
  name: string;
}
`;

      const sourceFile = path.join(tempDir, 'source.ts');
      await fs.writeFile(sourceFile, sourceCode);
    });

    it('should invoke test_generate', async () => {
      const sourceFile = path.join(tempDir, 'source.ts');

      const result = await (server as any).handleTestGenerate({
        framework: TestFramework.JEST,
        filePath: sourceFile,
        functionName: 'add',
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('tests');
      expect(Array.isArray(result.data.tests)).toBe(true);
    });

    it('should invoke test_generate_from_code', async () => {
      const sourceFile = path.join(tempDir, 'source.ts');

      const result = await (server as any).handleTestGenerateFromCode({
        framework: TestFramework.JEST,
        filePath: sourceFile,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('tests');
      expect(result.data).toHaveProperty('outputPath');
    });

    it('should invoke test_generate_fixtures', async () => {
      const sourceFile = path.join(tempDir, 'source.ts');

      const result = await (server as any).handleTestGenerateFixtures({
        framework: TestFramework.JEST,
        filePath: sourceFile,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('fixtures');
      expect(Array.isArray(result.data.fixtures)).toBe(true);
    });

    it('should invoke test_suggest_cases', async () => {
      const testCode = `
describe('add', () => {
  it('should add numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
});
`;

      const testFile = path.join(tempDir, 'test.test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await (server as any).handleTestSuggestCases({
        framework: TestFramework.JEST,
        testPath: testFile,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('suggestions');
      expect(Array.isArray(result.data.suggestions)).toBe(true);
    });
  });

  describe('Debugging Tools', () => {
    it('should invoke test_debug', async () => {
      const result = await (server as any).handleTestDebug({
        framework: TestFramework.JEST,
        testPath: path.join(tempDir, 'test.test.ts'),
        testName: 'sample test',
      });

      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
    });

    it('should invoke test_analyze_failure', async () => {
      const result = await (server as any).handleTestAnalyzeFailure({
        testId: 'test-123',
        error: {
          message: 'Expected 5 but got 3',
          stack: 'Error: Expected 5 but got 3\n  at test.ts:10:5',
        },
      });

      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
      if (result.status === 'success') {
        expect(result.data).toHaveProperty('analysis');
      }
    });

    it('should invoke test_compare_values', async () => {
      const result = await (server as any).handleTestCompareValues({
        expected: { a: 1, b: 2 },
        actual: { a: 1, b: 3 },
      });

      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
      if (result.status === 'success') {
        expect(result.data).toHaveProperty('differences');
      }
    });
  });

  describe('Advanced Testing Tools', () => {
    it('should invoke test_detect_flaky', async () => {
      const result = await (server as any).handleTestDetectFlaky({
        framework: TestFramework.JEST,
        testPath: path.join(tempDir, 'test.test.ts'),
        iterations: 10,
      });

      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
      if (result.status === 'success') {
        expect(result.data).toHaveProperty('flakyTests');
        expect(Array.isArray(result.data.flakyTests)).toBe(true);
      }
    });

    it('should invoke test_mutation_run', async () => {
      const sourceCode = `
export function isPositive(n: number): boolean {
  return n > 0;
}
`;

      const sourceFile = path.join(tempDir, 'mutations.ts');
      await fs.writeFile(sourceFile, sourceCode);

      const result = await (server as any).handleTestMutationRun({
        framework: TestFramework.JEST,
        filePath: sourceFile,
      });

      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
      if (result.status === 'success') {
        expect(result.data).toHaveProperty('mutations');
      }
    });

    it('should invoke test_impact_analyze', async () => {
      const result = await (server as any).handleTestImpactAnalyze({
        framework: TestFramework.JEST,
        projectPath: tempDir,
        changes: [
          {
            file: 'src/example.ts',
            type: 'modified',
            lines: [10, 11, 12],
          },
        ],
      });

      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
      if (result.status === 'success') {
        expect(result.data).toHaveProperty('affectedTests');
        expect(Array.isArray(result.data.affectedTests)).toBe(true);
      }
    });

    it('should invoke test_performance_benchmark', async () => {
      const result = await (server as any).handleTestPerformanceBenchmark({
        framework: TestFramework.JEST,
        projectPath: tempDir,
      });

      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
      if (result.status === 'success') {
        expect(result.data).toHaveProperty('benchmarks');
      }
    });
  });

  describe('Configuration Tools', () => {
    it('should invoke test_configure_framework', async () => {
      const result = await (server as any).handleTestConfigureFramework({
        framework: TestFramework.JEST,
        projectPath: tempDir,
        config: {
          testMatch: ['**/*.test.ts'],
          coverageDirectory: 'coverage',
        },
      });

      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
    });

    it('should invoke test_get_config', async () => {
      const result = await (server as any).handleTestGetConfig({
        framework: TestFramework.JEST,
        projectPath: tempDir,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('framework');
      expect(result.data).toHaveProperty('config');
    });

    it('should invoke test_set_config', async () => {
      const result = await (server as any).handleTestSetConfig({
        framework: TestFramework.JEST,
        projectPath: tempDir,
        config: {
          testMatch: ['**/*.spec.ts'],
        },
      });

      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
    });
  });

  describe('Tool Response Consistency', () => {
    it('should return consistent response structure across all tools', async () => {
      const tools = [
        {
          handler: 'handleTestList',
          args: { framework: TestFramework.JEST, projectPath: tempDir },
        },
        {
          handler: 'handleTestSearch',
          args: { framework: TestFramework.JEST, projectPath: tempDir, pattern: '*.test.ts' },
        },
        {
          handler: 'handleTestGetConfig',
          args: { framework: TestFramework.JEST, projectPath: tempDir },
        },
      ];

      for (const tool of tools) {
        const result = await (server as any)[tool.handler](tool.args);

        // All responses should have status
        expect(result).toHaveProperty('status');
        expect(['success', 'error']).toContain(result.status);

        // Success responses should have data
        if (result.status === 'success') {
          expect(result).toHaveProperty('data');
          expect(result).not.toHaveProperty('error');
        }

        // Error responses should have error object
        if (result.status === 'error') {
          expect(result).toHaveProperty('error');
          expect(result.error).toHaveProperty('code');
          expect(result.error).toHaveProperty('message');
          expect(result.error).toHaveProperty('remediation');
        }
      }
    });

    it('should include metadata in all responses', async () => {
      const result = await (server as any).handleTestList({
        framework: TestFramework.JEST,
        projectPath: tempDir,
      });

      expect(result).toHaveProperty('status');
      if (result.status === 'success') {
        expect(result.data).toHaveProperty('framework');
      }
    });
  });

  describe('Tool Parameter Validation', () => {
    it('should validate required parameters', async () => {
      const result = await (server as any).handleTestRun({
        // Missing required framework parameter
        testPath: tempDir,
      });

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error.message).toMatch(/required|missing|invalid/i);
    });

    it('should validate parameter types', async () => {
      const result = await (server as any).handleTestRun({
        framework: 123, // Should be string
        testPath: tempDir,
      });

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('code');
    });

    it('should validate parameter values', async () => {
      const result = await (server as any).handleTestRun({
        framework: 'invalid-framework' as TestFramework,
        testPath: tempDir,
      });

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('code');
    });
  });
});
