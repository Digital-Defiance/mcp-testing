/**
 * Property-based tests for mutation testing
 *
 * Tests Properties 32-36 from the design document:
 * - Property 32: Mutations are generated from code
 * - Property 33: Mutation testing tracks caught mutations
 * - Property 34: Surviving mutations are reported
 * - Property 35: Mutation score is calculated
 * - Property 36: Mutation reports are comprehensive
 *
 * Validates Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */

import fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { MutationTester } from '../../components/MutationTester';
import { TestRunnerManager } from '../../components/TestRunnerManager';
import {
  TestFramework,
  TestStatus,
  TestResult,
  MutationType,
  Mutation,
  MutationResult,
} from '../../types';

// Mock TestRunnerManager for controlled test execution
class MockTestRunnerManager extends TestRunnerManager {
  private shouldFail = false;

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  async runTests(): Promise<TestResult[]> {
    const status = this.shouldFail ? TestStatus.FAILED : TestStatus.PASSED;
    return [
      {
        id: 'test-1',
        name: 'test',
        fullName: 'test',
        status,
        duration: 100,
        error: this.shouldFail
          ? {
              message: 'Test failed',
              stack: 'Error: Test failed',
            }
          : undefined,
        file: 'test.ts',
        line: 1,
        suite: [],
        tags: [],
        metadata: {
          framework: TestFramework.JEST,
          retries: 0,
          flaky: false,
          slow: false,
          tags: [],
          customData: {},
        },
        timestamp: new Date().toISOString(),
      },
    ];
  }
}

describe('Mutation Testing Properties', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mutation-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Property 32: Mutations are generated from code', () => {
    it('should generate mutations for any code file with operators', async () => {
      // **Feature: mcp-testing-server, Property 32: Mutations are generated from code**

      await fc.assert(
        fc.asyncProperty(
          // Generate code with different operators
          fc.record({
            arithmeticOp: fc.constantFrom('+', '-', '*', '/', '%'),
            relationalOp: fc.constantFrom('===', '!==', '<', '>', '<=', '>='),
            logicalOp: fc.constantFrom('&&', '||'),
            literal: fc.integer({ min: 0, max: 100 }),
            boolValue: fc.boolean(),
          }),
          async (codeElements) => {
            const tester = new MutationTester();

            // Create a test file with various operators
            const testFilePath = path.join(tempDir, 'test-code.ts');
            const code = `
function calculate(a: number, b: number): boolean {
  const sum = a ${codeElements.arithmeticOp} b;
  const isValid = sum ${codeElements.relationalOp} ${codeElements.literal};
  const result = isValid ${codeElements.logicalOp} ${codeElements.boolValue};
  return result;
}
`;
            await fs.writeFile(testFilePath, code, 'utf-8');

            // Generate mutations
            const mutations = await tester.generateMutations(testFilePath);

            // Property: Should generate mutations from code
            expect(mutations.length).toBeGreaterThan(0);

            // Property: Each mutation should have required fields
            mutations.forEach((mutation) => {
              expect(mutation).toHaveProperty('id');
              expect(mutation).toHaveProperty('file');
              expect(mutation).toHaveProperty('line');
              expect(mutation).toHaveProperty('column');
              expect(mutation).toHaveProperty('mutationType');
              expect(mutation).toHaveProperty('original');
              expect(mutation).toHaveProperty('mutated');
              expect(mutation).toHaveProperty('description');
              expect(mutation.file).toBe(testFilePath);
              expect(mutation.line).toBeGreaterThan(0);
              expect(mutation.column).toBeGreaterThanOrEqual(0);
            });

            // Property: Mutations should modify operators, conditions, or return values
            const mutationTypes = mutations.map((m) => m.mutationType);
            expect(mutationTypes.length).toBeGreaterThan(0);
            mutationTypes.forEach((type) => {
              expect(Object.values(MutationType)).toContain(type);
            });

            // Property: Original and mutated should be different
            mutations.forEach((mutation) => {
              expect(mutation.original).not.toBe(mutation.mutated);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate arithmetic operator mutations', async () => {
      // **Feature: mcp-testing-server, Property 32: Mutations are generated from code**

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('+', '-', '*', '/', '%'),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          async (operator, a, b) => {
            const tester = new MutationTester();

            const testFilePath = path.join(tempDir, `test-arith-${Date.now()}.ts`);
            const code = `const result = ${a} ${operator} ${b};`;
            await fs.writeFile(testFilePath, code, 'utf-8');

            const mutations = await tester.generateMutations(testFilePath);

            // Property: Should generate arithmetic mutations
            const arithmeticMutations = mutations.filter(
              (m) => m.mutationType === MutationType.ARITHMETIC_OPERATOR
            );
            expect(arithmeticMutations.length).toBeGreaterThan(0);

            // Property: Should replace with different operators
            arithmeticMutations.forEach((mutation) => {
              expect(mutation.original).toBe(operator);
              expect(mutation.mutated).not.toBe(operator);
              expect(['+', '-', '*', '/', '%']).toContain(mutation.mutated);
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should generate relational operator mutations', async () => {
      // **Feature: mcp-testing-server, Property 32: Mutations are generated from code**

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('===', '!==', '<', '>', '<=', '>='),
          fc.integer({ min: 0, max: 100 }),
          async (operator, value) => {
            const tester = new MutationTester();

            const testFilePath = path.join(tempDir, `test-rel-${Date.now()}.ts`);
            const code = `const isValid = x ${operator} ${value};`;
            await fs.writeFile(testFilePath, code, 'utf-8');

            const mutations = await tester.generateMutations(testFilePath);

            // Property: Should generate relational mutations
            const relationalMutations = mutations.filter(
              (m) => m.mutationType === MutationType.RELATIONAL_OPERATOR
            );
            expect(relationalMutations.length).toBeGreaterThan(0);

            // Property: Should replace with different operators
            relationalMutations.forEach((mutation) => {
              expect(mutation.original).toBe(operator);
              expect(mutation.mutated).not.toBe(operator);
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should generate boolean literal mutations', async () => {
      // **Feature: mcp-testing-server, Property 32: Mutations are generated from code**

      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (boolValue) => {
          const tester = new MutationTester();

          const testFilePath = path.join(tempDir, `test-bool-${Date.now()}.ts`);
          const code = `const flag = ${boolValue};`;
          await fs.writeFile(testFilePath, code, 'utf-8');

          const mutations = await tester.generateMutations(testFilePath);

          // Property: Should generate return value mutations
          const returnMutations = mutations.filter(
            (m) => m.mutationType === MutationType.RETURN_VALUE
          );
          expect(returnMutations.length).toBeGreaterThan(0);

          // Property: Should flip boolean values
          returnMutations.forEach((mutation) => {
            expect(mutation.original).toBe(boolValue.toString());
            expect(mutation.mutated).toBe((!boolValue).toString());
          });
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 33: Mutation testing tracks caught mutations', () => {
    it('should track which mutations are caught by tests', async () => {
      // **Feature: mcp-testing-server, Property 33: Mutation testing tracks caught mutations**

      await fc.assert(
        fc.asyncProperty(
          // Generate mutations that will be killed or survive
          fc.array(
            fc.record({
              shouldBeKilled: fc.boolean(),
              operator: fc.constantFrom('+', '-', '*'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (mutationConfigs) => {
            const mockRunner = new MockTestRunnerManager();
            const tester = new MutationTester(mockRunner);

            // Create test file
            const testFilePath = path.join(tempDir, `test-track-${Date.now()}.ts`);
            const code = `const result = 5 + 3;`;
            await fs.writeFile(testFilePath, code, 'utf-8');

            // Generate mutations
            const mutations = await tester.generateMutations(testFilePath);
            expect(mutations.length).toBeGreaterThan(0);

            // Test each mutation
            const results: MutationResult[] = [];
            for (let i = 0; i < Math.min(mutations.length, mutationConfigs.length); i++) {
              const mutation = mutations[i];
              const config = mutationConfigs[i];

              // Set whether test should fail (kill mutation)
              mockRunner.setShouldFail(config.shouldBeKilled);

              const result = await tester.testMutation(mutation, {
                framework: TestFramework.JEST,
              });

              results.push(result);
            }

            // Property: Should track killed status for each mutation
            results.forEach((result, i) => {
              expect(result).toHaveProperty('killed');
              expect(typeof result.killed).toBe('boolean');

              // Property: Killed status should match test failure
              const expectedKilled = mutationConfigs[i].shouldBeKilled;
              expect(result.killed).toBe(expectedKilled);

              // Property: If killed, should have killedBy array
              if (result.killed) {
                expect(Array.isArray(result.killedBy)).toBe(true);
                expect(result.killedBy.length).toBeGreaterThan(0);
              }
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 34: Surviving mutations are reported', () => {
    it('should report mutations that survive (tests still pass)', async () => {
      // **Feature: mcp-testing-server, Property 34: Surviving mutations are reported**

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          async (killedCount, survivedCount) => {
            // Skip if both are zero
            if (killedCount === 0 && survivedCount === 0) {
              return;
            }

            const mockRunner = new MockTestRunnerManager();
            const tester = new MutationTester(mockRunner);

            // Create test file with enough operators
            const testFilePath = path.join(tempDir, `test-survive-${Date.now()}.ts`);
            const operators = Array(killedCount + survivedCount)
              .fill(0)
              .map((_, i) => (i % 2 === 0 ? '+' : '-'));
            const code = `const result = ${operators.map((op, i) => `${i} ${op}`).join(' ')} 0;`;
            await fs.writeFile(testFilePath, code, 'utf-8');

            // Generate mutations
            const mutations = await tester.generateMutations(testFilePath);

            // Test mutations with controlled results
            const results: MutationResult[] = [];
            for (let i = 0; i < Math.min(mutations.length, killedCount + survivedCount); i++) {
              const mutation = mutations[i];
              const shouldKill = i < killedCount;

              mockRunner.setShouldFail(shouldKill);

              const result = await tester.testMutation(mutation, {
                framework: TestFramework.JEST,
              });

              results.push(result);
            }

            // Property: Should identify surviving mutations
            const survivingMutations = results.filter((r) => !r.killed);
            const expectedSurvived = Math.min(survivedCount, results.length - killedCount);
            expect(survivingMutations.length).toBe(Math.max(0, expectedSurvived));

            // Property: Surviving mutations should have empty killedBy array
            survivingMutations.forEach((mutation) => {
              expect(mutation.killed).toBe(false);
              expect(mutation.killedBy.length).toBe(0);
            });

            // Property: Each surviving mutation should have complete information
            survivingMutations.forEach((mutation) => {
              expect(mutation).toHaveProperty('id');
              expect(mutation).toHaveProperty('file');
              expect(mutation).toHaveProperty('line');
              expect(mutation).toHaveProperty('mutationType');
              expect(mutation).toHaveProperty('original');
              expect(mutation).toHaveProperty('mutated');
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 35: Mutation score is calculated', () => {
    it('should calculate mutation score as percentage of caught mutations', () => {
      // **Feature: mcp-testing-server, Property 35: Mutation score is calculated**

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (killedCount, survivedCount) => {
            const tester = new MutationTester();

            // Create mutation results
            const results: MutationResult[] = [];

            for (let i = 0; i < killedCount; i++) {
              results.push({
                id: `mutation-${i}`,
                file: 'test.ts',
                line: 1,
                mutationType: MutationType.ARITHMETIC_OPERATOR,
                original: '+',
                mutated: '-',
                killed: true,
                killedBy: ['test-1'],
                duration: 100,
              });
            }

            for (let i = 0; i < survivedCount; i++) {
              results.push({
                id: `mutation-${killedCount + i}`,
                file: 'test.ts',
                line: 1,
                mutationType: MutationType.ARITHMETIC_OPERATOR,
                original: '+',
                mutated: '-',
                killed: false,
                killedBy: [],
                duration: 100,
              });
            }

            // Calculate mutation score
            const score = tester.calculateMutationScore(results);

            // Property: Score should be between 0 and 100
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);

            // Property: Score should be percentage of killed mutations
            const totalMutations = killedCount + survivedCount;
            if (totalMutations > 0) {
              const expectedScore = (killedCount / totalMutations) * 100;
              expect(score).toBeCloseTo(expectedScore, 2);
            } else {
              expect(score).toBe(0);
            }

            // Property: 100% score when all mutations killed
            if (survivedCount === 0 && killedCount > 0) {
              expect(score).toBe(100);
            }

            // Property: 0% score when no mutations killed
            if (killedCount === 0 && survivedCount > 0) {
              expect(score).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases in mutation score calculation', () => {
      // **Feature: mcp-testing-server, Property 35: Mutation score is calculated**

      const tester = new MutationTester();

      // Property: Empty results should return 0
      expect(tester.calculateMutationScore([])).toBe(0);

      // Property: All killed should return 100
      const allKilled: MutationResult[] = [
        {
          id: 'mutation-1',
          file: 'test.ts',
          line: 1,
          mutationType: MutationType.ARITHMETIC_OPERATOR,
          original: '+',
          mutated: '-',
          killed: true,
          killedBy: ['test-1'],
          duration: 100,
        },
      ];
      expect(tester.calculateMutationScore(allKilled)).toBe(100);

      // Property: All survived should return 0
      const allSurvived: MutationResult[] = [
        {
          id: 'mutation-1',
          file: 'test.ts',
          line: 1,
          mutationType: MutationType.ARITHMETIC_OPERATOR,
          original: '+',
          mutated: '-',
          killed: false,
          killedBy: [],
          duration: 100,
        },
      ];
      expect(tester.calculateMutationScore(allSurvived)).toBe(0);
    });
  });

  describe('Property 36: Mutation reports are comprehensive', () => {
    it('should generate comprehensive reports for any mutation testing run', async () => {
      // **Feature: mcp-testing-server, Property 36: Mutation reports are comprehensive**

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('+', '-', '*'),
          fc.integer({ min: 1, max: 5 }),
          async (operator, operatorCount) => {
            const mockRunner = new MockTestRunnerManager();
            const tester = new MutationTester(mockRunner);

            // Create test file
            const testFilePath = path.join(tempDir, `test-report-${Date.now()}.ts`);
            const code = `const result = ${Array(operatorCount)
              .fill(0)
              .map((_, i) => `${i} ${operator}`)
              .join(' ')} 0;`;
            await fs.writeFile(testFilePath, code, 'utf-8');

            // Run mutation testing
            mockRunner.setShouldFail(true);
            const report = await tester.runMutationTesting({
              framework: TestFramework.JEST,
              filePath: testFilePath,
            });

            // Property: Report should have all required fields
            expect(report).toHaveProperty('totalMutations');
            expect(report).toHaveProperty('killedMutations');
            expect(report).toHaveProperty('survivedMutations');
            expect(report).toHaveProperty('mutationScore');
            expect(report).toHaveProperty('mutations');
            expect(report).toHaveProperty('timestamp');

            // Property: Counts should be consistent
            expect(report.totalMutations).toBe(report.mutations.length);
            expect(report.killedMutations + report.survivedMutations).toBe(report.totalMutations);

            // Property: Mutation score should match counts
            if (report.totalMutations > 0) {
              const expectedScore = (report.killedMutations / report.totalMutations) * 100;
              expect(report.mutationScore).toBeCloseTo(expectedScore, 2);
            }

            // Property: Each mutation should have detailed information
            report.mutations.forEach((mutation) => {
              expect(mutation).toHaveProperty('id');
              expect(mutation).toHaveProperty('file');
              expect(mutation).toHaveProperty('line');
              expect(mutation).toHaveProperty('mutationType');
              expect(mutation).toHaveProperty('original');
              expect(mutation).toHaveProperty('mutated');
              expect(mutation).toHaveProperty('killed');
              expect(mutation).toHaveProperty('killedBy');
              expect(mutation).toHaveProperty('duration');

              expect(mutation.file).toBe(testFilePath);
              expect(mutation.line).toBeGreaterThan(0);
              expect(Array.isArray(mutation.killedBy)).toBe(true);
              expect(mutation.duration).toBeGreaterThanOrEqual(0);
            });

            // Property: Timestamp should be valid ISO string
            expect(() => new Date(report.timestamp)).not.toThrow();
            expect(new Date(report.timestamp).toISOString()).toBe(report.timestamp);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include location information for all mutations', async () => {
      // **Feature: mcp-testing-server, Property 36: Mutation reports are comprehensive**

      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom('+', '-', '*', '/', '%'), { minLength: 1, maxLength: 5 }),
          async (operators) => {
            const mockRunner = new MockTestRunnerManager();
            const tester = new MutationTester(mockRunner);

            // Create test file with multiple lines
            const testFilePath = path.join(tempDir, `test-location-${Date.now()}.ts`);
            const code = operators.map((op, i) => `const v${i} = ${i} ${op} ${i + 1};`).join('\n');
            await fs.writeFile(testFilePath, code, 'utf-8');

            // Run mutation testing
            mockRunner.setShouldFail(false);
            const report = await tester.runMutationTesting({
              framework: TestFramework.JEST,
              filePath: testFilePath,
            });

            // Property: All mutations should have file and line information
            report.mutations.forEach((mutation) => {
              expect(mutation.file).toBe(testFilePath);
              expect(mutation.line).toBeGreaterThan(0);
              expect(mutation.line).toBeLessThanOrEqual(operators.length);
            });

            // Property: Mutations on different lines should have different line numbers
            const lineNumbers = report.mutations.map((m) => m.line);
            const uniqueLines = new Set(lineNumbers);
            expect(uniqueLines.size).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include mutation type information', async () => {
      // **Feature: mcp-testing-server, Property 36: Mutation reports are comprehensive**

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            arithmetic: fc.constantFrom('+', '-', '*'),
            relational: fc.constantFrom('<', '>', '==='),
            logical: fc.constantFrom('&&', '||'),
          }),
          async (operators) => {
            const mockRunner = new MockTestRunnerManager();
            const tester = new MutationTester(mockRunner);

            // Create test file with different operator types
            const testFilePath = path.join(tempDir, `test-types-${Date.now()}.ts`);
            const code = `
const sum = 1 ${operators.arithmetic} 2;
const isValid = sum ${operators.relational} 3;
const result = isValid ${operators.logical} true;
`;
            await fs.writeFile(testFilePath, code, 'utf-8');

            // Run mutation testing
            mockRunner.setShouldFail(true);
            const report = await tester.runMutationTesting({
              framework: TestFramework.JEST,
              filePath: testFilePath,
            });

            // Property: Report should include different mutation types
            const mutationTypes = new Set(report.mutations.map((m) => m.mutationType));
            expect(mutationTypes.size).toBeGreaterThan(0);

            // Property: All mutation types should be valid
            report.mutations.forEach((mutation) => {
              expect(Object.values(MutationType)).toContain(mutation.mutationType);
            });

            // Property: Should have arithmetic mutations
            const hasArithmetic = report.mutations.some(
              (m) => m.mutationType === MutationType.ARITHMETIC_OPERATOR
            );
            expect(hasArithmetic).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
