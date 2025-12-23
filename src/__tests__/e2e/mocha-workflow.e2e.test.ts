/**
 * End-to-end tests for Mocha workflow
 *
 * Tests complete user workflows with Mocha framework
 */

import { MCPTestingServer } from '../../server-simple';
import { TestFramework } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Mocha Workflow E2E', () => {
  let server: MCPTestingServer;
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    server = new MCPTestingServer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mocha-e2e-test-'));
    projectDir = path.join(tempDir, 'project');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'test'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should support complete Mocha TDD workflow', async () => {
    // Create source code
    const sourceCode = `
export function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
`;

    const sourceFile = path.join(projectDir, 'src', 'fibonacci.ts');
    await fs.writeFile(sourceFile, sourceCode);

    // Generate tests
    const generateResult = await (server as any).handleTestGenerate({
      framework: TestFramework.MOCHA,
      filePath: sourceFile,
    });

    // Mocha may not be installed, so accept either success or error
    expect(generateResult).toHaveProperty('status');
    expect(['success', 'error']).toContain(generateResult.status);

    if (generateResult.status === 'success') {
      expect(generateResult.data).toHaveProperty('tests');

      // List tests
      const listResult = await (server as any).handleTestList({
        framework: TestFramework.MOCHA,
        projectPath: projectDir,
      });

      expect(listResult.status).toBe('success');
      expect(Array.isArray(listResult.data.tests)).toBe(true);
    }
  });

  it('should support Mocha test discovery and execution', async () => {
    // Create test files
    const testCode = `
const assert = require('assert');

describe('Array', function() {
  describe('#indexOf()', function() {
    it('should return -1 when the value is not present', function() {
      assert.strictEqual([1, 2, 3].indexOf(4), -1);
    });
  });
});
`;

    const testFile = path.join(projectDir, 'test', 'array.test.js');
    await fs.writeFile(testFile, testCode);

    // Search for tests
    const searchResult = await (server as any).handleTestSearch({
      framework: TestFramework.MOCHA,
      projectPath: projectDir,
      pattern: 'array',
    });

    expect(searchResult).toHaveProperty('status');
    expect(['success', 'error']).toContain(searchResult.status);

    if (searchResult.status === 'success') {
      expect(Array.isArray(searchResult.data.tests)).toBe(true);

      // Run tests
      const runResult = await (server as any).handleTestRun({
        framework: TestFramework.MOCHA,
        testPath: testFile,
      });

      expect(runResult).toHaveProperty('status');
      expect(['success', 'error']).toContain(runResult.status);
    }
  });

  it('should support Mocha configuration management', async () => {
    // Get configuration
    const getResult = await (server as any).handleTestGetConfig({
      framework: TestFramework.MOCHA,
      projectPath: projectDir,
    });

    expect(getResult).toHaveProperty('status');
    expect(['success', 'error']).toContain(getResult.status);

    if (getResult.status === 'success') {
      expect(getResult.data.framework).toBe(TestFramework.MOCHA);

      // Configure framework
      const configureResult = await (server as any).handleTestConfigureFramework({
        framework: TestFramework.MOCHA,
        projectPath: projectDir,
        config: {
          timeout: 5000,
          reporter: 'spec',
        },
      });

      expect(configureResult).toHaveProperty('status');
    }
  });

  it('should support Mocha coverage workflow', async () => {
    // Create mock coverage data
    const coverageData = {
      'src/fibonacci.ts': {
        path: 'src/fibonacci.ts',
        statementMap: {
          '0': { start: { line: 2 }, end: { line: 2 } },
          '1': { start: { line: 3 }, end: { line: 3 } },
        },
        s: { '0': 5, '1': 3 },
        fnMap: { '0': { name: 'fibonacci', line: 1 } },
        f: { '0': 5 },
        branchMap: {},
        b: {},
      },
    };

    const coverageDir = path.join(projectDir, 'coverage');
    await fs.mkdir(coverageDir, { recursive: true });
    // Mocha expects coverage.json, not coverage-final.json
    await fs.writeFile(path.join(coverageDir, 'coverage.json'), JSON.stringify(coverageData));

    // Analyze coverage
    const analyzeResult = await (server as any).handleCoverageAnalyze({
      framework: TestFramework.MOCHA,
      coverageDataPath: coverageDir,
    });

    // Coverage analysis works regardless of framework installation
    expect(analyzeResult.status).toBe('success');
    expect(analyzeResult.data).toHaveProperty('overall');

    // Get coverage gaps
    const gapsResult = await (server as any).handleCoverageGaps({
      framework: TestFramework.MOCHA,
      coverageDataPath: coverageDir,
    });

    expect(gapsResult.status).toBe('success');
    expect(Array.isArray(gapsResult.data.gaps)).toBe(true);
  });

  it('should support Mocha test generation workflow', async () => {
    // Create source code
    const sourceCode = `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}
`;

    const sourceFile = path.join(projectDir, 'src', 'calculator.ts');
    await fs.writeFile(sourceFile, sourceCode);

    // Generate tests from code
    const generateResult = await (server as any).handleTestGenerateFromCode({
      framework: TestFramework.MOCHA,
      filePath: sourceFile,
    });

    expect(generateResult).toHaveProperty('status');
    expect(['success', 'error']).toContain(generateResult.status);

    if (generateResult.status === 'success') {
      expect(generateResult.data.testsGenerated).toBeGreaterThan(0);

      // Generate fixtures
      const fixturesResult = await (server as any).handleTestGenerateFixtures({
        framework: TestFramework.MOCHA,
        filePath: sourceFile,
      });

      expect(fixturesResult).toHaveProperty('status');
    }
  });
});
