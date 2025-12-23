/**
 * Type definitions for MCP Testing Server
 *
 * @packageDocumentation
 */

/**
 * Supported test frameworks
 */
export enum TestFramework {
  JEST = 'jest',
  MOCHA = 'mocha',
  PYTEST = 'pytest',
  VITEST = 'vitest',
  JASMINE = 'jasmine',
  AVA = 'ava',
}

/**
 * Test execution status
 */
export enum TestStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  PENDING = 'pending',
  RUNNING = 'running',
}

/**
 * Test result interface
 */
export interface TestResult {
  id: string;
  name: string;
  fullName: string;
  status: TestStatus;
  duration: number;
  error?: TestError;
  file: string;
  line: number;
  suite: string[];
  tags: string[];
  metadata: TestMetadata;
  timestamp: string;
}

/**
 * Test error details
 */
export interface TestError {
  message: string;
  stack: string;
  expected?: unknown;
  actual?: unknown;
  diff?: string;
  code?: string;
}

/**
 * Test metadata
 */
export interface TestMetadata {
  framework: TestFramework;
  retries: number;
  flaky: boolean;
  slow: boolean;
  tags: string[];
  customData: Record<string, unknown>;
}

/**
 * Test run options
 */
export interface TestRunOptions {
  framework: TestFramework;
  testPath?: string;
  pattern?: string;
  watch?: boolean;
  coverage?: boolean;
  parallel?: boolean;
  maxWorkers?: number;
  timeout?: number;
  env?: Record<string, string>;
}

/**
 * Coverage metrics
 */
export interface CoverageMetrics {
  lines: CoveragePercentage;
  branches: CoveragePercentage;
  functions: CoveragePercentage;
  statements: CoveragePercentage;
}

/**
 * Coverage percentage details
 */
export interface CoveragePercentage {
  total: number;
  covered: number;
  skipped: number;
  percentage: number;
}

/**
 * Coverage report
 */
export interface CoverageReport {
  overall: CoverageMetrics;
  files: Record<string, FileCoverage>;
  timestamp: string;
  framework: TestFramework;
}

/**
 * File coverage details
 */
export interface FileCoverage {
  path: string;
  metrics: CoverageMetrics;
  lines: Record<number, LineCoverage>;
  branches: BranchCoverage[];
  functions: FunctionCoverage[];
}

/**
 * Line coverage details
 */
export interface LineCoverage {
  line: number;
  hits: number;
  covered: boolean;
}

/**
 * Branch coverage details
 */
export interface BranchCoverage {
  line: number;
  branch: number;
  taken: boolean;
}

/**
 * Function coverage details
 */
export interface FunctionCoverage {
  name: string;
  line: number;
  hits: number;
  covered: boolean;
}

/**
 * Coverage gap details
 */
export interface CoverageGap {
  file: string;
  startLine: number;
  endLine: number;
  type: 'line' | 'branch' | 'function';
  suggestion: string;
}

/**
 * Coverage thresholds
 */
export interface CoverageThresholds {
  lines?: number;
  branches?: number;
  functions?: number;
  statements?: number;
}

/**
 * Threshold violation details
 */
export interface ThresholdViolation {
  metric: 'lines' | 'branches' | 'functions' | 'statements';
  actual: number;
  threshold: number;
  file?: string;
}

/**
 * Coverage trend data point
 */
export interface CoverageTrend {
  timestamp: string;
  metrics: CoverageMetrics;
  commit?: string;
  branch?: string;
}

/**
 * Time range for trend analysis
 */
export interface TimeRange {
  start: string;
  end: string;
}

/**
 * Report format types
 */
export enum ReportFormat {
  JSON = 'json',
  HTML = 'html',
  LCOV = 'lcov',
  COBERTURA = 'cobertura',
}

/**
 * Flaky test information
 */
export interface FlakyTest {
  testId: string;
  testName: string;
  file: string;
  line: number;
  failureRate: number;
  totalRuns: number;
  failures: number;
  causes: FlakinessCause[];
  history: FlakyTestRun[];
}

/**
 * Flakiness cause types
 */
export type FlakinessCauseType =
  | 'timing'
  | 'external-dependency'
  | 'race-condition'
  | 'random-data'
  | 'unknown';

/**
 * Flakiness cause details
 */
export interface FlakinessCause {
  type: FlakinessCauseType;
  confidence: number;
  description: string;
}

/**
 * Flaky test run record
 */
export interface FlakyTestRun {
  timestamp: string;
  status: TestStatus;
  duration: number;
  error?: TestError;
}

/**
 * Flakiness fix suggestion
 */
export interface FlakinessFix {
  type: string;
  description: string;
  code?: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Flaky detection options
 */
export interface FlakyDetectionOptions {
  testId?: string;
  testPath?: string;
  pattern?: string;
  iterations?: number;
  framework: TestFramework;
  timeout?: number;
}

/**
 * Flakiness analysis result
 */
export interface FlakinessAnalysis {
  isFlaky: boolean;
  failureRate: number;
  causes: FlakinessCause[];
  confidence: number;
}

/**
 * Test case for flaky detection
 */
export interface TestCase {
  id: string;
  name: string;
  file: string;
  line: number;
  suite: string[];
  tags: string[];
  priority: number;
}

/**
 * Mutation type enumeration
 */
export enum MutationType {
  ARITHMETIC_OPERATOR = 'arithmetic_operator',
  RELATIONAL_OPERATOR = 'relational_operator',
  LOGICAL_OPERATOR = 'logical_operator',
  UNARY_OPERATOR = 'unary_operator',
  ASSIGNMENT_OPERATOR = 'assignment_operator',
  RETURN_VALUE = 'return_value',
  CONDITIONAL = 'conditional',
  LITERAL = 'literal',
}

/**
 * Mutation result
 */
export interface MutationResult {
  id: string;
  file: string;
  line: number;
  mutationType: MutationType;
  original: string;
  mutated: string;
  killed: boolean;
  killedBy: string[];
  duration: number;
}

/**
 * Mutation report
 */
export interface MutationReport {
  totalMutations: number;
  killedMutations: number;
  survivedMutations: number;
  mutationScore: number;
  mutations: MutationResult[];
  timestamp: string;
}

/**
 * Mutation test options
 */
export interface MutationTestOptions {
  framework: TestFramework;
  filePath?: string;
  pattern?: string;
  testPath?: string;
  timeout?: number;
  mutationTypes?: MutationType[];
}

/**
 * Code mutation
 */
export interface Mutation {
  id: string;
  file: string;
  line: number;
  column: number;
  mutationType: MutationType;
  original: string;
  mutated: string;
  description: string;
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysis {
  affectedTests: TestCase[];
  totalTests: number;
  affectedPercentage: number;
  changes: CodeChange[];
  prioritizedTests: TestCase[];
}

/**
 * Code change details
 */
export interface CodeChange {
  file: string;
  type: 'added' | 'modified' | 'deleted';
  lines: number[];
  functions: string[];
}

/**
 * Impact analysis options
 */
export interface ImpactAnalysisOptions {
  changes?: CodeChange[];
  gitDiff?: string;
  baseBranch?: string;
  coverageReport?: CoverageReport;
  framework: TestFramework;
}

/**
 * Performance benchmark options
 */
export interface PerformanceBenchmarkOptions {
  framework: TestFramework;
  testPath?: string;
  pattern?: string;
  slowThreshold?: number; // milliseconds
  includeHistory?: boolean;
  timeout?: number;
}

/**
 * Performance benchmark result
 */
export interface PerformanceBenchmarkResult {
  testId: string;
  testName: string;
  file: string;
  line: number;
  duration: number;
  slow: boolean;
  trend?: PerformanceTrend;
  optimizationSuggestions: OptimizationSuggestion[];
}

/**
 * Performance trend data
 */
export interface PerformanceTrend {
  current: number;
  average: number;
  min: number;
  max: number;
  history: PerformanceDataPoint[];
  regression: boolean;
  regressionPercentage?: number;
}

/**
 * Performance data point
 */
export interface PerformanceDataPoint {
  timestamp: string;
  duration: number;
  commit?: string;
  branch?: string;
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  type: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  code?: string;
  estimatedImprovement?: string;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  totalTests: number;
  totalDuration: number;
  averageDuration: number;
  slowTests: PerformanceBenchmarkResult[];
  fastestTests: PerformanceBenchmarkResult[];
  slowestTests: PerformanceBenchmarkResult[];
  regressions: PerformanceBenchmarkResult[];
  timestamp: string;
  framework: TestFramework;
}
