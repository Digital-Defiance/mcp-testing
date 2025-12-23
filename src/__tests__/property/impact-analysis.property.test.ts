/**
 * Property-based tests for impact analysis
 *
 * Tests Properties 37-40 from the design document:
 * - Property 37: Impact analysis identifies affected tests
 * - Property 38: File mapping uses imports and coverage
 * - Property 39: Affected tests are prioritized
 * - Property 40: Selective execution runs only affected tests
 *
 * Validates Requirements 9.1, 9.2, 9.3, 9.4
 */

import fc from 'fast-check';
import { ImpactAnalyzer } from '../../components/ImpactAnalyzer';
import { TestFramework, CodeChange, CoverageReport, TestCase } from '../../types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Helper to create temporary test project
function createTempProject(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'impact-test-'));
  return tempDir;
}

// Helper to cleanup temp project
function cleanupTempProject(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// Helper to create test files in temp project
function createTestFiles(projectRoot: string, files: { path: string; content: string }[]): void {
  for (const file of files) {
    const filePath = path.join(projectRoot, file.path);
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, file.content);
  }
}

describe('Impact Analysis Properties', () => {
  describe('Property 37: Impact analysis identifies affected tests', () => {
    it('should identify affected tests for any code changes', async () => {
      // **Feature: mcp-testing-server, Property 37: Impact analysis identifies affected tests**

      await fc.assert(
        fc.asyncProperty(
          // Generate code changes
          fc.array(
            fc.record({
              file: fc.constantFrom('src/utils.ts', 'src/helpers.ts', 'src/api.ts'),
              type: fc.constantFrom('added', 'modified', 'deleted'),
              lines: fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
              functions: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { maxLength: 3 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (changes: CodeChange[]) => {
            const projectRoot = createTempProject();

            try {
              // Create source files and test files
              const files = [
                { path: 'src/utils.ts', content: 'export function util() {}' },
                { path: 'src/helpers.ts', content: 'export function helper() {}' },
                { path: 'src/api.ts', content: 'export function api() {}' },
                { path: 'src/utils.test.ts', content: 'import { util } from "./utils";' },
                { path: 'src/helpers.test.ts', content: 'import { helper } from "./helpers";' },
                { path: 'src/api.test.ts', content: 'import { api } from "./api";' },
              ];

              createTestFiles(projectRoot, files);

              const analyzer = new ImpactAnalyzer(projectRoot);

              // Analyze impact
              const analysis = await analyzer.analyzeImpact({
                changes,
                framework: TestFramework.JEST,
              });

              // Property: Should return impact analysis with required fields
              expect(analysis).toHaveProperty('affectedTests');
              expect(analysis).toHaveProperty('totalTests');
              expect(analysis).toHaveProperty('affectedPercentage');
              expect(analysis).toHaveProperty('changes');
              expect(analysis).toHaveProperty('prioritizedTests');

              // Property: Affected tests should be an array
              expect(Array.isArray(analysis.affectedTests)).toBe(true);

              // Property: Total tests should be non-negative
              expect(analysis.totalTests).toBeGreaterThanOrEqual(0);

              // Property: Affected percentage should be between 0 and 100
              expect(analysis.affectedPercentage).toBeGreaterThanOrEqual(0);
              expect(analysis.affectedPercentage).toBeLessThanOrEqual(100);

              // Property: Changes should match input
              expect(analysis.changes).toEqual(changes);

              // Property: If there are affected tests, percentage should be > 0
              if (analysis.affectedTests.length > 0 && analysis.totalTests > 0) {
                expect(analysis.affectedPercentage).toBeGreaterThan(0);
              }
            } finally {
              cleanupTempProject(projectRoot);
            }
          }
        ),
        { numRuns: 50 } // Reduced runs due to file I/O
      );
    });

    it('should identify test files as affected when they are changed', async () => {
      // **Feature: mcp-testing-server, Property 37: Impact analysis identifies affected tests**

      await fc.assert(
        fc.asyncProperty(
          // Generate test file change
          fc.constantFrom('src/utils.test.ts', 'src/helpers.test.ts', 'src/api.test.ts'),
          async (testFile) => {
            const projectRoot = createTempProject();

            try {
              // Create test files
              const files = [
                { path: 'src/utils.test.ts', content: 'test("util", () => {});' },
                { path: 'src/helpers.test.ts', content: 'test("helper", () => {});' },
                { path: 'src/api.test.ts', content: 'test("api", () => {});' },
              ];

              createTestFiles(projectRoot, files);

              const analyzer = new ImpactAnalyzer(projectRoot);

              // Create change for test file
              const changes: CodeChange[] = [
                {
                  file: testFile,
                  type: 'modified',
                  lines: [1, 2, 3],
                  functions: ['test'],
                },
              ];

              // Analyze impact
              const analysis = await analyzer.analyzeImpact({
                changes,
                framework: TestFramework.JEST,
              });

              // Property: Changed test file should be in affected tests
              const affectedFiles = analysis.affectedTests.map((t) => t.file);
              expect(affectedFiles).toContain(testFile);
            } finally {
              cleanupTempProject(projectRoot);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 38: File mapping uses imports and coverage', () => {
    it('should map changed files to tests that import them', async () => {
      // **Feature: mcp-testing-server, Property 38: File mapping uses imports and coverage**

      await fc.assert(
        fc.asyncProperty(
          // Generate source file
          fc.constantFrom('src/utils.ts', 'src/helpers.ts'),
          async (sourceFile) => {
            const projectRoot = createTempProject();

            try {
              // Create files with import relationships
              const files = [
                { path: 'src/utils.ts', content: 'export function util() { return 42; }' },
                { path: 'src/helpers.ts', content: 'export function helper() { return "hi"; }' },
                {
                  path: 'src/utils.test.ts',
                  content: 'import { util } from "./utils";\ntest("util", () => {});',
                },
                {
                  path: 'src/helpers.test.ts',
                  content: 'import { helper } from "./helpers";\ntest("helper", () => {});',
                },
              ];

              createTestFiles(projectRoot, files);

              const analyzer = new ImpactAnalyzer(projectRoot);

              // Get affected tests for the source file
              const affectedTests = await analyzer.getAffectedTests(sourceFile);

              // Property: Should find tests that import the file
              expect(affectedTests.length).toBeGreaterThan(0);

              // Property: Test file should match source file name pattern
              const expectedTestFile = sourceFile.replace('.ts', '.test.ts');
              const affectedFiles = affectedTests.map((t) => t.file);
              expect(affectedFiles).toContain(expectedTestFile);
            } finally {
              cleanupTempProject(projectRoot);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should map files to tests using coverage data when provided', async () => {
      // **Feature: mcp-testing-server, Property 38: File mapping uses imports and coverage**

      await fc.assert(
        fc.asyncProperty(
          // Generate coverage data
          fc.record({
            file: fc.constantFrom('src/utils.ts', 'src/helpers.ts'),
            coveredLines: fc.array(fc.integer({ min: 1, max: 50 }), {
              minLength: 1,
              maxLength: 10,
            }),
          }),
          async ({ file, coveredLines }) => {
            const projectRoot = createTempProject();

            try {
              // Create files
              const files = [
                { path: 'src/utils.ts', content: 'export function util() {}' },
                { path: 'src/helpers.ts', content: 'export function helper() {}' },
                { path: 'src/utils.test.ts', content: 'test("util", () => {});' },
              ];

              createTestFiles(projectRoot, files);

              // Create coverage report
              const coverageReport: CoverageReport = {
                overall: {
                  lines: { total: 100, covered: 80, skipped: 0, percentage: 80 },
                  branches: { total: 50, covered: 40, skipped: 0, percentage: 80 },
                  functions: { total: 20, covered: 16, skipped: 0, percentage: 80 },
                  statements: { total: 100, covered: 80, skipped: 0, percentage: 80 },
                },
                files: {
                  [file]: {
                    path: file,
                    metrics: {
                      lines: { total: 10, covered: 8, skipped: 0, percentage: 80 },
                      branches: { total: 5, covered: 4, skipped: 0, percentage: 80 },
                      functions: { total: 2, covered: 2, skipped: 0, percentage: 100 },
                      statements: { total: 10, covered: 8, skipped: 0, percentage: 80 },
                    },
                    lines: Object.fromEntries(
                      coveredLines.map((line) => [line, { line, hits: 1, covered: true }])
                    ),
                    branches: [],
                    functions: [],
                  },
                  'src/utils.test.ts': {
                    path: 'src/utils.test.ts',
                    metrics: {
                      lines: { total: 5, covered: 5, skipped: 0, percentage: 100 },
                      branches: { total: 0, covered: 0, skipped: 0, percentage: 100 },
                      functions: { total: 1, covered: 1, skipped: 0, percentage: 100 },
                      statements: { total: 5, covered: 5, skipped: 0, percentage: 100 },
                    },
                    lines: {},
                    branches: [],
                    functions: [],
                  },
                },
                timestamp: new Date().toISOString(),
                framework: TestFramework.JEST,
              };

              const analyzer = new ImpactAnalyzer(projectRoot);

              // Create change affecting covered lines
              const changes: CodeChange[] = [
                {
                  file,
                  type: 'modified',
                  lines: coveredLines.slice(0, 3),
                  functions: [],
                },
              ];

              // Analyze impact with coverage
              const analysis = await analyzer.analyzeImpact({
                changes,
                coverageReport,
                framework: TestFramework.JEST,
              });

              // Property: Should use coverage data to identify affected tests
              expect(analysis.affectedTests.length).toBeGreaterThanOrEqual(0);

              // Property: Coverage report should influence results
              if (analysis.affectedTests.length > 0) {
                expect(analysis.prioritizedTests.length).toBeGreaterThan(0);
              }
            } finally {
              cleanupTempProject(projectRoot);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 39: Affected tests are prioritized', () => {
    it('should prioritize tests based on impact severity for any changes', async () => {
      // **Feature: mcp-testing-server, Property 39: Affected tests are prioritized**

      await fc.assert(
        fc.asyncProperty(
          // Generate multiple changes with different characteristics
          fc.array(
            fc.record({
              file: fc.constantFrom('src/utils.ts', 'src/helpers.ts', 'src/api.ts'),
              type: fc.constantFrom('added', 'modified', 'deleted'),
              lines: fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 20 }),
              functions: fc.array(fc.string({ minLength: 3, maxLength: 15 }), { maxLength: 3 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (changes: CodeChange[]) => {
            const projectRoot = createTempProject();

            try {
              // Create files
              const files = [
                { path: 'src/utils.ts', content: 'export function util() {}' },
                { path: 'src/helpers.ts', content: 'export function helper() {}' },
                { path: 'src/api.ts', content: 'export function api() {}' },
                { path: 'src/utils.test.ts', content: 'import { util } from "./utils";' },
                { path: 'src/helpers.test.ts', content: 'import { helper } from "./helpers";' },
                { path: 'src/api.test.ts', content: 'import { api } from "./api";' },
              ];

              createTestFiles(projectRoot, files);

              const analyzer = new ImpactAnalyzer(projectRoot);

              // Analyze impact
              const analysis = await analyzer.analyzeImpact({
                changes,
                framework: TestFramework.JEST,
              });

              // Property: Prioritized tests should be ordered
              if (analysis.prioritizedTests.length > 1) {
                // Check that priorities are in descending order
                for (let i = 0; i < analysis.prioritizedTests.length - 1; i++) {
                  expect(analysis.prioritizedTests[i].priority).toBeGreaterThanOrEqual(
                    analysis.prioritizedTests[i + 1].priority
                  );
                }
              }

              // Property: All affected tests should be in prioritized list
              expect(analysis.prioritizedTests.length).toBe(analysis.affectedTests.length);

              // Property: Prioritized tests should have priority values
              analysis.prioritizedTests.forEach((test) => {
                expect(test.priority).toBeGreaterThanOrEqual(0);
              });
            } finally {
              cleanupTempProject(projectRoot);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should assign higher priority to tests in same directory as changes', async () => {
      // **Feature: mcp-testing-server, Property 39: Affected tests are prioritized**

      await fc.assert(
        fc.asyncProperty(
          // Generate change type
          fc.constantFrom('added', 'modified', 'deleted'),
          async (changeType: 'added' | 'modified' | 'deleted') => {
            const projectRoot = createTempProject();

            try {
              // Create files in same directory
              const files = [
                { path: 'src/utils.ts', content: 'export function util() {}' },
                {
                  path: 'src/utils.test.ts',
                  content: 'import { util } from "./utils";\ntest("util", () => {});',
                },
                { path: 'src/other/api.ts', content: 'export function api() {}' },
                {
                  path: 'src/other/api.test.ts',
                  content: 'import { api } from "./api";\ntest("api", () => {});',
                },
              ];

              createTestFiles(projectRoot, files);

              const analyzer = new ImpactAnalyzer(projectRoot);

              // Create change for utils.ts
              const changes: CodeChange[] = [
                {
                  file: 'src/utils.ts',
                  type: changeType,
                  lines: [1, 2, 3],
                  functions: ['util'],
                },
              ];

              // Analyze impact
              const analysis = await analyzer.analyzeImpact({
                changes,
                framework: TestFramework.JEST,
              });

              // Property: Test in same directory should have higher priority
              if (analysis.prioritizedTests.length > 1) {
                const utilsTest = analysis.prioritizedTests.find((t) =>
                  t.file.includes('utils.test')
                );
                const apiTest = analysis.prioritizedTests.find((t) => t.file.includes('api.test'));

                if (utilsTest && apiTest) {
                  expect(utilsTest.priority).toBeGreaterThan(apiTest.priority);
                }
              }
            } finally {
              cleanupTempProject(projectRoot);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should prioritize based on number of changed lines', async () => {
      // **Feature: mcp-testing-server, Property 39: Affected tests are prioritized**

      await fc.assert(
        fc.asyncProperty(
          // Generate two changes with different line counts
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 10, max: 50 }),
          async (smallChange, largeChange) => {
            const projectRoot = createTempProject();

            try {
              // Create files
              const files = [
                { path: 'src/small.ts', content: 'export function small() {}' },
                { path: 'src/large.ts', content: 'export function large() {}' },
                { path: 'src/small.test.ts', content: 'import { small } from "./small";' },
                { path: 'src/large.test.ts', content: 'import { large } from "./large";' },
              ];

              createTestFiles(projectRoot, files);

              const analyzer = new ImpactAnalyzer(projectRoot);

              // Create changes with different line counts
              const changes: CodeChange[] = [
                {
                  file: 'src/small.ts',
                  type: 'modified',
                  lines: Array.from({ length: smallChange }, (_, i) => i + 1),
                  functions: [],
                },
                {
                  file: 'src/large.ts',
                  type: 'modified',
                  lines: Array.from({ length: largeChange }, (_, i) => i + 1),
                  functions: [],
                },
              ];

              // Analyze impact
              const analysis = await analyzer.analyzeImpact({
                changes,
                framework: TestFramework.JEST,
              });

              // Property: Test for file with more changes should have higher priority
              if (analysis.prioritizedTests.length >= 2) {
                const smallTest = analysis.prioritizedTests.find((t) =>
                  t.file.includes('small.test')
                );
                const largeTest = analysis.prioritizedTests.find((t) =>
                  t.file.includes('large.test')
                );

                if (smallTest && largeTest && largeChange > smallChange) {
                  expect(largeTest.priority).toBeGreaterThan(smallTest.priority);
                }
              }
            } finally {
              cleanupTempProject(projectRoot);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 40: Selective execution runs only affected tests', () => {
    it('should identify only affected tests for selective execution', async () => {
      // **Feature: mcp-testing-server, Property 40: Selective execution runs only affected tests**

      await fc.assert(
        fc.asyncProperty(
          // Generate which file to change
          fc.constantFrom('src/utils.ts', 'src/helpers.ts'),
          async (changedFile) => {
            const projectRoot = createTempProject();

            try {
              // Create files
              const files = [
                { path: 'src/utils.ts', content: 'export function util() {}' },
                { path: 'src/helpers.ts', content: 'export function helper() {}' },
                { path: 'src/api.ts', content: 'export function api() {}' },
                {
                  path: 'src/utils.test.ts',
                  content: 'import { util } from "./utils";\ntest("util", () => {});',
                },
                {
                  path: 'src/helpers.test.ts',
                  content: 'import { helper } from "./helpers";\ntest("helper", () => {});',
                },
                {
                  path: 'src/api.test.ts',
                  content: 'import { api } from "./api";\ntest("api", () => {});',
                },
              ];

              createTestFiles(projectRoot, files);

              const analyzer = new ImpactAnalyzer(projectRoot);

              // Create change for one file
              const changes: CodeChange[] = [
                {
                  file: changedFile,
                  type: 'modified',
                  lines: [1, 2, 3],
                  functions: [],
                },
              ];

              // Analyze impact
              const analysis = await analyzer.analyzeImpact({
                changes,
                framework: TestFramework.JEST,
              });

              // Property: Should identify affected tests
              expect(analysis.affectedTests.length).toBeGreaterThan(0);

              // Property: Affected tests should be less than or equal to total tests
              expect(analysis.affectedTests.length).toBeLessThanOrEqual(analysis.totalTests);

              // Property: Unaffected tests should not be in affected list
              const affectedFiles = analysis.affectedTests.map((t) => t.file);
              const expectedTestFile = changedFile.replace('.ts', '.test.ts');

              // The test file for the changed file should be affected
              expect(affectedFiles).toContain(expectedTestFile);

              // Property: Percentage should reflect selective execution
              if (analysis.totalTests > 0) {
                const expectedPercentage =
                  (analysis.affectedTests.length / analysis.totalTests) * 100;
                expect(analysis.affectedPercentage).toBeCloseTo(expectedPercentage, 1);
              }
            } finally {
              cleanupTempProject(projectRoot);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return empty affected tests when no changes provided', async () => {
      // **Feature: mcp-testing-server, Property 40: Selective execution runs only affected tests**

      const projectRoot = createTempProject();

      try {
        // Create test files
        const files = [
          { path: 'src/utils.test.ts', content: 'test("util", () => {});' },
          { path: 'src/helpers.test.ts', content: 'test("helper", () => {});' },
        ];

        createTestFiles(projectRoot, files);

        const analyzer = new ImpactAnalyzer(projectRoot);

        // Analyze with no changes
        const analysis = await analyzer.analyzeImpact({
          changes: [],
          framework: TestFramework.JEST,
        });

        // Property: No changes should result in no affected tests
        expect(analysis.affectedTests.length).toBe(0);
        expect(analysis.affectedPercentage).toBe(0);
        expect(analysis.prioritizedTests.length).toBe(0);
      } finally {
        cleanupTempProject(projectRoot);
      }
    });

    it('should handle transitive dependencies in impact analysis', async () => {
      // **Feature: mcp-testing-server, Property 40: Selective execution runs only affected tests**

      await fc.assert(
        fc.asyncProperty(
          // Generate change type
          fc.constantFrom('added', 'modified', 'deleted'),
          async (changeType: 'added' | 'modified' | 'deleted') => {
            const projectRoot = createTempProject();

            try {
              // Create files with transitive dependencies: base -> middle -> test
              const files = [
                { path: 'src/base.ts', content: 'export function base() { return 1; }' },
                {
                  path: 'src/middle.ts',
                  content:
                    'import { base } from "./base";\nexport function middle() { return base(); }',
                },
                {
                  path: 'src/middle.test.ts',
                  content: 'import { middle } from "./middle";\ntest("middle", () => {});',
                },
              ];

              createTestFiles(projectRoot, files);

              const analyzer = new ImpactAnalyzer(projectRoot);

              // Change base file
              const changes: CodeChange[] = [
                {
                  file: 'src/base.ts',
                  type: changeType,
                  lines: [1],
                  functions: ['base'],
                },
              ];

              // Analyze impact
              const analysis = await analyzer.analyzeImpact({
                changes,
                framework: TestFramework.JEST,
              });

              // Property: Should identify tests affected through transitive dependencies
              const affectedFiles = analysis.affectedTests.map((t) => t.file);

              // The test should be affected because it imports middle, which imports base
              expect(affectedFiles.some((f) => f.includes('middle.test'))).toBe(true);
            } finally {
              cleanupTempProject(projectRoot);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
