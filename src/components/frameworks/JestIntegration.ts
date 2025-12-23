/**
 * Jest Framework Integration
 *
 * Provides Jest-specific test runner integration with support for:
 * - Jest configuration loading and validation
 * - Snapshot testing
 * - Watch mode
 * - Coverage reporting
 *
 * @packageDocumentation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TestFramework, TestRunOptions, TestResult } from '../../types';
import { FrameworkConfig } from '../FrameworkDetector';

/**
 * Jest-specific configuration options
 */
export interface JestConfig extends FrameworkConfig {
  // Jest-specific options
  snapshotSerializers?: string[];
  setupFiles?: string[];
  setupFilesAfterEnv?: string[];
  testEnvironment?: string;
  moduleNameMapper?: Record<string, string>;
  transform?: Record<string, string>;
  collectCoverageFrom?: string[];
  coveragePathIgnorePatterns?: string[];
  globals?: Record<string, unknown>;
  maxConcurrency?: number;
  bail?: number | boolean;
  verbose?: boolean;
}

/**
 * Jest snapshot test result
 */
export interface JestSnapshotResult {
  added: number;
  updated: number;
  unmatched: number;
  matched: number;
  total: number;
  filesAdded: number;
  filesUpdated: number;
  filesUnmatched: number;
  filesRemoved: number;
}

/**
 * Jest Integration class
 *
 * Handles Jest-specific test execution, configuration, and features
 */
export class JestIntegration {
  /**
   * Load Jest configuration from project
   *
   * @param projectPath - Path to project root
   * @returns Jest configuration
   */
  async loadConfig(projectPath: string): Promise<JestConfig> {
    // Try to find Jest config file
    const configFiles = [
      'jest.config.js',
      'jest.config.ts',
      'jest.config.mjs',
      'jest.config.cjs',
      'jest.config.json',
    ];

    for (const configFile of configFiles) {
      const configPath = path.join(projectPath, configFile);
      try {
        await fs.access(configPath);

        // For JSON files, we can parse directly
        if (configFile.endsWith('.json')) {
          const content = await fs.readFile(configPath, 'utf-8');
          const config = JSON.parse(content);
          return this.normalizeConfig(config);
        }

        // For JS/TS files, we would need to use dynamic import
        // For now, return default config with note
        console.log(
          `Found Jest config at ${configFile}, using defaults (dynamic import not implemented)`
        );
        return this.getDefaultConfig();
      } catch {
        // File doesn't exist, continue
      }
    }

    // Check package.json for Jest config
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      if (packageJson.jest) {
        return this.normalizeConfig(packageJson.jest);
      }
    } catch {
      // package.json doesn't exist or doesn't have Jest config
    }

    // Return default config
    return this.getDefaultConfig();
  }

  /**
   * Get default Jest configuration
   *
   * @returns Default Jest configuration
   */
  getDefaultConfig(): JestConfig {
    return {
      framework: TestFramework.JEST,
      testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
      coverageDirectory: 'coverage',
      coverageReporters: ['json', 'lcov', 'text', 'clover'],
      timeout: 5000,
      customConfig: {},
      testEnvironment: 'node',
      collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.d.ts'],
      coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
      verbose: false,
    };
  }

  /**
   * Normalize Jest configuration
   *
   * @param config - Raw configuration object
   * @returns Normalized Jest configuration
   */
  private normalizeConfig(config: Record<string, unknown>): JestConfig {
    const defaults = this.getDefaultConfig();

    return {
      framework: TestFramework.JEST,
      testMatch: (config['testMatch'] as string[]) || defaults.testMatch,
      testPathIgnorePatterns:
        (config['testPathIgnorePatterns'] as string[]) || defaults.testPathIgnorePatterns,
      coverageDirectory: (config['coverageDirectory'] as string) || defaults.coverageDirectory,
      coverageReporters: (config['coverageReporters'] as string[]) || defaults.coverageReporters,
      timeout: (config['timeout'] as number) || defaults.timeout,
      customConfig: config,
      snapshotSerializers: config['snapshotSerializers'] as string[] | undefined,
      setupFiles: config['setupFiles'] as string[] | undefined,
      setupFilesAfterEnv: config['setupFilesAfterEnv'] as string[] | undefined,
      testEnvironment: (config['testEnvironment'] as string) || defaults.testEnvironment,
      moduleNameMapper: config['moduleNameMapper'] as Record<string, string> | undefined,
      transform: config['transform'] as Record<string, string> | undefined,
      collectCoverageFrom:
        (config['collectCoverageFrom'] as string[]) || defaults.collectCoverageFrom,
      coveragePathIgnorePatterns:
        (config['coveragePathIgnorePatterns'] as string[]) || defaults.coveragePathIgnorePatterns,
      globals: config['globals'] as Record<string, unknown> | undefined,
      maxConcurrency: config['maxConcurrency'] as number | undefined,
      bail: config['bail'] as number | boolean | undefined,
      verbose: (config['verbose'] as boolean) || defaults.verbose,
    };
  }

  /**
   * Build Jest command arguments
   *
   * @param options - Test run options
   * @param config - Jest configuration
   * @returns Command arguments array
   */
  buildCommandArgs(options: TestRunOptions, config: JestConfig): string[] {
    const args: string[] = ['jest'];

    // Add test path if specified
    if (options.testPath) {
      args.push(options.testPath);
    }

    // Add test name pattern
    if (options.pattern) {
      args.push('--testNamePattern', options.pattern);
    }

    // Add coverage flag
    if (options.coverage) {
      args.push('--coverage');

      // Add coverage options from config
      if (config.collectCoverageFrom && config.collectCoverageFrom.length > 0) {
        args.push('--collectCoverageFrom', config.collectCoverageFrom.join(','));
      }
    }

    // Add watch mode
    if (options.watch) {
      args.push('--watch');
    }

    // Add max workers for parallel execution
    if (options.maxWorkers) {
      args.push('--maxWorkers', options.maxWorkers.toString());
    }

    // Add timeout
    if (options.timeout) {
      args.push('--testTimeout', options.timeout.toString());
    }

    // Add verbose flag
    if (config.verbose) {
      args.push('--verbose');
    }

    // Add bail option
    if (config.bail !== undefined) {
      if (typeof config.bail === 'boolean') {
        if (config.bail) {
          args.push('--bail');
        }
      } else {
        args.push('--bail', config.bail.toString());
      }
    }

    // Add JSON output for easier parsing
    args.push('--json');

    // Add no colors for cleaner output parsing
    args.push('--no-colors');

    return args;
  }

  /**
   * Parse Jest snapshot results from output
   *
   * @param output - Jest output string
   * @returns Snapshot results
   */
  parseSnapshotResults(output: string): JestSnapshotResult | null {
    try {
      // Jest outputs snapshot summary in a specific format
      // Example: "Snapshots:   2 passed, 2 total"
      // Example: "Snapshot Summary"
      //          " › 1 snapshot written from 1 test suite."

      const snapshotResult: JestSnapshotResult = {
        added: 0,
        updated: 0,
        unmatched: 0,
        matched: 0,
        total: 0,
        filesAdded: 0,
        filesUpdated: 0,
        filesUnmatched: 0,
        filesRemoved: 0,
      };

      // Parse snapshot summary
      const snapshotSummaryMatch = output.match(/Snapshots:\s+(.+)/);
      if (snapshotSummaryMatch) {
        const summary = snapshotSummaryMatch[1];

        // Parse individual counts
        const addedMatch = summary.match(/(\d+)\s+written/);
        if (addedMatch) {
          snapshotResult.added = parseInt(addedMatch[1], 10);
        }

        const updatedMatch = summary.match(/(\d+)\s+updated/);
        if (updatedMatch) {
          snapshotResult.updated = parseInt(updatedMatch[1], 10);
        }

        const unmatchedMatch = summary.match(/(\d+)\s+failed/);
        if (unmatchedMatch) {
          snapshotResult.unmatched = parseInt(unmatchedMatch[1], 10);
        }

        const passedMatch = summary.match(/(\d+)\s+passed/);
        if (passedMatch) {
          snapshotResult.matched = parseInt(passedMatch[1], 10);
        }

        const totalMatch = summary.match(/(\d+)\s+total/);
        if (totalMatch) {
          snapshotResult.total = parseInt(totalMatch[1], 10);
        }
      }

      // Parse file-level snapshot changes
      const fileAddedMatch = output.match(
        /(\d+)\s+snapshot(?:s)?\s+written\s+from\s+(\d+)\s+test\s+suite/
      );
      if (fileAddedMatch) {
        snapshotResult.filesAdded = parseInt(fileAddedMatch[2], 10);
      }

      const fileUpdatedMatch = output.match(
        /(\d+)\s+snapshot(?:s)?\s+updated\s+from\s+(\d+)\s+test\s+suite/
      );
      if (fileUpdatedMatch) {
        snapshotResult.filesUpdated = parseInt(fileUpdatedMatch[2], 10);
      }

      return snapshotResult;
    } catch (error) {
      console.error(`Error parsing Jest snapshot results: ${error}`);
      return null;
    }
  }

  /**
   * Validate Jest configuration
   *
   * @param config - Jest configuration to validate
   * @returns Validation result with errors and warnings
   */
  validateConfig(config: JestConfig): { valid: boolean; errors: string[]; warnings: string[] } {
    const result = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    // Validate test match patterns
    if (!config.testMatch || config.testMatch.length === 0) {
      result.warnings.push('No testMatch patterns specified, using defaults');
    }

    // Validate coverage directory
    if (!config.coverageDirectory) {
      result.warnings.push('No coverageDirectory specified, using default "coverage"');
    }

    // Validate timeout
    if (config.timeout && config.timeout < 0) {
      result.valid = false;
      result.errors.push('Timeout must be a positive number');
    }

    // Validate max concurrency
    if (config.maxConcurrency && config.maxConcurrency < 1) {
      result.valid = false;
      result.errors.push('maxConcurrency must be at least 1');
    }

    // Validate test environment
    const validEnvironments = ['node', 'jsdom'];
    if (config.testEnvironment && !validEnvironments.includes(config.testEnvironment)) {
      result.warnings.push(
        `Test environment "${config.testEnvironment}" may not be supported. Valid options: ${validEnvironments.join(', ')}`
      );
    }

    return result;
  }

  /**
   * Support snapshot update mode
   *
   * @param options - Test run options
   * @returns Modified options with snapshot update flag
   */
  enableSnapshotUpdate(options: TestRunOptions): TestRunOptions {
    return {
      ...options,
      env: {
        ...options.env,
        UPDATE_SNAPSHOTS: 'true',
      },
    };
  }

  /**
   * Get Jest-specific environment variables
   *
   * @param config - Jest configuration
   * @returns Environment variables object
   */
  getEnvironmentVariables(config: JestConfig): Record<string, string> {
    const env: Record<string, string> = {};

    // Set NODE_ENV if not already set
    if (!process.env['NODE_ENV']) {
      env['NODE_ENV'] = 'test';
    }

    // Add Jest-specific env vars
    if (config.testEnvironment) {
      env['JEST_TEST_ENVIRONMENT'] = config.testEnvironment;
    }

    return env;
  }
}
