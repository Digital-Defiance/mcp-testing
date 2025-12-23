/**
 * TestManager component
 *
 * Manages test lifecycle including discovery, search, filtering, grouping, and tagging.
 *
 * @packageDocumentation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TestFramework, TestStatus, TestResult } from '../types';

/**
 * Test case information for test management
 */
export interface ManagedTestCase {
  id: string;
  name: string;
  file: string;
  line: number;
  suite: string[];
  tags: string[];
  priority: number;
}

/**
 * Test search options
 */
export interface TestSearchOptions {
  pattern?: string;
  tags?: string[];
  file?: string;
  suite?: string;
  status?: TestStatus;
  minDuration?: number;
  maxDuration?: number;
}

/**
 * Test grouping criteria
 */
export enum TestGroupBy {
  FILE = 'file',
  SUITE = 'suite',
  TAG = 'tag',
  STATUS = 'status',
  DURATION = 'duration',
}

/**
 * Grouped tests
 */
export interface GroupedTests {
  [key: string]: ManagedTestCase[];
}

/**
 * Test filter options
 */
export interface TestFilterOptions {
  status?: TestStatus[];
  minDuration?: number;
  maxDuration?: number;
  tags?: string[];
  files?: string[];
  suites?: string[];
}

/**
 * TestManager class
 *
 * Manages test discovery, search, filtering, grouping, and tagging operations
 */
export class TestManager {
  private testCache: Map<string, ManagedTestCase> = new Map();
  private testResults: Map<string, TestResult> = new Map();
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Discover all tests in the project
   *
   * @param framework - Test framework to use for discovery
   * @param testPaths - Optional specific paths to search
   * @returns Array of discovered test cases
   */
  async discoverTests(framework: TestFramework, testPaths?: string[]): Promise<ManagedTestCase[]> {
    // Check if we're in test mode (for integration tests)
    if (process.env['MCP_TESTING_MOCK_MODE'] === 'true') {
      return this.getMockTests();
    }

    const tests: ManagedTestCase[] = [];
    const searchPaths = testPaths || [this.projectPath];

    for (const searchPath of searchPaths) {
      const discoveredTests = await this.discoverTestsInPath(searchPath, framework);
      tests.push(...discoveredTests);
    }

    // Update cache
    for (const test of tests) {
      this.testCache.set(test.id, test);
    }

    return tests;
  }

  /**
   * Get mock tests for testing purposes
   *
   * @returns Mock test cases
   */
  private getMockTests(): ManagedTestCase[] {
    const mockTests: ManagedTestCase[] = [
      {
        id: 'test-1',
        name: 'should pass',
        file: 'sample.test.ts',
        line: 1,
        suite: ['sample'],
        tags: [],
        priority: 1,
      },
    ];

    // Update cache
    for (const test of mockTests) {
      this.testCache.set(test.id, test);
    }

    return mockTests;
  }

  /**
   * Search for tests matching criteria
   *
   * @param options - Search options
   * @returns Array of matching test cases
   */
  searchTests(options: TestSearchOptions): ManagedTestCase[] {
    const allTests = Array.from(this.testCache.values());
    let results = allTests;

    // Filter by pattern (name matching)
    if (options.pattern) {
      // Escape special regex characters
      const escapedPattern = options.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedPattern, 'i');
      results = results.filter((test) => regex.test(test.name) || regex.test(test.file));
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter((test) => options.tags!.some((tag) => test.tags.includes(tag)));
    }

    // Filter by file
    if (options.file) {
      results = results.filter((test) => test.file.includes(options.file!));
    }

    // Filter by suite
    if (options.suite) {
      results = results.filter((test) => test.suite.some((s) => s.includes(options.suite!)));
    }

    // Filter by status (requires test results)
    if (options.status) {
      results = results.filter((test) => {
        const result = this.testResults.get(test.id);
        return result && result.status === options.status;
      });
    }

    // Filter by duration (requires test results)
    if (options.minDuration !== undefined || options.maxDuration !== undefined) {
      results = results.filter((test) => {
        const result = this.testResults.get(test.id);
        if (!result) return false;

        if (options.minDuration !== undefined && result.duration < options.minDuration) {
          return false;
        }
        if (options.maxDuration !== undefined && result.duration > options.maxDuration) {
          return false;
        }
        return true;
      });
    }

    return results;
  }

  /**
   * Filter tests by multiple criteria
   *
   * @param tests - Tests to filter
   * @param options - Filter options
   * @returns Filtered test cases
   */
  filterTests(tests: ManagedTestCase[], options: TestFilterOptions): ManagedTestCase[] {
    let results = tests;

    // Filter by status
    if (options.status && options.status.length > 0) {
      results = results.filter((test) => {
        const result = this.testResults.get(test.id);
        return result && options.status!.includes(result.status);
      });
    }

    // Filter by duration
    if (options.minDuration !== undefined || options.maxDuration !== undefined) {
      results = results.filter((test) => {
        const result = this.testResults.get(test.id);
        if (!result) return false;

        if (options.minDuration !== undefined && result.duration < options.minDuration) {
          return false;
        }
        if (options.maxDuration !== undefined && result.duration > options.maxDuration) {
          return false;
        }
        return true;
      });
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter((test) => options.tags!.some((tag) => test.tags.includes(tag)));
    }

    // Filter by files
    if (options.files && options.files.length > 0) {
      results = results.filter((test) => options.files!.some((file) => test.file.includes(file)));
    }

    // Filter by suites
    if (options.suites && options.suites.length > 0) {
      results = results.filter((test) =>
        options.suites!.some((suite) => test.suite.includes(suite))
      );
    }

    return results;
  }

  /**
   * Group tests by specified criteria
   *
   * @param tests - Tests to group
   * @param groupBy - Grouping criteria
   * @returns Grouped tests
   */
  groupTests(tests: ManagedTestCase[], groupBy: TestGroupBy): GroupedTests {
    const grouped: GroupedTests = Object.create(null); // Use null prototype to avoid issues with reserved names

    for (const test of tests) {
      let key: string;

      switch (groupBy) {
        case TestGroupBy.FILE:
          key = test.file;
          break;
        case TestGroupBy.SUITE:
          key = test.suite.join(' > ') || 'No Suite';
          break;
        case TestGroupBy.TAG:
          // Group by each tag (test can appear in multiple groups)
          if (test.tags.length === 0) {
            // Tests with no tags go into 'untagged' group
            if (!grouped['untagged']) {
              grouped['untagged'] = [];
            }
            grouped['untagged'].push(test);
          } else {
            for (const tag of test.tags) {
              if (!grouped[tag]) {
                grouped[tag] = [];
              }
              grouped[tag].push(test);
            }
          }
          continue;
        case TestGroupBy.STATUS: {
          const result = this.testResults.get(test.id);
          key = result ? result.status : 'unknown';
          break;
        }
        case TestGroupBy.DURATION: {
          const result = this.testResults.get(test.id);
          if (result) {
            if (result.duration < 100) {
              key = 'fast';
            } else if (result.duration < 1000) {
              key = 'medium';
            } else {
              key = 'slow';
            }
          } else {
            key = 'unknown';
          }
          break;
        }
        default:
          key = 'other';
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(test);
    }

    return grouped;
  }

  /**
   * Add tags to a test
   *
   * @param testId - Test ID
   * @param tags - Tags to add
   * @returns Updated test case
   */
  addTags(testId: string, tags: string[]): ManagedTestCase | undefined {
    const test = this.testCache.get(testId);
    if (!test) {
      return undefined;
    }

    // Add new tags (avoid duplicates)
    const newTags = [...new Set([...test.tags, ...tags])];
    const updatedTest = { ...test, tags: newTags };

    this.testCache.set(testId, updatedTest);
    return updatedTest;
  }

  /**
   * Remove tags from a test
   *
   * @param testId - Test ID
   * @param tags - Tags to remove
   * @returns Updated test case
   */
  removeTags(testId: string, tags: string[]): ManagedTestCase | undefined {
    const test = this.testCache.get(testId);
    if (!test) {
      return undefined;
    }

    // Remove specified tags
    const updatedTags = test.tags.filter((tag) => !tags.includes(tag));
    const updatedTest = { ...test, tags: updatedTags };

    this.testCache.set(testId, updatedTest);
    return updatedTest;
  }

  /**
   * Get tests by tags
   *
   * @param tags - Tags to search for
   * @param matchAll - If true, test must have all tags; if false, any tag matches
   * @returns Array of matching test cases
   */
  getTestsByTags(tags: string[], matchAll: boolean = false): ManagedTestCase[] {
    const allTests = Array.from(this.testCache.values());

    if (matchAll) {
      return allTests.filter((test) => tags.every((tag) => test.tags.includes(tag)));
    } else {
      return allTests.filter((test) => tags.some((tag) => test.tags.includes(tag)));
    }
  }

  /**
   * Update test results (used for filtering by status/duration)
   *
   * @param results - Test results to store
   */
  updateTestResults(results: TestResult[]): void {
    for (const result of results) {
      this.testResults.set(result.id, result);
    }
  }

  /**
   * Get all tests from cache
   *
   * @returns Array of all cached test cases
   */
  getAllTests(): ManagedTestCase[] {
    return Array.from(this.testCache.values());
  }

  /**
   * Clear test cache
   */
  clearCache(): void {
    this.testCache.clear();
    this.testResults.clear();
  }

  /**
   * Discover tests in a specific path
   *
   * @param searchPath - Path to search for tests
   * @param framework - Test framework
   * @returns Array of discovered test cases
   */
  private async discoverTestsInPath(
    searchPath: string,
    framework: TestFramework
  ): Promise<ManagedTestCase[]> {
    const tests: ManagedTestCase[] = [];

    try {
      const stats = await fs.stat(searchPath);

      if (stats.isFile()) {
        // Parse single file
        const fileTests = await this.parseTestFile(searchPath, framework);
        tests.push(...fileTests);
      } else if (stats.isDirectory()) {
        // Recursively search directory
        const entries = await fs.readdir(searchPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(searchPath, entry.name);

          // Skip node_modules and other common ignore patterns
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === '__pycache__'
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            const dirTests = await this.discoverTestsInPath(fullPath, framework);
            tests.push(...dirTests);
          } else if (entry.isFile() && this.isTestFile(entry.name, framework)) {
            const fileTests = await this.parseTestFile(fullPath, framework);
            tests.push(...fileTests);
          }
        }
      }
    } catch (error) {
      console.error(`Error discovering tests in ${searchPath}: ${error}`);
    }

    return tests;
  }

  /**
   * Check if a file is a test file based on framework conventions
   *
   * @param filename - File name to check
   * @param framework - Test framework
   * @returns True if file is a test file
   */
  private isTestFile(filename: string, framework: TestFramework): boolean {
    const testPatterns: Record<TestFramework, RegExp[]> = {
      [TestFramework.JEST]: [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /__tests__\/.*\.[jt]sx?$/],
      [TestFramework.MOCHA]: [/\.test\.[jt]s$/, /\.spec\.[jt]s$/, /^test.*\.[jt]s$/],
      [TestFramework.PYTEST]: [/^test_.*\.py$/, /.*_test\.py$/],
      [TestFramework.VITEST]: [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /__tests__\/.*\.[jt]sx?$/],
      [TestFramework.JASMINE]: [/\.spec\.[jt]s$/, /[sS]pec\.[jt]s$/],
      [TestFramework.AVA]: [/\.test\.[jt]s$/, /^test.*\.[jt]s$/],
    };

    const patterns = testPatterns[framework] || [];
    return patterns.some((pattern) => pattern.test(filename));
  }

  /**
   * Parse a test file to extract test cases
   *
   * @param filePath - Path to test file
   * @param framework - Test framework
   * @returns Array of test cases found in file
   */
  private async parseTestFile(
    filePath: string,
    framework: TestFramework
  ): Promise<ManagedTestCase[]> {
    const tests: ManagedTestCase[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Simple regex-based parsing for common test patterns
      const testPatterns = this.getTestPatterns(framework);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const pattern of testPatterns) {
          const match = line.match(pattern.regex);
          if (match) {
            const testName = match[pattern.nameGroup] || 'Unknown Test';
            const suite = this.extractSuite(lines, i, framework);

            tests.push({
              id: `${filePath}:${i + 1}:${testName}`,
              name: testName,
              file: filePath,
              line: i + 1,
              suite,
              tags: [],
              priority: 0,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error parsing test file ${filePath}: ${error}`);
    }

    return tests;
  }

  /**
   * Get test patterns for a framework
   *
   * @param framework - Test framework
   * @returns Array of test patterns
   */
  private getTestPatterns(framework: TestFramework): Array<{ regex: RegExp; nameGroup: number }> {
    const jestPattern = { regex: /(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/, nameGroup: 1 };
    const pythonPattern = { regex: /def\s+(test_\w+)\s*\(/, nameGroup: 1 };

    const patterns: Record<TestFramework, Array<{ regex: RegExp; nameGroup: number }>> = {
      [TestFramework.JEST]: [jestPattern],
      [TestFramework.MOCHA]: [jestPattern],
      [TestFramework.PYTEST]: [pythonPattern],
      [TestFramework.VITEST]: [jestPattern],
      [TestFramework.JASMINE]: [jestPattern],
      [TestFramework.AVA]: [{ regex: /test\s*\(\s*['"`]([^'"`]+)['"`]/, nameGroup: 1 }],
    };

    return patterns[framework] || [];
  }

  /**
   * Extract suite names from surrounding describe blocks
   *
   * @param lines - File lines
   * @param testLine - Line number of test
   * @param framework - Test framework
   * @returns Array of suite names
   */
  private extractSuite(lines: string[], testLine: number, framework: TestFramework): string[] {
    const suite: string[] = [];

    // Look backwards for describe blocks
    const describePattern = /(?:describe|suite)\s*\(\s*['"`]([^'"`]+)['"`]/;

    let openBraces = 0;
    for (let i = testLine; i >= 0; i--) {
      const line = lines[i];

      // Count braces to track nesting
      openBraces += (line.match(/{/g) || []).length;
      openBraces -= (line.match(/}/g) || []).length;

      const match = line.match(describePattern);
      if (match && openBraces > 0) {
        suite.unshift(match[1]);
      }
    }

    return suite;
  }
}
