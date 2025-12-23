/**
 * Zod schemas for MCP Testing Server tools
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Test framework enum schema
 */
export const TestFrameworkSchema = z.enum(['jest', 'mocha', 'pytest', 'vitest', 'jasmine', 'ava']);

/**
 * Report format enum schema
 */
export const ReportFormatSchema = z.enum(['json', 'html', 'lcov', 'cobertura']);

/**
 * Mutation type enum schema
 */
export const MutationTypeSchema = z.enum([
  'arithmetic_operator',
  'relational_operator',
  'logical_operator',
  'unary_operator',
  'assignment_operator',
  'return_value',
  'conditional',
  'literal',
]);

/**
 * Test run options schema
 */
export const TestRunOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  testPath: z.string().optional(),
  pattern: z.string().optional(),
  watch: z.boolean().optional(),
  coverage: z.boolean().optional(),
  parallel: z.boolean().optional(),
  maxWorkers: z.number().int().positive().optional(),
  timeout: z.number().int().positive().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

/**
 * Test stop options schema
 */
export const TestStopOptionsSchema = z.object({
  runId: z.string(),
});

/**
 * Test list options schema
 */
export const TestListOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  testPath: z.string().optional(),
  pattern: z.string().optional(),
});

/**
 * Test search options schema
 */
export const TestSearchOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  query: z.string(),
  searchBy: z.enum(['name', 'tag', 'file', 'suite']).optional(),
  testPath: z.string().optional(),
});

/**
 * Coverage analyze options schema
 */
export const CoverageAnalyzeOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  testPath: z.string().optional(),
  pattern: z.string().optional(),
  timeout: z.number().int().positive().optional(),
});

/**
 * Coverage report options schema
 */
export const CoverageReportOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  format: ReportFormatSchema,
  outputPath: z.string().optional(),
});

/**
 * Coverage gaps options schema
 */
export const CoverageGapsOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  threshold: z.number().min(0).max(100).optional(),
});

/**
 * Coverage trends options schema
 */
export const CoverageTrendsOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  branch: z.string().optional(),
});

/**
 * Coverage export options schema
 */
export const CoverageExportOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  format: ReportFormatSchema,
  outputPath: z.string(),
});

/**
 * Test generate options schema
 */
export const TestGenerateOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  filePath: z.string(),
  functionName: z.string().optional(),
  includeEdgeCases: z.boolean().optional(),
  includePropertyTests: z.boolean().optional(),
});

/**
 * Test generate from code options schema
 */
export const TestGenerateFromCodeOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  filePath: z.string(),
  outputPath: z.string().optional(),
});

/**
 * Test generate fixtures options schema
 */
export const TestGenerateFixturesOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  filePath: z.string(),
  dataSchema: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Test suggest cases options schema
 */
export const TestSuggestCasesOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  testPath: z.string(),
  coverageReport: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Test debug options schema
 */
export const TestDebugOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  testPath: z.string(),
  testName: z.string(),
  breakpoints: z
    .array(
      z.object({
        file: z.string(),
        line: z.number().int().positive(),
      })
    )
    .optional(),
});

/**
 * Test analyze failure options schema
 */
export const TestAnalyzeFailureOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  testPath: z.string(),
  testName: z.string(),
  errorMessage: z.string().optional(),
});

/**
 * Test compare values options schema
 */
export const TestCompareValuesOptionsSchema = z.object({
  expected: z.unknown(),
  actual: z.unknown(),
  deep: z.boolean().optional(),
});

/**
 * Test detect flaky options schema
 */
export const TestDetectFlakyOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  testPath: z.string().optional(),
  testName: z.string().optional(),
  iterations: z.number().int().positive().optional(),
  timeout: z.number().int().positive().optional(),
});

/**
 * Test mutation run options schema
 */
export const TestMutationRunOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  filePath: z.string(),
  testPath: z.string().optional(),
  mutationTypes: z.array(MutationTypeSchema).optional(),
  timeout: z.number().int().positive().optional(),
});

/**
 * Test impact analyze options schema
 */
export const TestImpactAnalyzeOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  gitDiff: z.string().optional(),
  baseBranch: z.string().optional(),
  changedFiles: z.array(z.string()).optional(),
});

/**
 * Test performance benchmark options schema
 */
export const TestPerformanceBenchmarkOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  testPath: z.string().optional(),
  pattern: z.string().optional(),
  slowThreshold: z.number().int().positive().optional(),
  includeHistory: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
});

/**
 * Test configure framework options schema
 */
export const TestConfigureFrameworkOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  configPath: z.string().optional(),
  customConfig: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Test get config options schema
 */
export const TestGetConfigOptionsSchema = z.object({
  framework: TestFrameworkSchema,
});

/**
 * Test set config options schema
 */
export const TestSetConfigOptionsSchema = z.object({
  framework: TestFrameworkSchema,
  config: z.record(z.string(), z.unknown()),
  merge: z.boolean().optional(),
});
