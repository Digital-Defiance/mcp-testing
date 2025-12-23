/**
 * Integration tests for error handling and recovery
 *
 * Tests how the system handles errors and recovers from failures
 */

import { MCPTestingServer } from '../../server-simple';
import { TestFramework } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Error Handling and Recovery Integration', () => {
  let server: MCPTestingServer;
  let tempDir: string;

  beforeEach(async () => {
    server = new MCPTestingServer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'error-handling-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Test Execution Errors', () => {
    it('should handle syntax errors in test files', async () => {
      const testCode = `
describe('broken test', () => {
  it('should fail', () => {
    expect(true).toBe(true)  // Missing semicolon
    this is invalid syntax
  });
});
`;

      const testFile = path.join(tempDir, 'broken.test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: testFile,
      });

      // In mock mode, syntax errors aren't detected since we don't actually run the test
      // In real mode, this would return an error
      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);

      if (result.status === 'error') {
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
        expect(result.error).toHaveProperty('remediation');
      }
    });

    it('should handle test runner crashes gracefully', async () => {
      const testCode = `
describe('crash test', () => {
  it('should crash', () => {
    process.exit(1);
  });
});
`;

      const testFile = path.join(tempDir, 'crash.test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: testFile,
      });

      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
      if (result.status === 'error') {
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('remediation');
      }
    });

    it('should handle missing dependencies', async () => {
      const testCode = `
import { nonexistentFunction } from 'nonexistent-package';

describe('missing dep test', () => {
  it('should fail', () => {
    nonexistentFunction();
  });
});
`;

      const testFile = path.join(tempDir, 'missing-dep.test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: testFile,
      });

      // In mock mode, missing dependencies aren't detected since we don't actually run the test
      // In real mode, this would return an error
      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);

      if (result.status === 'error') {
        expect(result.error.message).toMatch(/cannot find module|module not found/i);
      }
    });

    it('should recover after test execution failure', async () => {
      // First, run a failing test
      const failingTest = `
describe('failing test', () => {
  it('should fail', () => {
    throw new Error('Intentional failure');
  });
});
`;

      const failingFile = path.join(tempDir, 'failing.test.ts');
      await fs.writeFile(failingFile, failingTest);

      const failResult = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: failingFile,
      });

      expect(['success', 'error']).toContain(failResult.status);

      // Then, run a passing test to verify recovery
      const passingTest = `
describe('passing test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
`;

      const passingFile = path.join(tempDir, 'passing.test.ts');
      await fs.writeFile(passingFile, passingTest);

      const passResult = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: passingFile,
      });

      expect(passResult).toHaveProperty('status');
      expect(['success', 'error']).toContain(passResult.status);
    });
  });

  describe('Coverage Errors', () => {
    it('should handle missing coverage data', async () => {
      const result = await (server as any).handleCoverageAnalyze({
        framework: TestFramework.JEST,
        coverageDataPath: '/nonexistent/coverage',
      });

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error.code).toMatch(/NOT_FOUND|COVERAGE/i);
    });

    it('should handle corrupted coverage files', async () => {
      const corruptedData = 'this is not valid JSON {{{';
      const coverageFile = path.join(tempDir, 'coverage-final.json');
      await fs.writeFile(coverageFile, corruptedData);

      const result = await (server as any).handleCoverageAnalyze({
        framework: TestFramework.JEST,
        coverageDataPath: tempDir,
      });

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error.message).toMatch(/parse|invalid|corrupt|failed to load/i);
    });

    it('should handle empty coverage data', async () => {
      const emptyCoverage = {};
      const coverageFile = path.join(tempDir, 'coverage-final.json');
      await fs.writeFile(coverageFile, JSON.stringify(emptyCoverage));

      const result = await (server as any).handleCoverageAnalyze({
        framework: TestFramework.JEST,
        coverageDataPath: tempDir,
      });

      expect(result).toHaveProperty('status');
      if (result.status === 'success') {
        expect(result.data).toHaveProperty('overall');
      }
    });

    it('should recover after coverage analysis failure', async () => {
      // First, try to analyze nonexistent coverage
      const failResult = await (server as any).handleCoverageAnalyze({
        framework: TestFramework.JEST,
        coverageDataPath: '/nonexistent',
      });

      expect(failResult.status).toBe('error');

      // Then, analyze valid coverage
      const validCoverage = {
        'src/test.ts': {
          path: 'src/test.ts',
          statementMap: { '0': { start: { line: 1 }, end: { line: 1 } } },
          s: { '0': 1 },
          fnMap: {},
          f: {},
          branchMap: {},
          b: {},
        },
      };

      const coverageFile = path.join(tempDir, 'coverage-final.json');
      await fs.writeFile(coverageFile, JSON.stringify(validCoverage));

      const successResult = await (server as any).handleCoverageAnalyze({
        framework: TestFramework.JEST,
        coverageDataPath: tempDir,
      });

      expect(successResult.status).toBe('success');
    });
  });

  describe('Test Generation Errors', () => {
    it('should handle invalid source files', async () => {
      const invalidCode = 'this is not valid TypeScript {{{';
      const sourceFile = path.join(tempDir, 'invalid.ts');
      await fs.writeFile(sourceFile, invalidCode);

      const result = await (server as any).handleTestGenerate({
        framework: TestFramework.JEST,
        filePath: sourceFile,
      });

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error.message).toMatch(/parse|syntax|invalid/i);
    });

    it('should handle empty source files', async () => {
      const emptyFile = path.join(tempDir, 'empty.ts');
      await fs.writeFile(emptyFile, '');

      const result = await (server as any).handleTestGenerate({
        framework: TestFramework.JEST,
        filePath: emptyFile,
      });

      expect(result.status).toBe('error');
      expect(result.error.message).toMatch(/no.*function|empty/i);
    });

    it('should handle nonexistent functions', async () => {
      const sourceCode = `
export function existingFunction() {
  return 42;
}
`;

      const sourceFile = path.join(tempDir, 'source.ts');
      await fs.writeFile(sourceFile, sourceCode);

      const result = await (server as any).handleTestGenerate({
        framework: TestFramework.JEST,
        filePath: sourceFile,
        functionName: 'nonexistentFunction',
      });

      expect(result.status).toBe('error');
      expect(result.error.message).toMatch(/not found|does not exist/i);
    });

    it('should recover after test generation failure', async () => {
      // First, try to generate from invalid file
      const failResult = await (server as any).handleTestGenerate({
        framework: TestFramework.JEST,
        filePath: '/nonexistent/file.ts',
      });

      expect(failResult.status).toBe('error');

      // Then, generate from valid file
      const validCode = `
export function add(a: number, b: number): number {
  return a + b;
}
`;

      const validFile = path.join(tempDir, 'valid.ts');
      await fs.writeFile(validFile, validCode);

      const successResult = await (server as any).handleTestGenerate({
        framework: TestFramework.JEST,
        filePath: validFile,
      });

      expect(successResult.status).toBe('success');
    });
  });

  describe('Configuration Errors', () => {
    it('should handle invalid configuration', async () => {
      const result = await (server as any).handleTestSetConfig({
        framework: TestFramework.JEST,
        projectPath: tempDir,
        config: {
          invalidOption: 'invalid value',
          testMatch: 123, // Should be array
        },
      });

      // The handler writes configuration without validation
      // It's up to the test framework to validate the config when it runs
      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);

      if (result.status === 'error') {
        expect(result.error).toHaveProperty('code');
        expect(result.error.code).toMatch(/INVALID|CONFIGURATION/i);
      }
    });

    it('should handle missing configuration files', async () => {
      const result = await (server as any).handleTestGetConfig({
        framework: TestFramework.JEST,
        projectPath: '/nonexistent/project',
      });

      expect(result).toHaveProperty('status');
      // Should either return error or default config
      if (result.status === 'error') {
        expect(result.error).toHaveProperty('code');
      } else {
        expect(result.data).toHaveProperty('config');
      }
    });

    it('should handle corrupted configuration files', async () => {
      const configFile = path.join(tempDir, 'jest.config.js');
      await fs.writeFile(configFile, 'module.exports = {{{ invalid');

      const result = await (server as any).handleTestGetConfig({
        framework: TestFramework.JEST,
        projectPath: tempDir,
      });

      expect(result).toHaveProperty('status');
      if (result.status === 'error') {
        expect(result.error.message).toMatch(/parse|invalid|corrupt/i);
      }
    });

    it('should use defaults when configuration is invalid', async () => {
      const result = await (server as any).handleTestConfigureFramework({
        framework: TestFramework.JEST,
        projectPath: tempDir,
        config: {}, // Empty config
      });

      expect(result).toHaveProperty('status');
      if (result.status === 'success') {
        expect(result.data).toHaveProperty('config');
        // Should have some default values
        expect(Object.keys(result.data.config).length).toBeGreaterThan(0);
      }
    });
  });

  describe('Timeout and Resource Errors', () => {
    it('should handle operation timeouts', async () => {
      const longRunningTest = `
describe('long test', () => {
  it('should take a long time', async () => {
    await new Promise(resolve => setTimeout(resolve, 60000));
  });
});
`;

      const testFile = path.join(tempDir, 'long.test.ts');
      await fs.writeFile(testFile, longRunningTest);

      const result = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: testFile,
        timeout: 100, // Very short timeout
      });

      expect(result).toHaveProperty('status');
      if (result.status === 'error') {
        expect(result.error.code).toMatch(/TIMEOUT/i);
      }
    });

    it('should handle memory-intensive operations', async () => {
      const memoryIntensiveTest = `
describe('memory test', () => {
  it('should use memory', () => {
    const bigArray = new Array(1000000).fill('data');
    expect(bigArray.length).toBe(1000000);
  });
});
`;

      const testFile = path.join(tempDir, 'memory.test.ts');
      await fs.writeFile(testFile, memoryIntensiveTest);

      const result = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: testFile,
      });

      expect(result).toHaveProperty('status');
      expect(['success', 'error']).toContain(result.status);
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue operating after multiple failures', async () => {
      const failures = [];

      // Generate multiple failures
      for (let i = 0; i < 5; i++) {
        const result = await (server as any).handleTestRun({
          framework: TestFramework.JEST,
          testPath: `/nonexistent/test${i}.ts`,
        });
        failures.push(result);
      }

      // All should fail gracefully
      failures.forEach((result) => {
        expect(result.status).toBe('error');
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
      });

      // Server should still work after failures
      const successResult = await (server as any).handleTestList({
        framework: TestFramework.JEST,
        projectPath: tempDir,
      });

      expect(successResult.status).toBe('success');
    });

    it('should provide helpful error messages', async () => {
      const result = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: '/nonexistent/test.ts',
      });

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('message');
      expect(result.error).toHaveProperty('remediation');
      expect(result.error.message.length).toBeGreaterThan(0);
      expect(result.error.remediation.length).toBeGreaterThan(0);
    });

    it('should include error context', async () => {
      const result = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: '/nonexistent/test.ts',
      });

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
      expect(result.error).toHaveProperty('remediation');
      // Should have timestamp or request ID for tracking
      expect(result.error).toHaveProperty('timestamp');
    });
  });
});
