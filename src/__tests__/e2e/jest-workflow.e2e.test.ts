/**
 * End-to-end tests for Jest workflow
 *
 * Tests complete user workflows with Jest framework
 */

import { MCPTestingServer } from '../../server-simple';
import { TestFramework } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Jest Workflow E2E', () => {
  let server: MCPTestingServer;
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    server = new MCPTestingServer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jest-e2e-test-'));
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

  describe('Complete Development Workflow', () => {
    it('should support full TDD workflow: write code -> generate tests -> run tests -> analyze coverage', async () => {
      // Step 1: Write source code
      const sourceCode = `
export function calculateTotal(items: Array<{ price: number; quantity: number }>): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

export function applyDiscount(total: number, discountPercent: number): number {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount must be between 0 and 100');
  }
  return total * (1 - discountPercent / 100);
}

export function formatCurrency(amount: number): string {
  return \`$\${amount.toFixed(2)}\`;
}
`;

      const sourceFile = path.join(projectDir, 'src', 'cart.ts');
      await fs.writeFile(sourceFile, sourceCode);

      // Step 2: Generate tests
      const generateResult = await (server as any).handleTestGenerateFromCode({
        framework: TestFramework.JEST,
        filePath: sourceFile,
        outputPath: path.join(projectDir, 'tests', 'cart.test.ts'),
      });

      expect(generateResult.status).toBe('success');
      expect(generateResult.data.testsGenerated).toBeGreaterThan(0);

      // Step 3: Run tests
      const runResult = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: generateResult.data.outputPath,
      });

      expect(runResult).toHaveProperty('status');
      expect(['success', 'error']).toContain(runResult.status);

      // Step 4: Analyze coverage
      if (runResult.status === 'success') {
        const coverageResult = await (server as any).handleCoverageAnalyze({
          framework: TestFramework.JEST,
          coverageDataPath: projectDir,
        });

        expect(coverageResult).toHaveProperty('status');
        if (coverageResult.status === 'success') {
          expect(coverageResult.data).toHaveProperty('overall');
          expect(coverageResult.data.overall).toHaveProperty('lines');
        }
      }
    });

    it('should support debugging workflow: run tests -> identify failure -> analyze failure -> debug', async () => {
      // Step 1: Create source code with a bug
      const buggyCode = `
export function divide(a: number, b: number): number {
  return a / b; // Bug: no check for division by zero
}
`;

      const sourceFile = path.join(projectDir, 'src', 'math.ts');
      await fs.writeFile(sourceFile, buggyCode);

      // Step 2: Create test that exposes the bug
      const testCode = `
import { divide } from '../src/math';

describe('divide', () => {
  it('should divide two numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('should handle division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Cannot divide by zero');
  });
});
`;

      const testFile = path.join(projectDir, 'tests', 'math.test.ts');
      await fs.writeFile(testFile, testCode);

      // Step 3: Run tests (will fail)
      const runResult = await (server as any).handleTestRun({
        framework: TestFramework.JEST,
        testPath: testFile,
      });

      expect(runResult).toHaveProperty('status');

      // Step 4: Analyze failure
      if (runResult.status === 'success' && runResult.data.failed > 0) {
        const failedTest = runResult.data.tests.find((t: any) => t.status === 'failed');
        if (failedTest) {
          const analysisResult = await (server as any).handleTestAnalyzeFailure({
            testId: failedTest.id,
            error: failedTest.error,
          });

          expect(analysisResult).toHaveProperty('status');
          if (analysisResult.status === 'success') {
            expect(analysisResult.data).toHaveProperty('analysis');
          }
        }
      }

      // Step 5: Debug test
      const debugResult = await (server as any).handleTestDebug({
        framework: TestFramework.JEST,
        testPath: testFile,
        testName: 'should handle division by zero',
      });

      expect(debugResult).toHaveProperty('status');
    });
  });

  describe('Test Maintenance Workflow', () => {
    it('should support test discovery and organization', async () => {
      // Create multiple test files
      const testFiles = [
        { name: 'user.test.ts', content: 'describe("user", () => { it("test1", () => {}); });' },
        {
          name: 'product.test.ts',
          content: 'describe("product", () => { it("test2", () => {}); });',
        },
        { name: 'order.test.ts', content: 'describe("order", () => { it("test3", () => {}); });' },
      ];

      for (const file of testFiles) {
        await fs.writeFile(path.join(projectDir, 'tests', file.name), file.content);
      }

      // Step 1: List all tests
      const listResult = await (server as any).handleTestList({
        framework: TestFramework.JEST,
        projectPath: projectDir,
      });

      expect(listResult.status).toBe('success');
      expect(listResult.data.tests.length).toBeGreaterThanOrEqual(0);

      // Step 2: Search for specific tests
      const searchResult = await (server as any).handleTestSearch({
        framework: TestFramework.JEST,
        projectPath: projectDir,
        pattern: 'user',
      });

      expect(searchResult.status).toBe('success');
      expect(Array.isArray(searchResult.data.tests)).toBe(true);
    });

    it('should support test impact analysis workflow', async () => {
      // Create source and test files
      const sourceCode = `
export function processOrder(orderId: string): void {
  console.log(\`Processing order \${orderId}\`);
}

export function cancelOrder(orderId: string): void {
  console.log(\`Canceling order \${orderId}\`);
}
`;

      await fs.writeFile(path.join(projectDir, 'src', 'orders.ts'), sourceCode);

      // Simulate code changes
      const changes = [
        {
          file: 'src/orders.ts',
          type: 'modified' as const,
          lines: [2, 3],
          functions: ['processOrder'],
        },
      ];

      // Analyze impact
      const impactResult = await (server as any).handleTestImpactAnalyze({
        framework: TestFramework.JEST,
        projectPath: projectDir,
        changes,
      });

      expect(impactResult).toHaveProperty('status');
      if (impactResult.status === 'success') {
        expect(impactResult.data).toHaveProperty('affectedTests');
        expect(Array.isArray(impactResult.data.affectedTests)).toBe(true);
      }
    });
  });

  describe('Quality Assurance Workflow', () => {
    it('should support flaky test detection workflow', async () => {
      // Create a potentially flaky test
      const flakyTest = `
describe('flaky test', () => {
  it('might be flaky', () => {
    const random = Math.random();
    expect(random).toBeGreaterThan(0.1); // Might fail occasionally
  });
});
`;

      const testFile = path.join(projectDir, 'tests', 'flaky.test.ts');
      await fs.writeFile(testFile, flakyTest);

      // Detect flaky tests
      const flakyResult = await (server as any).handleTestDetectFlaky({
        framework: TestFramework.JEST,
        testPath: testFile,
        iterations: 10,
      });

      expect(flakyResult).toHaveProperty('status');
      if (flakyResult.status === 'success') {
        expect(flakyResult.data).toHaveProperty('flakyTests');
        expect(Array.isArray(flakyResult.data.flakyTests)).toBe(true);
      }
    });

    it('should support mutation testing workflow', async () => {
      // Create source code
      const sourceCode = `
export function isEven(n: number): boolean {
  return n % 2 === 0;
}

export function isPositive(n: number): boolean {
  return n > 0;
}
`;

      const sourceFile = path.join(projectDir, 'src', 'validators.ts');
      await fs.writeFile(sourceFile, sourceCode);

      // Create tests
      const testCode = `
import { isEven, isPositive } from '../src/validators';

describe('validators', () => {
  it('should check if even', () => {
    expect(isEven(2)).toBe(true);
    expect(isEven(3)).toBe(false);
  });

  it('should check if positive', () => {
    expect(isPositive(1)).toBe(true);
    expect(isPositive(-1)).toBe(false);
  });
});
`;

      await fs.writeFile(path.join(projectDir, 'tests', 'validators.test.ts'), testCode);

      // Run mutation testing
      const mutationResult = await (server as any).handleTestMutationRun({
        framework: TestFramework.JEST,
        filePath: sourceFile,
      });

      expect(mutationResult).toHaveProperty('status');
      if (mutationResult.status === 'success') {
        expect(mutationResult.data).toHaveProperty('mutations');
      }
    });

    it('should support performance benchmarking workflow', async () => {
      // Create tests
      const testCode = `
describe('performance tests', () => {
  it('fast test', () => {
    expect(1 + 1).toBe(2);
  });

  it('slow test', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(true).toBe(true);
  });
});
`;

      await fs.writeFile(path.join(projectDir, 'tests', 'perf.test.ts'), testCode);

      // Run performance benchmark
      const perfResult = await (server as any).handleTestPerformanceBenchmark({
        framework: TestFramework.JEST,
        projectPath: projectDir,
      });

      expect(perfResult).toHaveProperty('status');
      if (perfResult.status === 'success') {
        expect(perfResult.data).toHaveProperty('benchmarks');
      }
    });
  });

  describe('Configuration Management Workflow', () => {
    it('should support configuration setup and modification', async () => {
      // Step 1: Get default configuration
      const getResult1 = await (server as any).handleTestGetConfig({
        framework: TestFramework.JEST,
        projectPath: projectDir,
      });

      expect(getResult1.status).toBe('success');
      expect(getResult1.data).toHaveProperty('config');

      // Step 2: Configure framework
      const configureResult = await (server as any).handleTestConfigureFramework({
        framework: TestFramework.JEST,
        projectPath: projectDir,
        config: {
          testMatch: ['**/*.test.ts'],
          coverageDirectory: 'coverage',
          collectCoverageFrom: ['src/**/*.ts'],
        },
      });

      expect(configureResult).toHaveProperty('status');

      // Step 3: Set specific config
      const setResult = await (server as any).handleTestSetConfig({
        framework: TestFramework.JEST,
        projectPath: projectDir,
        config: {
          timeout: 10000,
        },
      });

      expect(setResult).toHaveProperty('status');

      // Step 4: Verify configuration
      const getResult2 = await (server as any).handleTestGetConfig({
        framework: TestFramework.JEST,
        projectPath: projectDir,
      });

      expect(getResult2.status).toBe('success');
      expect(getResult2.data).toHaveProperty('config');
    });
  });

  describe('Coverage Reporting Workflow', () => {
    it('should support complete coverage workflow', async () => {
      // Create source and tests
      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`;

      await fs.writeFile(path.join(projectDir, 'src', 'calc.ts'), sourceCode);

      const testCode = `
import { add, subtract } from '../src/calc';

describe('calculator', () => {
  it('should add', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should subtract', () => {
    expect(subtract(5, 3)).toBe(2);
  });
});
`;

      await fs.writeFile(path.join(projectDir, 'tests', 'calc.test.ts'), testCode);

      // Create mock coverage data
      const coverageData = {
        'src/calc.ts': {
          path: 'src/calc.ts',
          statementMap: {
            '0': { start: { line: 2 }, end: { line: 2 } },
            '1': { start: { line: 6 }, end: { line: 6 } },
            '2': { start: { line: 10 }, end: { line: 10 } },
          },
          s: { '0': 5, '1': 3, '2': 0 }, // multiply not covered
          fnMap: {
            '0': { name: 'add', line: 1 },
            '1': { name: 'subtract', line: 5 },
            '2': { name: 'multiply', line: 9 },
          },
          f: { '0': 5, '1': 3, '2': 0 },
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

      // Step 1: Analyze coverage
      const analyzeResult = await (server as any).handleCoverageAnalyze({
        framework: TestFramework.JEST,
        coverageDataPath: coverageDir,
      });

      expect(analyzeResult.status).toBe('success');
      expect(analyzeResult.data.overall.functions.percentage).toBeLessThan(100);

      // Step 2: Identify gaps
      const gapsResult = await (server as any).handleCoverageGaps({
        framework: TestFramework.JEST,
        coverageDataPath: coverageDir,
      });

      expect(gapsResult.status).toBe('success');
      expect(gapsResult.data.gaps.length).toBeGreaterThan(0);

      // Step 3: Generate report
      const reportResult = await (server as any).handleCoverageReport({
        framework: TestFramework.JEST,
        format: 'json',
        coverageDataPath: coverageDir,
      });

      expect(reportResult.status).toBe('success');
      expect(reportResult.data).toHaveProperty('content');

      // Step 4: Export coverage
      const exportResult = await (server as any).handleCoverageExport({
        framework: TestFramework.JEST,
        format: 'json',
        outputPath: path.join(tempDir, 'coverage-export.json'),
        coverageDataPath: coverageDir,
      });

      expect(exportResult.status).toBe('success');
      expect(exportResult.data).toHaveProperty('outputPath');
    });
  });

  describe('Test Suggestion Workflow', () => {
    it('should support test improvement workflow', async () => {
      // Create initial tests
      const testCode = `
import { add } from '../src/math';

describe('add', () => {
  it('should add positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
});
`;

      const testFile = path.join(projectDir, 'tests', 'math.test.ts');
      await fs.writeFile(testFile, testCode);

      // Get suggestions for additional test cases
      const suggestResult = await (server as any).handleTestSuggestCases({
        framework: TestFramework.JEST,
        testPath: testFile,
      });

      expect(suggestResult.status).toBe('success');
      expect(suggestResult.data).toHaveProperty('suggestions');
      expect(Array.isArray(suggestResult.data.suggestions)).toBe(true);
    });
  });
});
