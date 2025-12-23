/**
 * Mocha Framework Integration
 *
 * Provides Mocha-specific test runner integration with support for:
 * - Mocha configuration loading and validation
 * - Watch mode
 * - Multiple reporters
 * - Hooks and test organization
 *
 * @packageDocumentation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TestFramework, TestRunOptions } from '../../types';
import { FrameworkConfig } from '../FrameworkDetector';

/**
 * Mocha-specific configuration options
 */
export interface MochaConfig extends FrameworkConfig {
  // Mocha-specific options
  require?: string[];
  reporter?: string;
  reporterOptions?: Record<string, unknown>;
  ui?: string;
  bail?: boolean;
  checkLeaks?: boolean;
  fullTrace?: boolean;
  grep?: string;
  invert?: boolean;
  retries?: number;
  slow?: number;
  forbidOnly?: boolean;
  forbidPending?: boolean;
  global?: string[];
  jobs?: number;
  parallel?: boolean;
  extension?: string[];
  file?: string[];
  spec?: string[];
  watch?: boolean;
  watchFiles?: string[];
  watchIgnore?: string[];
}

/**
 * Mocha Integration class
 *
 * Handles Mocha-specific test execution, configuration, and features
 */
export class MochaIntegration {
  /**
   * Load Mocha configuration from project
   *
   * @param projectPath - Path to project root
   * @returns Mocha configuration
   */
  async loadConfig(projectPath: string): Promise<MochaConfig> {
    // Try to find Mocha config file
    const configFiles = [
      '.mocharc.json',
      '.mocharc.js',
      '.mocharc.cjs',
      '.mocharc.yaml',
      '.mocharc.yml',
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

        // For JS files, we would need to use dynamic import
        // For now, return default config with note
        console.log(
          `Found Mocha config at ${configFile}, using defaults (dynamic import not implemented)`
        );
        return this.getDefaultConfig();
      } catch {
        // File doesn't exist, continue
      }
    }

    // Check package.json for Mocha config
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      if (packageJson.mocha) {
        return this.normalizeConfig(packageJson.mocha);
      }
    } catch {
      // package.json doesn't exist or doesn't have Mocha config
    }

    // Return default config
    return this.getDefaultConfig();
  }

  /**
   * Get default Mocha configuration
   *
   * @returns Default Mocha configuration
   */
  getDefaultConfig(): MochaConfig {
    return {
      framework: TestFramework.MOCHA,
      testMatch: ['test/**/*.js', 'test/**/*.ts', '**/*.test.js', '**/*.spec.js'],
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
      coverageDirectory: 'coverage',
      coverageReporters: ['json', 'lcov', 'text'],
      timeout: 2000,
      customConfig: {},
      reporter: 'spec',
      ui: 'bdd',
      bail: false,
      checkLeaks: false,
      fullTrace: false,
      slow: 75,
      forbidOnly: false,
      forbidPending: false,
      parallel: false,
      extension: ['js', 'ts'],
    };
  }

  /**
   * Normalize Mocha configuration
   *
   * @param config - Raw configuration object
   * @returns Normalized Mocha configuration
   */
  private normalizeConfig(config: Record<string, unknown>): MochaConfig {
    const defaults = this.getDefaultConfig();

    return {
      framework: TestFramework.MOCHA,
      testMatch: (config['testMatch'] as string[]) || defaults.testMatch,
      testPathIgnorePatterns:
        (config['testPathIgnorePatterns'] as string[]) || defaults.testPathIgnorePatterns,
      coverageDirectory: (config['coverageDirectory'] as string) || defaults.coverageDirectory,
      coverageReporters: (config['coverageReporters'] as string[]) || defaults.coverageReporters,
      timeout: (config['timeout'] as number) || defaults.timeout,
      customConfig: config,
      require: config['require'] as string[] | undefined,
      reporter: (config['reporter'] as string) || defaults.reporter,
      reporterOptions: config['reporterOptions'] as Record<string, unknown> | undefined,
      ui: (config['ui'] as string) || defaults.ui,
      bail: (config['bail'] as boolean) || defaults.bail,
      checkLeaks: (config['checkLeaks'] as boolean) || defaults.checkLeaks,
      fullTrace: (config['fullTrace'] as boolean) || defaults.fullTrace,
      grep: config['grep'] as string | undefined,
      invert: config['invert'] as boolean | undefined,
      retries: config['retries'] as number | undefined,
      slow: (config['slow'] as number) || defaults.slow,
      forbidOnly: (config['forbidOnly'] as boolean) || defaults.forbidOnly,
      forbidPending: (config['forbidPending'] as boolean) || defaults.forbidPending,
      global: config['global'] as string[] | undefined,
      jobs: config['jobs'] as number | undefined,
      parallel: (config['parallel'] as boolean) || defaults.parallel,
      extension: (config['extension'] as string[]) || defaults.extension,
      file: config['file'] as string[] | undefined,
      spec: config['spec'] as string[] | undefined,
      watch: config['watch'] as boolean | undefined,
      watchFiles: config['watchFiles'] as string[] | undefined,
      watchIgnore: config['watchIgnore'] as string[] | undefined,
    };
  }

  /**
   * Build Mocha command arguments
   *
   * @param options - Test run options
   * @param config - Mocha configuration
   * @returns Command arguments array
   */
  buildCommandArgs(options: TestRunOptions, config: MochaConfig): string[] {
    const args: string[] = ['mocha'];

    // Add test path if specified
    if (options.testPath) {
      args.push(options.testPath);
    } else if (config.spec && config.spec.length > 0) {
      // Use spec patterns from config
      args.push(...config.spec);
    }

    // Add test name pattern (grep)
    if (options.pattern) {
      args.push('--grep', options.pattern);
    } else if (config.grep) {
      args.push('--grep', config.grep);
    }

    // Add watch mode
    if (options.watch || config.watch) {
      args.push('--watch');

      // Add watch files if specified
      if (config.watchFiles && config.watchFiles.length > 0) {
        args.push('--watch-files', config.watchFiles.join(','));
      }

      // Add watch ignore if specified
      if (config.watchIgnore && config.watchIgnore.length > 0) {
        args.push('--watch-ignore', config.watchIgnore.join(','));
      }
    }

    // Add timeout
    if (options.timeout) {
      args.push('--timeout', options.timeout.toString());
    } else if (config.timeout) {
      args.push('--timeout', config.timeout.toString());
    }

    // Add reporter
    if (config.reporter) {
      args.push('--reporter', config.reporter);
    }

    // Add reporter options
    if (config.reporterOptions) {
      const reporterOpts = Object.entries(config.reporterOptions)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');
      args.push('--reporter-options', reporterOpts);
    }

    // Add UI style
    if (config.ui) {
      args.push('--ui', config.ui);
    }

    // Add bail option
    if (config.bail) {
      args.push('--bail');
    }

    // Add check leaks
    if (config.checkLeaks) {
      args.push('--check-leaks');
    }

    // Add full trace
    if (config.fullTrace) {
      args.push('--full-trace');
    }

    // Add invert grep
    if (config.invert) {
      args.push('--invert');
    }

    // Add retries
    if (config.retries !== undefined) {
      args.push('--retries', config.retries.toString());
    }

    // Add slow threshold
    if (config.slow !== undefined) {
      args.push('--slow', config.slow.toString());
    }

    // Add forbid only
    if (config.forbidOnly) {
      args.push('--forbid-only');
    }

    // Add forbid pending
    if (config.forbidPending) {
      args.push('--forbid-pending');
    }

    // Add parallel execution
    if (options.parallel || config.parallel) {
      args.push('--parallel');

      // Add jobs (max workers)
      if (options.maxWorkers) {
        args.push('--jobs', options.maxWorkers.toString());
      } else if (config.jobs) {
        args.push('--jobs', config.jobs.toString());
      }
    }

    // Add require modules
    if (config.require && config.require.length > 0) {
      config.require.forEach((req) => {
        args.push('--require', req);
      });
    }

    // Add file extensions
    if (config.extension && config.extension.length > 0) {
      args.push('--extension', config.extension.join(','));
    }

    // Add files to load before tests
    if (config.file && config.file.length > 0) {
      config.file.forEach((file) => {
        args.push('--file', file);
      });
    }

    // Add global variables
    if (config.global && config.global.length > 0) {
      config.global.forEach((global) => {
        args.push('--global', global);
      });
    }

    // Add JSON reporter for easier parsing
    args.push('--reporter', 'json');

    // Add no colors for cleaner output parsing
    args.push('--no-colors');

    return args;
  }

  /**
   * Validate Mocha configuration
   *
   * @param config - Mocha configuration to validate
   * @returns Validation result with errors and warnings
   */
  validateConfig(config: MochaConfig): { valid: boolean; errors: string[]; warnings: string[] } {
    const result = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    // Validate test match patterns
    if (!config.testMatch || config.testMatch.length === 0) {
      result.warnings.push('No testMatch patterns specified, using defaults');
    }

    // Validate timeout
    if (config.timeout && config.timeout < 0) {
      result.valid = false;
      result.errors.push('Timeout must be a positive number');
    }

    // Validate slow threshold
    if (config.slow !== undefined && config.slow < 0) {
      result.valid = false;
      result.errors.push('Slow threshold must be a positive number');
    }

    // Validate retries
    if (config.retries !== undefined && config.retries < 0) {
      result.valid = false;
      result.errors.push('Retries must be a non-negative number');
    }

    // Validate jobs
    if (config.jobs !== undefined && config.jobs < 1) {
      result.valid = false;
      result.errors.push('Jobs must be at least 1');
    }

    // Validate UI style
    const validUIs = ['bdd', 'tdd', 'qunit', 'exports'];
    if (config.ui && !validUIs.includes(config.ui)) {
      result.warnings.push(
        `UI style "${config.ui}" may not be supported. Valid options: ${validUIs.join(', ')}`
      );
    }

    // Validate reporter
    const commonReporters = [
      'spec',
      'dot',
      'nyan',
      'tap',
      'landing',
      'list',
      'progress',
      'json',
      'min',
      'doc',
    ];
    if (config.reporter && !commonReporters.includes(config.reporter)) {
      result.warnings.push(
        `Reporter "${config.reporter}" may be a custom reporter. Common reporters: ${commonReporters.join(', ')}`
      );
    }

    return result;
  }

  /**
   * Get Mocha-specific environment variables
   *
   * @param config - Mocha configuration
   * @returns Environment variables object
   */
  getEnvironmentVariables(config: MochaConfig): Record<string, string> {
    const env: Record<string, string> = {};

    // Set NODE_ENV if not already set
    if (!process.env['NODE_ENV']) {
      env['NODE_ENV'] = 'test';
    }

    // Add Mocha-specific env vars
    if (config.reporter) {
      env['MOCHA_REPORTER'] = config.reporter;
    }

    return env;
  }

  /**
   * Parse Mocha test results from JSON output
   *
   * @param output - Mocha JSON output
   * @returns Parsed test statistics
   */
  parseTestResults(output: string): {
    tests: number;
    passes: number;
    failures: number;
    pending: number;
    duration: number;
  } | null {
    try {
      const jsonOutput = JSON.parse(output);

      return {
        tests: jsonOutput.stats?.tests || 0,
        passes: jsonOutput.stats?.passes || 0,
        failures: jsonOutput.stats?.failures || 0,
        pending: jsonOutput.stats?.pending || 0,
        duration: jsonOutput.stats?.duration || 0,
      };
    } catch (error) {
      console.error(`Error parsing Mocha test results: ${error}`);
      return null;
    }
  }
}
