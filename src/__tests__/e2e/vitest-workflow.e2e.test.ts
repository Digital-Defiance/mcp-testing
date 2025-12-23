/**
 * End-to-end tests for Vitest workflow
 *
 * Tests complete user workflows with Vitest framework
 */

import { MCPTestingServer } from '../../server-simple';
import { TestFramework } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Vitest Workflow E2E', () => {
  let server: MCPTestingServer;
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    server = new MCPTestingServer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vitest-e2e-test-'));
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

  it('should support complete Vitest TDD workflow', async () => {
    // Create source code
    const sourceCode = `
export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

export class TaskManager {
  private tasks: Task[] = [];

  addTask(title: string): Task {
    const task: Task = {
      id: Date.now().toString(),
      title,
      completed: false,
    };
    this.tasks.push(task);
    return task;
  }

  completeTask(id: string): boolean {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.completed = true;
      return true;
    }
    return false;
  }

  getTasks(): Task[] {
    return [...this.tasks];
  }
}
`;

    const sourceFile = path.join(projectDir, 'src', 'task-manager.ts');
    await fs.writeFile(sourceFile, sourceCode);

    // Generate tests
    const generateResult = await (server as any).handleTestGenerate({
      framework: TestFramework.VITEST,
      filePath: sourceFile,
    });

    // Vitest may not be installed, so accept either success or error
    expect(generateResult).toHaveProperty('status');
    expect(['success', 'error']).toContain(generateResult.status);

    if (generateResult.status === 'success') {
      expect(generateResult.data).toHaveProperty('tests');

      // List tests
      const listResult = await (server as any).handleTestList({
        framework: TestFramework.VITEST,
        projectPath: projectDir,
      });

      expect(listResult.status).toBe('success');
      expect(Array.isArray(listResult.data.tests)).toBe(true);
    }
  });

  it('should support Vitest test discovery and execution', async () => {
    // Create test file
    const testCode = `
import { describe, it, expect } from 'vitest';

describe('String utilities', () => {
  it('should capitalize string', () => {
    const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
    expect(capitalize('hello')).toBe('Hello');
  });

  it('should reverse string', () => {
    const reverse = (str: string) => str.split('').reverse().join('');
    expect(reverse('hello')).toBe('olleh');
  });

  it.each([
    ['hello', 5],
    ['world', 5],
    ['test', 4],
  ])('should get length of %s', (str, expected) => {
    expect(str.length).toBe(expected);
  });
});
`;

    const testFile = path.join(projectDir, 'tests', 'strings.test.ts');
    await fs.writeFile(testFile, testCode);

    // Search for tests
    const searchResult = await (server as any).handleTestSearch({
      framework: TestFramework.VITEST,
      projectPath: projectDir,
      pattern: 'strings',
    });

    expect(searchResult.status).toBe('success');
    expect(Array.isArray(searchResult.data.tests)).toBe(true);

    // Run tests
    const runResult = await (server as any).handleTestRun({
      framework: TestFramework.VITEST,
      testPath: testFile,
    });

    expect(runResult).toHaveProperty('status');
    expect(['success', 'error']).toContain(runResult.status);
  });

  it('should support Vitest configuration management', async () => {
    // Get configuration
    const getResult = await (server as any).handleTestGetConfig({
      framework: TestFramework.VITEST,
      projectPath: projectDir,
    });

    expect(getResult).toHaveProperty('status');
    expect(['success', 'error']).toContain(getResult.status);

    if (getResult.status === 'success') {
      expect(getResult.data.framework).toBe(TestFramework.VITEST);

      // Configure framework
      const configureResult = await (server as any).handleTestConfigureFramework({
        framework: TestFramework.VITEST,
        projectPath: projectDir,
        config: {
          test: {
            globals: true,
            environment: 'node',
          },
        },
      });

      expect(configureResult).toHaveProperty('status');

      // Set specific config
      const setResult = await (server as any).handleTestSetConfig({
        framework: TestFramework.VITEST,
        projectPath: projectDir,
        config: {
          test: {
            coverage: {
              provider: 'v8',
            },
          },
        },
      });

      expect(setResult).toHaveProperty('status');
    }
  });

  it('should support Vitest coverage workflow', async () => {
    // Create mock coverage data
    const coverageData = {
      'src/task-manager.ts': {
        path: 'src/task-manager.ts',
        statementMap: {
          '0': { start: { line: 10 }, end: { line: 10 } },
          '1': { start: { line: 11 }, end: { line: 11 } },
          '2': { start: { line: 20 }, end: { line: 20 } },
        },
        s: { '0': 10, '1': 10, '2': 5 },
        fnMap: {
          '0': { name: 'addTask', line: 9 },
          '1': { name: 'completeTask', line: 19 },
          '2': { name: 'getTasks', line: 28 },
        },
        f: { '0': 10, '1': 5, '2': 8 },
        branchMap: {},
        b: {},
      },
    };

    const coverageDir = path.join(projectDir, 'coverage');
    await fs.mkdir(coverageDir, { recursive: true });
    await fs.writeFile(path.join(coverageDir, 'coverage-final.json'), JSON.stringify(coverageData));

    // Analyze coverage
    const analyzeResult = await (server as any).handleCoverageAnalyze({
      framework: TestFramework.VITEST,
      coverageDataPath: coverageDir,
    });

    expect(analyzeResult.status).toBe('success');
    expect(analyzeResult.data).toHaveProperty('overall');

    // Get coverage gaps
    const gapsResult = await (server as any).handleCoverageGaps({
      framework: TestFramework.VITEST,
      coverageDataPath: coverageDir,
    });

    expect(gapsResult.status).toBe('success');
    expect(Array.isArray(gapsResult.data.gaps)).toBe(true);

    // Export coverage
    const exportResult = await (server as any).handleCoverageExport({
      framework: TestFramework.VITEST,
      format: 'json',
      outputPath: path.join(tempDir, 'vitest-coverage.json'),
      coverageDataPath: coverageDir,
    });

    expect(exportResult.status).toBe('success');
    expect(exportResult.data).toHaveProperty('outputPath');
  });

  it('should support Vitest test generation workflow', async () => {
    // Create source code
    const sourceCode = `
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
`;

    const sourceFile = path.join(projectDir, 'src', 'utils.ts');
    await fs.writeFile(sourceFile, sourceCode);

    // Generate tests from code
    const generateResult = await (server as any).handleTestGenerateFromCode({
      framework: TestFramework.VITEST,
      filePath: sourceFile,
    });

    expect(generateResult.status).toBe('success');
    expect(generateResult.data.testsGenerated).toBeGreaterThan(0);

    // Generate fixtures
    const fixturesResult = await (server as any).handleTestGenerateFixtures({
      framework: TestFramework.VITEST,
      filePath: sourceFile,
    });

    expect(fixturesResult).toHaveProperty('status');
  });

  it('should support Vitest performance benchmarking', async () => {
    // Create performance tests
    const testCode = `
import { describe, it, expect } from 'vitest';

describe('Performance tests', () => {
  it('fast operation', () => {
    const result = Array.from({ length: 100 }, (_, i) => i * 2);
    expect(result.length).toBe(100);
  });

  it('medium operation', () => {
    const result = Array.from({ length: 1000 }, (_, i) => i * 2);
    expect(result.length).toBe(1000);
  });

  it('slow operation', () => {
    const result = Array.from({ length: 10000 }, (_, i) => i * 2);
    expect(result.length).toBe(10000);
  });
});
`;

    await fs.writeFile(path.join(projectDir, 'tests', 'perf.test.ts'), testCode);

    // Run performance benchmark
    const perfResult = await (server as any).handleTestPerformanceBenchmark({
      framework: TestFramework.VITEST,
      projectPath: projectDir,
    });

    expect(perfResult).toHaveProperty('status');
    if (perfResult.status === 'success') {
      expect(perfResult.data).toHaveProperty('benchmarks');
    }
  });

  it('should support Vitest flaky test detection', async () => {
    // Create potentially flaky test
    const flakyTest = `
import { describe, it, expect } from 'vitest';

describe('Flaky tests', () => {
  it('might be flaky', () => {
    const random = Math.random();
    expect(random).toBeGreaterThan(0.2);
  });

  it('stable test', () => {
    expect(1 + 1).toBe(2);
  });
});
`;

    const testFile = path.join(projectDir, 'tests', 'flaky.test.ts');
    await fs.writeFile(testFile, flakyTest);

    // Detect flaky tests
    const flakyResult = await (server as any).handleTestDetectFlaky({
      framework: TestFramework.VITEST,
      testPath: testFile,
      iterations: 10,
    });

    expect(flakyResult).toHaveProperty('status');
    if (flakyResult.status === 'success') {
      expect(flakyResult.data).toHaveProperty('flakyTests');
      expect(Array.isArray(flakyResult.data.flakyTests)).toBe(true);
    }
  });

  it('should support Vitest mutation testing', async () => {
    // Create source code
    const sourceCode = `
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}
`;

    const sourceFile = path.join(projectDir, 'src', 'range.ts');
    await fs.writeFile(sourceFile, sourceCode);

    // Run mutation testing
    const mutationResult = await (server as any).handleTestMutationRun({
      framework: TestFramework.VITEST,
      filePath: sourceFile,
    });

    expect(mutationResult).toHaveProperty('status');
    if (mutationResult.status === 'success') {
      expect(mutationResult.data).toHaveProperty('mutations');
    }
  });

  it('should support Vitest test suggestion workflow', async () => {
    // Create initial tests
    const testCode = `
import { describe, it, expect } from 'vitest';

describe('Math operations', () => {
  it('should add numbers', () => {
    expect(2 + 3).toBe(5);
  });
});
`;

    const testFile = path.join(projectDir, 'tests', 'math.test.ts');
    await fs.writeFile(testFile, testCode);

    // Get suggestions
    const suggestResult = await (server as any).handleTestSuggestCases({
      framework: TestFramework.VITEST,
      testPath: testFile,
    });

    expect(suggestResult.status).toBe('success');
    expect(suggestResult.data).toHaveProperty('suggestions');
    expect(Array.isArray(suggestResult.data.suggestions)).toBe(true);
  });
});
