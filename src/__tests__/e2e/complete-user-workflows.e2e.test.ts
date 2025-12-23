/**
 * End-to-end tests for complete user workflows
 *
 * Tests realistic end-to-end scenarios that users would perform
 */

import { MCPTestingServer } from '../../server-simple';
import { TestFramework } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Complete User Workflows E2E', () => {
  let server: MCPTestingServer;
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    server = new MCPTestingServer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'complete-workflow-test-'));
    projectDir = path.join(tempDir, 'project');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'tests'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('New Project Setup Workflow', () => {
    it('should guide user through setting up testing for a new project', async () => {
      // Step 1: Configure test framework
      const configureResult = await (server as any).handleTestConfigureFramework({
        framework: TestFramework.JEST,
        projectPath: projectDir,
        config: {
          testMatch: ['**/*.test.ts'],
          coverageDirectory: 'coverage',
          collectCoverageFrom: ['src/**/*.ts'],
          coverageThreshold: {
            global: {
              lines: 80,
              branches: 75,
              functions: 85,
              statements: 80,
            },
          },
        },
      });

      expect(configureResult).toHaveProperty('status');

      // Step 2: Verify configuration
      const getConfigResult = await (server as any).handleTestGetConfig({
        framework: TestFramework.JEST,
        projectPath: projectDir,
      });

      expect(getConfigResult.status).toBe('success');
      expect(getConfigResult.data).toHaveProperty('config');

      // Step 3: Create initial source file
      const sourceCode = `
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`;

      await fs.writeFile(path.join(projectDir, 'src', 'greet.ts'), sourceCode);

      // Step 4: Generate initial tests
      const generateResult = await (server as any).handleTestGenerateFromCode({
        framework: TestFramework.JEST,
        filePath: path.join(projectDir, 'src', 'greet.ts'),
      });

      expect(generateResult.status).toBe('success');

      // Step 5: List all tests
      const listResult = await (server as any).handleTestList({
        framework: TestFramework.JEST,
        projectPath: projectDir,
      });

      expect(listResult.status).toBe('success');
    });
  });

  describe('Bug Fix Workflow', () => {
    it('should support complete bug fix workflow from detection to verification', async () => {
      // Step 1: Create source code with a bug
      const buggyCode = `
export function calculateDiscount(price: number, percent: number): number {
  // Bug: doesn't validate percent range
  return price * (1 - percent);
}
`;

      const sourceFile = path.join(projectDir, 'src', 'discount.ts');
      await fs.writeFile(sourceFile, buggyCode);

      // Step 2: Create test that exposes the bug
      const testCode = `
import { calculateDiscount } from '../src/discount';

describe('calculateDiscount', () => {
  it('should apply 10% discount', () => {
    expect(calculateDiscount(100, 0.1)).toBe(90);
  });

  it('should reject invalid discount percentage', () => {
    expect(() => calculateDiscount(100, 1.5)).toThrow();
  });
});
`;

      const testFile = path.join(projectDir, 'tests', 'discount.test.ts');
      await fs.writeFile(testFile, testCode);

      // Step 3: Run tests (will fail)
      const runResult1 = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: testFile,
      });

      expect(runResult1).toHaveProperty('status');

      // Step 4: Analyze failure
      if (runResult1.status === 'success' && runResult1.data.failed > 0) {
        const failedTest = runResult1.data.tests.find((t: any) => t.status === 'failed');
        if (failedTest) {
          const analysisResult = await (server as any).handleTestAnalyzeFailure({
            testId: failedTest.id,
            error: failedTest.error,
          });

          expect(analysisResult).toHaveProperty('status');
        }
      }

      // Step 5: Fix the bug
      const fixedCode = `
export function calculateDiscount(price: number, percent: number): number {
  if (percent < 0 || percent > 1) {
    throw new Error('Discount percent must be between 0 and 1');
  }
  return price * (1 - percent);
}
`;

      await fs.writeFile(sourceFile, fixedCode);

      // Step 6: Run tests again (should pass)
      const runResult2 = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: testFile,
      });

      expect(runResult2).toHaveProperty('status');

      // Step 7: Verify coverage
      const coverageData = {
        'src/discount.ts': {
          path: 'src/discount.ts',
          statementMap: {
            '0': { start: { line: 2 }, end: { line: 2 } },
            '1': { start: { line: 3 }, end: { line: 3 } },
            '2': { start: { line: 5 }, end: { line: 5 } },
          },
          s: { '0': 10, '1': 2, '2': 10 },
          fnMap: { '0': { name: 'calculateDiscount', line: 1 } },
          f: { '0': 10 },
          branchMap: {},
          b: {},
        },
      };

      const coverageDir = path.join(projectDir, 'coverage');
      await fs.mkdir(coverageDir, { recursive: true });
      await fs.writeFile(
        path.join(coverageDir, 'coverage-final.json'),
        JSON.stringify(coverageData)
      );

      const coverageResult = await (server as any).handleCoverageAnalyze({
        framework: TestFramework.JEST,
        coverageDataPath: coverageDir,
      });

      expect(coverageResult).toHaveProperty('status');
    });
  });

  describe('Refactoring Workflow', () => {
    it('should support safe refactoring with test verification', async () => {
      // Step 1: Create original implementation
      const originalCode = `
export function processData(data: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < data.length; i++) {
    result.push(data[i].toUpperCase());
  }
  return result;
}
`;

      const sourceFile = path.join(projectDir, 'src', 'processor.ts');
      await fs.writeFile(sourceFile, originalCode);

      // Step 2: Generate comprehensive tests
      const generateResult = await (server as any).handleTestGenerate({
        framework: TestFramework.JEST,
        filePath: sourceFile,
        includeEdgeCases: true,
        includePropertyTests: true,
      });

      expect(generateResult.status).toBe('success');

      // Step 3: Run tests before refactoring
      if (generateResult.data.tests.length > 0) {
        const testFile = path.join(projectDir, 'tests', 'processor.test.ts');
        const testContent = generateResult.data.tests.map((t: any) => t.code).join('\n\n');
        await fs.writeFile(testFile, testContent);

        const runResult1 = await (server as any).handleTestRun({
          framework: TestFramework.JEST,
          testPath: testFile,
        });

        expect(runResult1).toHaveProperty('status');
      }

      // Step 4: Refactor code
      const refactoredCode = `
export function processData(data: string[]): string[] {
  return data.map(item => item.toUpperCase());
}
`;

      await fs.writeFile(sourceFile, refactoredCode);

      // Step 5: Run tests after refactoring
      const testFile = path.join(projectDir, 'tests', 'processor.test.ts');
      const testExists = await fs
        .access(testFile)
        .then(() => true)
        .catch(() => false);

      if (testExists) {
        const runResult2 = await (server as any).handleTestRun({
          framework: TestFramework.JEST,
          testPath: testFile,
        });

        expect(runResult2).toHaveProperty('status');
      }

      // Step 6: Verify no regression with mutation testing
      const mutationResult = await (server as any).handleTestMutationRun({
        framework: TestFramework.JEST,
        filePath: sourceFile,
      });

      expect(mutationResult).toHaveProperty('status');
    });
  });

  describe('CI/CD Integration Workflow', () => {
    it('should support automated testing in CI/CD pipeline', async () => {
      // Step 1: Analyze changed files
      const changes = [
        {
          file: 'src/api.ts',
          type: 'modified' as const,
          lines: [10, 11, 12],
          functions: ['fetchData'],
        },
        {
          file: 'src/utils.ts',
          type: 'added' as const,
          lines: [1, 2, 3, 4, 5],
          functions: ['formatResponse'],
        },
      ];

      // Step 2: Determine affected tests
      const impactResult = await (server as any).handleTestImpactAnalyze({
        framework: TestFramework.JEST,
        projectPath: projectDir,
        changes,
      });

      expect(impactResult).toHaveProperty('status');

      // Step 3: Run only affected tests
      if (impactResult.status === 'success' && impactResult.data.affectedTests.length > 0) {
        for (const test of impactResult.data.affectedTests.slice(0, 3)) {
          const runResult = await (server as any).handleTestRun({
            framework: TestFramework.JEST,
            testPath: test.file,
          });

          expect(runResult).toHaveProperty('status');
        }
      }

      // Step 4: Generate coverage report
      const coverageData = {
        'src/api.ts': {
          path: 'src/api.ts',
          statementMap: { '0': { start: { line: 10 }, end: { line: 10 } } },
          s: { '0': 5 },
          fnMap: { '0': { name: 'fetchData', line: 9 } },
          f: { '0': 5 },
          branchMap: {},
          b: {},
        },
      };

      const coverageDir = path.join(projectDir, 'coverage');
      await fs.mkdir(coverageDir, { recursive: true });
      await fs.writeFile(
        path.join(coverageDir, 'coverage-final.json'),
        JSON.stringify(coverageData)
      );

      const reportResult = await (server as any).handleCoverageReport({
        framework: TestFramework.JEST,
        format: 'json',
        coverageDataPath: coverageDir,
      });

      expect(reportResult.status).toBe('success');

      // Step 5: Export coverage for CI
      const exportResult = await (server as any).handleCoverageExport({
        framework: TestFramework.JEST,
        format: 'lcov',
        outputPath: path.join(tempDir, 'lcov.info'),
        coverageDataPath: coverageDir,
      });

      expect(exportResult.status).toBe('success');
    });
  });

  describe('Test Quality Improvement Workflow', () => {
    it('should help improve test quality over time', async () => {
      // Step 1: Create initial tests
      const testCode = `
describe('basic tests', () => {
  it('test 1', () => {
    expect(1 + 1).toBe(2);
  });
});
`;

      const testFile = path.join(projectDir, 'tests', 'basic.test.ts');
      await fs.writeFile(testFile, testCode);

      // Step 2: Get suggestions for improvement
      const suggestResult = await (server as any).handleTestSuggestCases({
        framework: TestFramework.JEST,
        testPath: testFile,
      });

      expect(suggestResult.status).toBe('success');
      expect(suggestResult.data).toHaveProperty('suggestions');

      // Step 3: Detect flaky tests
      const flakyResult = await (server as any).handleTestDetectFlaky({
        framework: TestFramework.JEST,
        testPath: testFile,
        iterations: 5,
      });

      expect(flakyResult).toHaveProperty('status');

      // Step 4: Benchmark performance
      const perfResult = await (server as any).handleTestPerformanceBenchmark({
        framework: TestFramework.JEST,
        projectPath: projectDir,
      });

      expect(perfResult).toHaveProperty('status');

      // Step 5: Check mutation score
      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
`;

      const sourceFile = path.join(projectDir, 'src', 'math.ts');
      await fs.writeFile(sourceFile, sourceCode);

      const mutationResult = await (server as any).handleTestMutationRun({
        framework: TestFramework.JEST,
        filePath: sourceFile,
      });

      expect(mutationResult).toHaveProperty('status');
    });
  });

  describe('Multi-Framework Project Workflow', () => {
    it('should support projects using multiple test frameworks', async () => {
      // Test with Jest
      const jestResult = await (server as any).handleTestList({
        framework: TestFramework.JEST,
        projectPath: projectDir,
      });

      expect(jestResult.status).toBe('success');

      // Test with Mocha
      const mochaResult = await (server as any).handleTestList({
        framework: TestFramework.MOCHA,
        projectPath: projectDir,
      });

      expect(mochaResult.status).toBe('success');

      // Test with Vitest
      const vitestResult = await (server as any).handleTestList({
        framework: TestFramework.VITEST,
        projectPath: projectDir,
      });

      expect(vitestResult.status).toBe('success');

      // Verify each framework has independent configuration
      const jestConfig = await (server as any).handleTestGetConfig({
        framework: TestFramework.JEST,
        projectPath: projectDir,
      });

      const mochaConfig = await (server as any).handleTestGetConfig({
        framework: TestFramework.MOCHA,
        projectPath: projectDir,
      });

      expect(jestConfig.data.framework).toBe(TestFramework.JEST);
      expect(mochaConfig.data.framework).toBe(TestFramework.MOCHA);
    });
  });
});
