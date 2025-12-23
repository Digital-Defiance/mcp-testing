/**
 * Property-based tests for TestGenerator
 *
 * @packageDocumentation
 */

import fc from 'fast-check';
import { TestGenerator, FunctionInfo, DataSchema, TestCase } from '../../components/TestGenerator';
import { TestFramework } from '../../types';

describe('TestGenerator Property Tests', () => {
  let generator: TestGenerator;

  beforeEach(() => {
    generator = new TestGenerator();
  });

  describe('Property 10: Test generation analyzes functions', () => {
    it('should analyze function signatures and generate appropriate unit tests for any valid function', async () => {
      // **Feature: mcp-testing-server, Property 10: Test generation analyzes functions**

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
            filePath: fc.string({ minLength: 1 }).map((s) => `/test/${s}.ts`),
            line: fc.integer({ min: 1, max: 1000 }),
            parameters: fc.array(
              fc.record({
                name: fc
                  .string({ minLength: 1, maxLength: 20 })
                  .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
                type: fc.constantFrom(
                  'string',
                  'number',
                  'boolean',
                  'string[]',
                  'number[]',
                  'object'
                ),
                optional: fc.boolean(),
              }),
              { maxLength: 5 }
            ),
            returnType: fc.constantFrom(
              'string',
              'number',
              'boolean',
              'void',
              'Promise<string>',
              'Promise<number>'
            ),
            isAsync: fc.boolean(),
            isExported: fc.boolean(),
          }),
          async (functionInfo: FunctionInfo) => {
            // Act
            const tests = await generator.generateTests(functionInfo);

            // Assert - verify tests were generated
            expect(tests).toBeDefined();
            expect(Array.isArray(tests)).toBe(true);
            expect(tests.length).toBeGreaterThan(0);

            // Verify each test has required properties
            for (const test of tests) {
              expect(test.name).toBeDefined();
              expect(test.code).toBeDefined();
              expect(test.framework).toBe(TestFramework.JEST);
              expect(test.targetFunction).toBe(functionInfo.name);
              expect(test.targetFile).toBe(functionInfo.filePath);
              expect(['unit', 'property', 'integration']).toContain(test.type);
            }

            // Verify at least one basic test was generated
            const hasBasicTest = tests.some((t) => t.description.includes('Basic unit test'));
            expect(hasBasicTest).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 11: Edge cases are identified', () => {
    it('should identify edge cases, boundary conditions, and error scenarios for any function', async () => {
      // **Feature: mcp-testing-server, Property 11: Edge cases are identified**

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
            filePath: fc.string({ minLength: 1 }).map((s) => `/test/${s}.ts`),
            line: fc.integer({ min: 1, max: 1000 }),
            parameters: fc.array(
              fc.record({
                name: fc
                  .string({ minLength: 1, maxLength: 20 })
                  .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
                type: fc.constantFrom('string', 'number', 'boolean', 'string[]', 'number[]'),
                optional: fc.boolean(),
              }),
              { minLength: 1, maxLength: 3 }
            ),
            returnType: fc.constantFrom('string', 'number', 'boolean'),
            isAsync: fc.boolean(),
            isExported: fc.boolean(),
          }),
          async (functionInfo: FunctionInfo) => {
            // Act
            const tests = await generator.generateTests(functionInfo);

            // Assert - verify edge case tests were generated
            const edgeCaseTests = tests.filter((t) => t.description.includes('Edge case'));
            const errorTests = tests.filter((t) => t.description.includes('Error handling'));

            // Should have edge case tests for functions with parameters
            if (functionInfo.parameters.length > 0) {
              expect(edgeCaseTests.length + errorTests.length).toBeGreaterThan(0);
            }

            // Verify edge case tests cover common scenarios
            for (const param of functionInfo.parameters) {
              if (param.type === 'string') {
                const hasEmptyStringTest = tests.some(
                  (t) => t.name.includes('empty string') || t.code.includes('""')
                );
                expect(hasEmptyStringTest).toBe(true);
              }

              if (param.type === 'number') {
                const hasZeroTest = tests.some(
                  (t) => t.name.includes('zero') || t.code.includes(': 0')
                );
                expect(hasZeroTest).toBe(true);
              }

              if (param.type.includes('[]')) {
                const hasEmptyArrayTest = tests.some(
                  (t) => t.name.includes('empty array') || t.code.includes('[]')
                );
                expect(hasEmptyArrayTest).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 12: Fixtures are generated from requirements', () => {
    it('should generate reusable test fixtures and setup functions for any data schema', async () => {
      // **Feature: mcp-testing-server, Property 12: Fixtures are generated from requirements**

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc
              .string({ minLength: 1, maxLength: 30 })
              .filter((s) => /^[A-Z][a-zA-Z0-9]*$/.test(s)),
            properties: fc.dictionary(
              fc
                .string({ minLength: 1, maxLength: 20 })
                .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
              fc.record({
                type: fc.constantFrom('string', 'number', 'boolean', 'array', 'object'),
                description: fc.option(fc.string({ maxLength: 100 })),
                minimum: fc.option(fc.integer({ min: 0, max: 100 })),
                maximum: fc.option(fc.integer({ min: 100, max: 1000 })),
              }),
              { minKeys: 1, maxKeys: 5 }
            ),
            required: fc.option(
              fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 3 })
            ),
          }),
          async (dataSchema: DataSchema) => {
            // Act
            const fixtures = await generator.generateFixtures(dataSchema);

            // Assert - verify fixtures were generated
            expect(fixtures).toBeDefined();
            expect(Array.isArray(fixtures)).toBe(true);
            expect(fixtures.length).toBeGreaterThan(0);

            // Verify each fixture has required properties
            for (const fixture of fixtures) {
              expect(fixture.name).toBeDefined();
              expect(fixture.code).toBeDefined();
              expect(fixture.description).toBeDefined();
              expect(Array.isArray(fixture.dependencies)).toBe(true);
            }

            // Verify at least one valid fixture exists
            const hasValidFixture = fixtures.some(
              (f) => f.name.includes('valid') || f.description.includes('Valid')
            );
            expect(hasValidFixture).toBe(true);

            // Verify invalid fixtures for required fields
            if (dataSchema.required && dataSchema.required.length > 0) {
              const hasInvalidFixture = fixtures.some(
                (f) => f.name.includes('invalid') || f.description.includes('Invalid')
              );
              expect(hasInvalidFixture).toBe(true);
            }

            // Verify edge case fixtures for numeric fields
            const hasNumericProperty = Object.values(dataSchema.properties).some(
              (p) => p.type === 'number'
            );
            if (hasNumericProperty) {
              const hasEdgeCaseFixture = fixtures.some(
                (f) => f.name.includes('Min') || f.name.includes('Max')
              );
              expect(hasEdgeCaseFixture).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 13: Test suggestions improve coverage', () => {
    it('should suggest additional test scenarios that would improve coverage for any existing test suite', async () => {
      // **Feature: mcp-testing-server, Property 13: Test suggestions improve coverage**

      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              description: fc.string({ minLength: 1, maxLength: 100 }),
              assertions: fc.integer({ min: 1, max: 10 }),
              coverage: fc.array(
                fc.constantFrom(
                  'basic',
                  'error-handling',
                  'edge-cases',
                  'boundary-conditions',
                  'integration'
                ),
                {
                  minLength: 1,
                  maxLength: 3,
                }
              ),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (existingTests: TestCase[]) => {
            // Act
            const suggestions = await generator.suggestTestCases(existingTests);

            // Assert - verify suggestions were generated
            expect(suggestions).toBeDefined();
            expect(Array.isArray(suggestions)).toBe(true);

            // Verify each suggestion has required properties
            for (const suggestion of suggestions) {
              expect(suggestion.testCase).toBeDefined();
              expect(suggestion.reason).toBeDefined();
              expect(['high', 'medium', 'low']).toContain(suggestion.priority);
              expect(['edge-case', 'boundary', 'error', 'integration']).toContain(
                suggestion.category
              );
            }

            // Verify suggestions address coverage gaps
            const coveredAreas = new Set<string>();
            existingTests.forEach((test) =>
              test.coverage.forEach((area) => coveredAreas.add(area))
            );

            const commonAreas = [
              'error-handling',
              'edge-cases',
              'boundary-conditions',
              'integration',
            ];
            const missingAreas = commonAreas.filter((area) => !coveredAreas.has(area));

            if (missingAreas.length > 0) {
              // Should have suggestions for missing areas
              expect(suggestions.length).toBeGreaterThan(0);

              // Suggestions should address gaps
              const suggestionCategories = suggestions.map((s) => s.category);
              const addressesGaps = missingAreas.some((area) => {
                if (area.includes('error')) return suggestionCategories.includes('error');
                if (area.includes('edge')) return suggestionCategories.includes('edge-case');
                if (area.includes('boundary')) return suggestionCategories.includes('boundary');
                if (area.includes('integration'))
                  return suggestionCategories.includes('integration');
                return false;
              });

              expect(addressesGaps).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 14: Generated tests follow project patterns', () => {
    it('should generate tests that match the project naming conventions and test patterns for any function', async () => {
      // **Feature: mcp-testing-server, Property 14: Generated tests follow project patterns**

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
            filePath: fc.string({ minLength: 1 }).map((s) => `/test/${s}.ts`),
            line: fc.integer({ min: 1, max: 1000 }),
            parameters: fc.array(
              fc.record({
                name: fc
                  .string({ minLength: 1, maxLength: 20 })
                  .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
                type: fc.constantFrom('string', 'number', 'boolean'),
                optional: fc.boolean(),
              }),
              { maxLength: 3 }
            ),
            returnType: fc.constantFrom('string', 'number', 'boolean', 'void'),
            isAsync: fc.boolean(),
            isExported: fc.boolean(),
          }),
          async (functionInfo: FunctionInfo) => {
            // Act
            const tests = await generator.generateTests(functionInfo);

            // Assert - verify tests follow patterns
            for (const test of tests) {
              // Test names should be descriptive
              expect(test.name.length).toBeGreaterThan(5);
              expect(test.name).toMatch(/should/i);

              // Test code should follow AAA pattern (Arrange, Act, Assert)
              if (test.type === 'unit') {
                expect(test.code).toContain('// Arrange');
                // Act and Assert might be combined for error tests
                const hasAct = test.code.includes('// Act');
                const hasAssert = test.code.includes('// Assert');
                const hasActAndAssert = test.code.includes('// Act & Assert');
                expect(hasAct || hasActAndAssert).toBe(true);
                expect(hasAssert || hasActAndAssert).toBe(true);
              }

              // Test code should use describe/it blocks
              expect(test.code).toContain('describe(');
              expect(test.code).toContain('it(');

              // Test code should have proper imports
              expect(test.code).toContain('import');
              expect(test.code).toContain(`from '`);

              // Test code should use expect assertions
              expect(test.code).toContain('expect(');

              // Async tests should use async/await properly
              if (functionInfo.isAsync) {
                expect(test.code).toContain('async');
                expect(test.code).toContain('await');
              }

              // Test code should reference the target function
              expect(test.code).toContain(functionInfo.name);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
