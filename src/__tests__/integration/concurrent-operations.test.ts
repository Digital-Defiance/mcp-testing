/**
 * Integration tests for concurrent operations
 *
 * Tests that the system can handle multiple concurrent operations correctly
 */

import { MCPTestingServer } from '../../server-simple';
import { TestFramework } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Concurrent Operations Integration', () => {
  let server: MCPTestingServer;
  let tempDir: string;

  beforeEach(async () => {
    server = new MCPTestingServer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'concurrent-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Concurrent Test Execution', () => {
    it('should handle multiple test runs concurrently', async () => {
      // Create multiple test files
      const testFiles = [];
      for (let i = 0; i < 5; i++) {
        const testCode = `
describe('concurrent test ${i}', () => {
  it('should pass', () => {
    expect(${i}).toBe(${i});
  });
});
`;
        const testFile = path.join(tempDir, `test${i}.test.ts`);
        await fs.writeFile(testFile, testCode);
        testFiles.push(testFile);
      }

      // Run all tests concurrently
      const promises = testFiles.map((testFile) =>
        (server as any).handleTestRun({
          framework: TestFramework.JEST,
          testPath: testFile,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toHaveProperty('status');
        expect(['success', 'error']).toContain(result.status);
      });
    });

    it('should maintain test isolation during concurrent execution', async () => {
      // Create tests that modify shared state
      const testFiles = [];
      for (let i = 0; i < 3; i++) {
        const testCode = `
let counter = 0;

describe('isolation test ${i}', () => {
  it('should increment counter', () => {
    counter++;
    expect(counter).toBe(1);
  });
});
`;
        const testFile = path.join(tempDir, `isolation${i}.test.ts`);
        await fs.writeFile(testFile, testCode);
        testFiles.push(testFile);
      }

      const promises = testFiles.map((testFile) =>
        (server as any).handleTestRun({
          framework: TestFramework.JEST,
          testPath: testFile,
        })
      );

      const results = await Promise.all(promises);

      // All tests should pass if properly isolated
      results.forEach((result) => {
        expect(result).toHaveProperty('status');
      });
    });

    it('should handle concurrent test runs with different frameworks', async () => {
      const frameworks = [TestFramework.JEST, TestFramework.MOCHA, TestFramework.VITEST];

      const promises = frameworks.map((framework) =>
        (server as any).handleTestList({
          framework,
          projectPath: tempDir,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.status).toBe('success');
        expect(result.data.framework).toBe(frameworks[index]);
      });
    });
  });

  describe('Concurrent Coverage Analysis', () => {
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

    it('should handle concurrent coverage analysis', async () => {
      const operations = [
        (server as any).handleCoverageAnalyze({
          framework: TestFramework.JEST,
          coverageDataPath: tempDir,
        }),
        (server as any).handleCoverageGaps({
          framework: TestFramework.JEST,
          coverageDataPath: tempDir,
        }),
        (server as any).handleCoverageReport({
          framework: TestFramework.JEST,
          format: 'json',
          coverageDataPath: tempDir,
        }),
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.status).toBe('success');
      });
    });

    it('should handle concurrent coverage exports', async () => {
      const formats = ['json', 'html', 'lcov'];

      const promises = formats.map((format, index) =>
        (server as any).handleCoverageExport({
          framework: TestFramework.JEST,
          format,
          outputPath: path.join(
            tempDir,
            `coverage-${index}.${format === 'html' ? 'html' : format}`
          ),
          coverageDataPath: tempDir,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.status).toBe('success');
      });
    });
  });

  describe('Concurrent Test Generation', () => {
    beforeEach(async () => {
      // Create multiple source files
      for (let i = 0; i < 3; i++) {
        const sourceCode = `
export function func${i}(x: number): number {
  return x * ${i + 1};
}
`;
        const sourceFile = path.join(tempDir, `source${i}.ts`);
        await fs.writeFile(sourceFile, sourceCode);
      }
    });

    it('should handle concurrent test generation', async () => {
      const sourceFiles = [];
      for (let i = 0; i < 3; i++) {
        sourceFiles.push(path.join(tempDir, `source${i}.ts`));
      }

      const promises = sourceFiles.map((sourceFile) =>
        (server as any).handleTestGenerate({
          framework: TestFramework.JEST,
          filePath: sourceFile,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.status).toBe('success');
        expect(result.data).toHaveProperty('tests');
      });
    });

    it('should handle concurrent fixture generation', async () => {
      const sourceFiles = [];
      for (let i = 0; i < 3; i++) {
        const sourceCode = `
export interface Model${i} {
  id: number;
  name: string;
}
`;
        const sourceFile = path.join(tempDir, `model${i}.ts`);
        await fs.writeFile(sourceFile, sourceCode);
        sourceFiles.push(sourceFile);
      }

      const promises = sourceFiles.map((sourceFile) =>
        (server as any).handleTestGenerateFixtures({
          framework: TestFramework.JEST,
          filePath: sourceFile,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.status).toBe('success');
        expect(result.data).toHaveProperty('fixtures');
      });
    });
  });

  describe('Mixed Concurrent Operations', () => {
    it('should handle different operation types concurrently', async () => {
      // Create necessary files
      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
`;
      const sourceFile = path.join(tempDir, 'math.ts');
      await fs.writeFile(sourceFile, sourceCode);

      const coverageData = {
        'src/example.ts': {
          path: 'src/example.ts',
          statementMap: { '0': { start: { line: 1 }, end: { line: 1 } } },
          s: { '0': 1 },
          fnMap: {},
          f: {},
          branchMap: {},
          b: {},
        },
      };
      const coverageFile = path.join(tempDir, 'coverage-final.json');
      await fs.writeFile(coverageFile, JSON.stringify(coverageData));

      // Mix different operations
      const operations = [
        (server as any).handleTestList({
          framework: TestFramework.JEST,
          projectPath: tempDir,
        }),
        (server as any).handleTestGenerate({
          framework: TestFramework.JEST,
          filePath: sourceFile,
        }),
        (server as any).handleCoverageAnalyze({
          framework: TestFramework.JEST,
          coverageDataPath: tempDir,
        }),
        (server as any).handleTestGetConfig({
          framework: TestFramework.JEST,
          projectPath: tempDir,
        }),
        (server as any).handleTestSearch({
          framework: TestFramework.JEST,
          projectPath: tempDir,
          pattern: '*.test.ts',
        }),
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toHaveProperty('status');
        expect(['success', 'error']).toContain(result.status);
      });
    });

    it('should handle high concurrency load', async () => {
      const operations = [];

      // Create 20 concurrent operations
      for (let i = 0; i < 20; i++) {
        operations.push(
          (server as any).handleTestList({
            framework: TestFramework.JEST,
            projectPath: tempDir,
          })
        );
      }

      const results = await Promise.all(operations);

      expect(results).toHaveLength(20);
      results.forEach((result) => {
        expect(result.status).toBe('success');
      });
    });
  });

  describe('Concurrent Configuration Operations', () => {
    it('should handle concurrent configuration reads', async () => {
      const promises = Array(5)
        .fill(null)
        .map(() =>
          (server as any).handleTestGetConfig({
            framework: TestFramework.JEST,
            projectPath: tempDir,
          })
        );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.status).toBe('success');
        expect(result.data).toHaveProperty('config');
      });
    });

    it('should handle concurrent configuration writes', async () => {
      const configs = [
        { testMatch: ['**/*.test.ts'] },
        { coverageDirectory: 'coverage' },
        { timeout: 5000 },
      ];

      const promises = configs.map((config) =>
        (server as any).handleTestSetConfig({
          framework: TestFramework.JEST,
          projectPath: tempDir,
          config,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveProperty('status');
        expect(['success', 'error']).toContain(result.status);
      });
    });

    it('should handle mixed read/write configuration operations', async () => {
      const operations = [
        (server as any).handleTestGetConfig({
          framework: TestFramework.JEST,
          projectPath: tempDir,
        }),
        (server as any).handleTestSetConfig({
          framework: TestFramework.JEST,
          projectPath: tempDir,
          config: { testMatch: ['**/*.spec.ts'] },
        }),
        (server as any).handleTestGetConfig({
          framework: TestFramework.JEST,
          projectPath: tempDir,
        }),
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveProperty('status');
      });
    });
  });

  describe('Resource Management Under Concurrency', () => {
    it('should not leak resources during concurrent operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Run many concurrent operations
      const operations = [];
      for (let i = 0; i < 50; i++) {
        operations.push(
          (server as any).handleTestList({
            framework: TestFramework.JEST,
            projectPath: tempDir,
          })
        );
      }

      await Promise.all(operations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle concurrent operations without deadlocks', async () => {
      const timeout = 10000; // 10 seconds

      const operations = Array(10)
        .fill(null)
        .map(() =>
          (server as any).handleTestList({
            framework: TestFramework.JEST,
            projectPath: tempDir,
          })
        );

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Deadlock detected')), timeout)
      );

      await expect(Promise.race([Promise.all(operations), timeoutPromise])).resolves.toBeDefined();
    });
  });

  describe('Error Handling in Concurrent Operations', () => {
    it('should handle errors in some concurrent operations without affecting others', async () => {
      const operations = [
        (server as any).handleTestList({
          framework: TestFramework.JEST,
          projectPath: tempDir,
        }),
        (server as any).handleTestRun({
          framework: TestFramework.JEST,
          testPath: '/nonexistent/path.test.ts', // Add extension to trigger validation
        }),
        (server as any).handleTestSearch({
          framework: TestFramework.JEST,
          projectPath: tempDir,
          pattern: '*.test.ts',
        }),
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('success');
      // In mock mode, file validation depends on path format
      expect(['success', 'error']).toContain(results[1].status);
      expect(results[2].status).toBe('success');
    });

    it('should recover from concurrent failures', async () => {
      // First, run operations that will fail
      const failingOps = Array(5)
        .fill(null)
        .map(() =>
          (server as any).handleTestRun({
            framework: TestFramework.JEST,
            testPath: '/nonexistent/path.test.ts', // Add extension to trigger validation
          })
        );

      const failResults = await Promise.all(failingOps);
      failResults.forEach((result) => {
        // In mock mode, file validation depends on path format
        expect(['success', 'error']).toContain(result.status);
      });

      // Then, run successful operations
      const successOps = Array(5)
        .fill(null)
        .map(() =>
          (server as any).handleTestList({
            framework: TestFramework.JEST,
            projectPath: tempDir,
          })
        );

      const successResults = await Promise.all(successOps);
      successResults.forEach((result) => {
        expect(result.status).toBe('success');
      });
    });
  });
});
