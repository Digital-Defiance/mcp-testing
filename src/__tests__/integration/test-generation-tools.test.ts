/**
 * Integration tests for test generation tools
 *
 * Tests the test generation tools through the MCP server interface
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { MCPTestingServer } from '../../server-simple';
import { TestFramework } from '../../types';

describe('Test Generation Tools Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-generation-integration-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('test_generate', () => {
    it('should generate tests for a specific function', async () => {
      // Create a sample source file
      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(x: number, y: number): number {
  return x * y;
}
`;

      const sourceFile = path.join(tempDir, 'math.ts');
      await fs.writeFile(sourceFile, sourceCode);

      const server = new MCPTestingServer();
      const result = await (server as any).handleTestGenerate({
        framework: TestFramework.JEST,
        filePath: sourceFile,
        functionName: 'add',
        includeEdgeCases: true,
        includePropertyTests: false,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('framework');
      expect(result.data).toHaveProperty('filePath');
      expect(result.data).toHaveProperty('functionName');
      expect(result.data).toHaveProperty('testsGenerated');
      expect(result.data).toHaveProperty('tests');
      expect(result.data.framework).toBe(TestFramework.JEST);
      expect(result.data.functionName).toBe('add');
      expect(result.data.testsGenerated).toBeGreaterThan(0);
      expect(Array.isArray(result.data.tests)).toBe(true);
    });

    it('should generate tests for all functions when no function name specified', async () => {
      const sourceCode = `
export function subtract(a: number, b: number): number {
  return a - b;
}
`;

      const sourceFile = path.join(tempDir, 'operations.ts');
      await fs.writeFile(sourceFile, sourceCode);

      const server = new MCPTestingServer();
      const result = await (server as any).handleTestGenerate({
        framework: TestFramework.JEST,
        filePath: sourceFile,
      });

      expect(result.status).toBe('success');
      expect(result.data.testsGenerated).toBeGreaterThan(0);
    });

    it('should throw error when function not found', async () => {
      const sourceCode = `
export function divide(a: number, b: number): number {
  return a / b;
}
`;

      const sourceFile = path.join(tempDir, 'division.ts');
      await fs.writeFile(sourceFile, sourceCode);

      const server = new MCPTestingServer();

      const result = await (server as any).handleTestGenerate({
        framework: TestFramework.JEST,
        filePath: sourceFile,
        functionName: 'nonexistent',
      });

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('FUNCTION_NOT_FOUND');
      expect(result.error.message).toContain("Function 'nonexistent' not found");
    });
  });

  describe('test_generate_from_code', () => {
    it('should generate tests from entire code file', async () => {
      const sourceCode = `
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export function farewell(name: string): string {
  return \`Goodbye, \${name}!\`;
}
`;

      const sourceFile = path.join(tempDir, 'greetings.ts');
      await fs.writeFile(sourceFile, sourceCode);

      const server = new MCPTestingServer();
      const result = await (server as any).handleTestGenerateFromCode({
        framework: TestFramework.JEST,
        filePath: sourceFile,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('framework');
      expect(result.data).toHaveProperty('filePath');
      expect(result.data).toHaveProperty('outputPath');
      expect(result.data).toHaveProperty('testsGenerated');
      expect(result.data).toHaveProperty('tests');
      expect(result.data.testsGenerated).toBeGreaterThan(0);
      expect(Array.isArray(result.data.tests)).toBe(true);

      // Verify output file was created
      const outputPath = result.data.outputPath;
      const fileExists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should use custom output path when provided', async () => {
      const sourceCode = `
export function calculate(x: number): number {
  return x * 2;
}
`;

      const sourceFile = path.join(tempDir, 'calculator.ts');
      const outputPath = path.join(tempDir, 'custom-test.ts');
      await fs.writeFile(sourceFile, sourceCode);

      const server = new MCPTestingServer();
      const result = await (server as any).handleTestGenerateFromCode({
        framework: TestFramework.JEST,
        filePath: sourceFile,
        outputPath,
      });

      expect(result.status).toBe('success');
      expect(result.data.outputPath).toBe(outputPath);

      const fileExists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should throw error when no functions found', async () => {
      const sourceCode = `
// Just a comment, no functions
const x = 42;
`;

      const sourceFile = path.join(tempDir, 'empty.ts');
      await fs.writeFile(sourceFile, sourceCode);

      const server = new MCPTestingServer();

      const result = await (server as any).handleTestGenerateFromCode({
        framework: TestFramework.JEST,
        filePath: sourceFile,
      });

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('NO_FUNCTIONS_FOUND');
      expect(result.error.message).toContain('No testable functions found');
    });
  });

  describe('test_generate_fixtures', () => {
    it('should generate fixtures from data schemas', async () => {
      const sourceCode = `
export interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
}

export type Product = {
  sku: string;
  price: number;
  inStock: boolean;
};
`;

      const sourceFile = path.join(tempDir, 'models.ts');
      await fs.writeFile(sourceFile, sourceCode);

      const server = new MCPTestingServer();
      const result = await (server as any).handleTestGenerateFixtures({
        framework: TestFramework.JEST,
        filePath: sourceFile,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('framework');
      expect(result.data).toHaveProperty('filePath');
      expect(result.data).toHaveProperty('schemasFound');
      expect(result.data).toHaveProperty('fixturesGenerated');
      expect(result.data).toHaveProperty('fixtures');
      expect(result.data.schemasFound).toBeGreaterThan(0);
      expect(result.data.fixturesGenerated).toBeGreaterThan(0);
      expect(Array.isArray(result.data.fixtures)).toBe(true);
    });

    it('should throw error when no schemas found', async () => {
      const sourceCode = `
export function doSomething(): void {
  console.log('hello');
}
`;

      const sourceFile = path.join(tempDir, 'no-schemas.ts');
      await fs.writeFile(sourceFile, sourceCode);

      const server = new MCPTestingServer();

      const result = await (server as any).handleTestGenerateFixtures({
        framework: TestFramework.JEST,
        filePath: sourceFile,
      });

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('NO_SCHEMAS_FOUND');
      expect(result.error.message).toContain('No data schemas found');
    });
  });

  describe('test_suggest_cases', () => {
    it('should suggest additional test cases based on existing tests', async () => {
      const testCode = `
import { add } from './math';

describe('add', () => {
  it('should add two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should add two negative numbers', () => {
    expect(add(-2, -3)).toBe(-5);
  });
});
`;

      const testFile = path.join(tempDir, 'math.test.ts');
      await fs.writeFile(testFile, testCode);

      const server = new MCPTestingServer();
      const result = await (server as any).handleTestSuggestCases({
        framework: TestFramework.JEST,
        testPath: testFile,
      });

      expect(result.status).toBe('success');
      expect(result.data).toHaveProperty('framework');
      expect(result.data).toHaveProperty('testPath');
      expect(result.data).toHaveProperty('existingTests');
      expect(result.data).toHaveProperty('suggestionsGenerated');
      expect(result.data).toHaveProperty('suggestions');
      expect(result.data.existingTests).toBeGreaterThan(0);
      expect(Array.isArray(result.data.suggestions)).toBe(true);

      // Suggestions should be sorted by priority
      if (result.data.suggestions.length > 1) {
        const priorities = result.data.suggestions.map((s: any) => s.priority);
        const priorityOrder = ['high', 'medium', 'low'];
        for (let i = 0; i < priorities.length - 1; i++) {
          const currentIndex = priorityOrder.indexOf(priorities[i]);
          const nextIndex = priorityOrder.indexOf(priorities[i + 1]);
          expect(currentIndex).toBeLessThanOrEqual(nextIndex);
        }
      }
    });

    it('should throw error when no tests found', async () => {
      const testCode = `
// Empty test file
`;

      const testFile = path.join(tempDir, 'empty.test.ts');
      await fs.writeFile(testFile, testCode);

      const server = new MCPTestingServer();

      const result = await (server as any).handleTestSuggestCases({
        framework: TestFramework.JEST,
        testPath: testFile,
      });

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('NO_TESTS_FOUND');
      expect(result.error.message).toContain('No existing tests found');
    });
  });
});
