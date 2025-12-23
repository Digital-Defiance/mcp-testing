/**
 * Property-based tests for TestGenerator filesystem integration
 *
 * @packageDocumentation
 */

import fc from 'fast-check';
import { TestGenerator, FilesystemOperations } from '../../components/TestGenerator';
import { TestFramework } from '../../types';

/**
 * Mock filesystem operations for testing
 */
class MockFilesystemOperations implements FilesystemOperations {
  private files: Map<string, string> = new Map();
  private readCalls: string[] = [];
  private writeCalls: Array<{ path: string; content: string }> = [];

  async readFile(path: string): Promise<string> {
    this.readCalls.push(path);

    if (!this.files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }

    return this.files.get(path)!;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.writeCalls.push({ path, content });
    this.files.set(path, content);
  }

  async fileExists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  // Test helpers
  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  getReadCalls(): string[] {
    return this.readCalls;
  }

  getWriteCalls(): Array<{ path: string; content: string }> {
    return this.writeCalls;
  }

  clear(): void {
    this.files.clear();
    this.readCalls = [];
    this.writeCalls = [];
  }
}

describe('TestGenerator Filesystem Integration Property Tests', () => {
  let generator: TestGenerator;
  let mockFs: MockFilesystemOperations;

  beforeEach(() => {
    mockFs = new MockFilesystemOperations();
    generator = new TestGenerator(mockFs);
  });

  describe('Property 74: Filesystem integration works', () => {
    it('should successfully read source files and write generated tests for any valid TypeScript code', async () => {
      // **Feature: mcp-testing-server, Property 74: Filesystem integration works**

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            functionName: fc
              .string({ minLength: 1, maxLength: 30 })
              .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
            paramCount: fc.integer({ min: 0, max: 3 }),
            isAsync: fc.boolean(),
            isExported: fc.boolean(),
          }),
          async ({ functionName, paramCount, isAsync, isExported }) => {
            // Arrange - Generate TypeScript source code
            const params = Array.from({ length: paramCount }, (_, i) => `param${i}: string`).join(
              ', '
            );
            const asyncKeyword = isAsync ? 'async ' : '';
            const exportKeyword = isExported ? 'export ' : '';
            const returnStatement = isAsync
              ? 'return Promise.resolve("result");'
              : 'return "result";';

            const sourceCode = `
${exportKeyword}${asyncKeyword}function ${functionName}(${params}) {
  ${returnStatement}
}
`;

            const filePath = `/test/${functionName}.ts`;
            mockFs.setFile(filePath, sourceCode);

            // Act - Generate tests from code file
            const tests = await generator.generateTestsFromCode(filePath);

            // Assert - Verify filesystem operations
            expect(mockFs.getReadCalls()).toContain(filePath);
            expect(mockFs.getReadCalls().length).toBeGreaterThan(0);

            // Verify tests were generated
            expect(tests).toBeDefined();
            expect(Array.isArray(tests)).toBe(true);
            expect(tests.length).toBeGreaterThan(0);

            // Verify tests reference the correct function
            for (const test of tests) {
              expect(test.targetFunction).toBe(functionName);
              expect(test.targetFile).toBe(filePath);
            }

            // Act - Write generated tests
            const outputPath = `/test/${functionName}.test.ts`;
            await generator.writeGeneratedTests(tests, outputPath);

            // Assert - Verify write operation
            const writeCalls = mockFs.getWriteCalls();
            expect(writeCalls.length).toBeGreaterThan(0);
            expect(writeCalls.some((call) => call.path === outputPath)).toBe(true);

            // Verify written content contains test code
            const writtenContent = writeCalls.find((call) => call.path === outputPath)?.content;
            expect(writtenContent).toBeDefined();
            expect(writtenContent).toContain('describe(');
            expect(writtenContent).toContain('it(');
            expect(writtenContent).toContain(functionName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle file read errors gracefully for any file path', async () => {
      // **Feature: mcp-testing-server, Property 74: Filesystem integration works**

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).map((s) => `/test/${s}.ts`),
          async (filePath) => {
            // Arrange - Don't set the file in mock filesystem

            // Act & Assert - Should throw error for non-existent file
            await expect(generator.generateTestsFromCode(filePath)).rejects.toThrow(
              'File not found'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should write test files successfully for any output path', async () => {
      // **Feature: mcp-testing-server, Property 74: Filesystem integration works**

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            functionName: fc
              .string({ minLength: 1, maxLength: 30 })
              .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
            outputPath: fc.string({ minLength: 1 }).map((s) => `/test/${s}.test.ts`),
          }),
          async ({ functionName, outputPath }) => {
            // Arrange - Create a simple function and generate tests
            const sourceCode = `export function ${functionName}() { return "result"; }`;
            const filePath = `/test/${functionName}.ts`;
            mockFs.setFile(filePath, sourceCode);

            const tests = await generator.generateTestsFromCode(filePath);

            // Act - Write generated tests
            await generator.writeGeneratedTests(tests, outputPath);

            // Assert - Verify write operation
            const writeCalls = mockFs.getWriteCalls();
            expect(writeCalls.length).toBeGreaterThan(0);

            const writeCall = writeCalls.find((call) => call.path === outputPath);
            expect(writeCall).toBeDefined();

            // Verify content is not empty
            const content = writeCall!.content;
            expect(content.length).toBeGreaterThan(0);

            // Verify the file was written to the mock filesystem
            expect(await mockFs.fileExists(outputPath)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly parse TypeScript functions with various signatures', async () => {
      // **Feature: mcp-testing-server, Property 74: Filesystem integration works**

      // Reserved keywords in JavaScript/TypeScript that cannot be used as function names
      const reservedKeywords = new Set([
        'break',
        'case',
        'catch',
        'class',
        'const',
        'continue',
        'debugger',
        'default',
        'delete',
        'do',
        'else',
        'enum',
        'export',
        'extends',
        'false',
        'finally',
        'for',
        'function',
        'if',
        'import',
        'in',
        'instanceof',
        'new',
        'null',
        'return',
        'super',
        'switch',
        'this',
        'throw',
        'true',
        'try',
        'typeof',
        'var',
        'void',
        'while',
        'with',
        'yield',
        'let',
        'static',
        'implements',
        'interface',
        'package',
        'private',
        'protected',
        'public',
        'await',
        'async',
      ]);

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            functionName: fc
              .string({ minLength: 1, maxLength: 30 })
              .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s) && !reservedKeywords.has(s)),
            parameters: fc.array(
              fc.record({
                name: fc
                  .string({ minLength: 1, maxLength: 20 })
                  .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s) && !reservedKeywords.has(s)),
                type: fc.constantFrom('string', 'number', 'boolean', 'any'),
                optional: fc.boolean(),
              }),
              { maxLength: 3 }
            ),
            returnType: fc.constantFrom('string', 'number', 'boolean', 'void', 'Promise<string>'),
            isAsync: fc.boolean(),
            isExported: fc.boolean(),
          }),
          async ({ functionName, parameters, returnType, isAsync, isExported }) => {
            // Arrange - Generate TypeScript source code with explicit types
            const paramList = parameters
              .map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
              .join(', ');

            const asyncKeyword = isAsync ? 'async ' : '';
            const exportKeyword = isExported ? 'export ' : '';

            // Generate appropriate return statement based on return type
            let returnStatement: string;
            if (returnType === 'void') {
              returnStatement = 'return;';
            } else if (returnType.startsWith('Promise')) {
              returnStatement = 'return Promise.resolve("result");';
            } else if (returnType === 'number') {
              returnStatement = 'return 42;';
            } else if (returnType === 'boolean') {
              returnStatement = 'return true;';
            } else {
              returnStatement = 'return "result";';
            }

            const sourceCode = `
${exportKeyword}${asyncKeyword}function ${functionName}(${paramList}): ${returnType} {
  ${returnStatement}
}
`;

            const filePath = `/test/${functionName}.ts`;
            mockFs.setFile(filePath, sourceCode);

            // Act - Generate tests from code file
            const tests = await generator.generateTestsFromCode(filePath);

            // Assert - Verify function was parsed correctly
            expect(tests.length).toBeGreaterThan(0);

            // Verify all tests reference the correct function
            for (const test of tests) {
              expect(test.targetFunction).toBe(functionName);
              expect(test.targetFile).toBe(filePath);

              // Verify test code contains function name
              expect(test.code).toContain(functionName);

              // Verify async handling
              if (isAsync) {
                expect(test.code).toContain('async');
                expect(test.code).toContain('await');
              }
            }

            // Verify edge case tests were generated for parameters
            if (parameters.length > 0) {
              const hasEdgeCaseTests = tests.some(
                (t) =>
                  t.description.includes('Edge case') || t.description.includes('Error handling')
              );
              expect(hasEdgeCaseTests).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle arrow functions and function expressions', async () => {
      // **Feature: mcp-testing-server, Property 74: Filesystem integration works**

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            functionName: fc
              .string({ minLength: 2, maxLength: 30 })
              .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s))
              .filter(
                (s) =>
                  ![
                    'in',
                    'if',
                    'do',
                    'for',
                    'let',
                    'var',
                    'new',
                    'try',
                    'const',
                    'class',
                    'enum',
                    'export',
                    'import',
                    'return',
                    'function',
                    'while',
                    'break',
                    'case',
                    'catch',
                    'continue',
                    'default',
                    'delete',
                    'else',
                    'finally',
                    'instanceof',
                    'switch',
                    'this',
                    'throw',
                    'typeof',
                    'void',
                    'with',
                    'yield',
                    'async',
                    'await',
                    'static',
                    'extends',
                    'super',
                    'debugger',
                    'implements',
                    'interface',
                    'package',
                    'private',
                    'protected',
                    'public',
                  ].includes(s)
              ), // Avoid reserved keywords
            isArrow: fc.boolean(),
            isExported: fc.boolean(),
          }),
          async ({ functionName, isArrow, isExported }) => {
            // Arrange - Generate TypeScript source code with arrow function or function expression
            const exportKeyword = isExported ? 'export ' : '';

            const sourceCode = isArrow
              ? `${exportKeyword}const ${functionName} = (param: string) => {
  return "result";
};`
              : `${exportKeyword}const ${functionName} = function(param: string) {
  return "result";
};`;

            const filePath = `/test/${functionName}.ts`;
            mockFs.setFile(filePath, sourceCode);

            // Act - Generate tests from code file
            const tests = await generator.generateTestsFromCode(filePath);

            // Assert - Verify function was parsed
            expect(tests.length).toBeGreaterThan(0);

            // Verify tests reference the correct function
            for (const test of tests) {
              expect(test.targetFunction).toBe(functionName);
              expect(test.code).toContain(functionName);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
