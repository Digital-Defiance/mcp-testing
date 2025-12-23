/**
 * Vitest Framework Integration
 *
 * Provides Vitest-specific test runner integration with support for:
 * - Vitest configuration loading and validation
 * - Watch mode and UI mode
 * - Coverage reporting with c8/istanbul
 * - Fast execution with Vite's transform pipeline
 *
 * @packageDocumentation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TestFramework, TestRunOptions } from '../../types';
import { FrameworkConfig } from '../FrameworkDetector';

/**
 * Vitest-specific configuration options
 */
export interface VitestConfig extends FrameworkConfig {
  // Vitest-specific options
  globals?: boolean;
  environment?: string;
  environmentOptions?: Record<string, unknown>;
  threads?: boolean;
  isolate?: boolean;
  watch?: boolean;
  ui?: boolean;
  open?: boolean;
  api?: boolean | { port?: number; host?: string };
  reporters?: string[];
  outputFile?: string | Record<string, string>;
  silent?: boolean;
  hideSkippedTests?: boolean;
  bail?: number;
  retry?: number;
  diff?: string;
  exclude?: string[];
  include?: string[];
  testNamePattern?: string;
  related?: string[];
  allowOnly?: boolean;
  dangerouslyIgnoreUnhandledErrors?: boolean;
  passWithNoTests?: boolean;
  logHeapUsage?: boolean;
  maxThreads?: number;
  minThreads?: number;
  setupFiles?: string[];
  globalSetup?: string[];
  watchExclude?: string[];
  forceRerunTriggers?: string[];
  coverage?: {
    provider?: 'c8' | 'istanbul';
    enabled?: boolean;
    clean?: boolean;
    cleanOnRerun?: boolean;
    reportsDirectory?: string;
    reporter?: string[];
    exclude?: string[];
    include?: string[];
    skipFull?: boolean;
    all?: boolean;
    lines?: number;
    functions?: number;
    branches?: number;
    statements?: number;
  };
}

/**
 * Vitest Integration class
 *
 * Handles Vitest-specific test execution, configuration, and features
 */
export class VitestIntegration {
  /**
   * Load Vitest configuration from project
   *
   * @param projectPath - Path to project root
   * @returns Vitest configuration
   */
  async loadConfig(projectPath: string): Promise<VitestConfig> {
    // Try to find Vitest config file
    const configFiles = [
      'vitest.config.js',
      'vitest.config.ts',
      'vitest.config.mjs',
      'vite.config.js',
      'vite.config.ts',
    ];

    for (const configFile of configFiles) {
      const configPath = path.join(projectPath, configFile);
      try {
        await fs.access(configPath);

        // For JS/TS files, we would need to use dynamic import
        // For now, return default config with note
        console.log(
          `Found Vitest config at ${configFile}, using defaults (dynamic import not implemented)`
        );
        return this.getDefaultConfig();
      } catch {
        // File doesn't exist, continue
      }
    }

    // Check package.json for Vitest config
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      if (packageJson.vitest) {
        return this.normalizeConfig(packageJson.vitest);
      }
    } catch {
      // package.json doesn't exist or doesn't have Vitest config
    }

    // Return default config
    return this.getDefaultConfig();
  }

  /**
   * Get default Vitest configuration
   *
   * @returns Default Vitest configuration
   */
  getDefaultConfig(): VitestConfig {
    return {
      framework: TestFramework.VITEST,
      testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
      coverageDirectory: 'coverage',
      coverageReporters: ['json', 'lcov', 'text', 'html'],
      timeout: 5000,
      customConfig: {},
      globals: false,
      environment: 'node',
      threads: true,
      isolate: true,
      watch: false,
      ui: false,
      reporters: ['default'],
      silent: false,
      hideSkippedTests: false,
      allowOnly: false,
      passWithNoTests: false,
      logHeapUsage: false,
      coverage: {
        provider: 'c8',
        enabled: false,
        clean: true,
        cleanOnRerun: true,
        reportsDirectory: 'coverage',
        reporter: ['text', 'json', 'html'],
        all: false,
      },
    };
  }

  /**
   * Normalize Vitest configuration
   *
   * @param config - Raw configuration object
   * @returns Normalized Vitest configuration
   */
  private normalizeConfig(config: Record<string, unknown>): VitestConfig {
    const defaults = this.getDefaultConfig();

    return {
      framework: TestFramework.VITEST,
      testMatch: (config['testMatch'] as string[]) || defaults.testMatch,
      testPathIgnorePatterns:
        (config['testPathIgnorePatterns'] as string[]) || defaults.testPathIgnorePatterns,
      coverageDirectory: (config['coverageDirectory'] as string) || defaults.coverageDirectory,
      coverageReporters: (config['coverageReporters'] as string[]) || defaults.coverageReporters,
      timeout: (config['timeout'] as number) || defaults.timeout,
      customConfig: config,
      globals: (config['globals'] as boolean) || defaults.globals,
      environment: (config['environment'] as string) || defaults.environment,
      environmentOptions: config['environmentOptions'] as Record<string, unknown> | undefined,
      threads: config['threads'] !== undefined ? (config['threads'] as boolean) : defaults.threads,
      isolate: config['isolate'] !== undefined ? (config['isolate'] as boolean) : defaults.isolate,
      watch: (config['watch'] as boolean) || defaults.watch,
      ui: (config['ui'] as boolean) || defaults.ui,
      open: config['open'] as boolean | undefined,
      api: config['api'] as boolean | { port?: number; host?: string } | undefined,
      reporters: (config['reporters'] as string[]) || defaults.reporters,
      outputFile: config['outputFile'] as string | Record<string, string> | undefined,
      silent: (config['silent'] as boolean) || defaults.silent,
      hideSkippedTests: (config['hideSkippedTests'] as boolean) || defaults.hideSkippedTests,
      bail: config['bail'] as number | undefined,
      retry: config['retry'] as number | undefined,
      diff: config['diff'] as string | undefined,
      exclude: config['exclude'] as string[] | undefined,
      include: config['include'] as string[] | undefined,
      testNamePattern: config['testNamePattern'] as string | undefined,
      related: config['related'] as string[] | undefined,
      allowOnly: (config['allowOnly'] as boolean) || defaults.allowOnly,
      dangerouslyIgnoreUnhandledErrors: config['dangerouslyIgnoreUnhandledErrors'] as
        | boolean
        | undefined,
      passWithNoTests: (config['passWithNoTests'] as boolean) || defaults.passWithNoTests,
      logHeapUsage: (config['logHeapUsage'] as boolean) || defaults.logHeapUsage,
      maxThreads: config['maxThreads'] as number | undefined,
      minThreads: config['minThreads'] as number | undefined,
      setupFiles: config['setupFiles'] as string[] | undefined,
      globalSetup: config['globalSetup'] as string[] | undefined,
      watchExclude: config['watchExclude'] as string[] | undefined,
      forceRerunTriggers: config['forceRerunTriggers'] as string[] | undefined,
      coverage: {
        ...defaults.coverage,
        ...(config['coverage'] as Record<string, unknown>),
      },
    };
  }

  /**
   * Build Vitest command arguments
   *
   * @param options - Test run options
   * @param config - Vitest configuration
   * @returns Command arguments array
   */
  buildCommandArgs(options: TestRunOptions, config: VitestConfig): string[] {
    const args: string[] = ['vitest'];

    // Add test path if specified
    if (options.testPath) {
      args.push(options.testPath);
    }

    // Add test name pattern
    if (options.pattern) {
      args.push('--testNamePattern', options.pattern);
    } else if (config.testNamePattern) {
      args.push('--testNamePattern', config.testNamePattern);
    }

    // Add coverage
    if (options.coverage || config.coverage?.enabled) {
      args.push('--coverage');

      // Add coverage provider
      if (config.coverage?.provider) {
        args.push('--coverage.provider', config.coverage.provider);
      }

      // Add coverage reporters
      if (config.coverage?.reporter && config.coverage.reporter.length > 0) {
        args.push('--coverage.reporter', config.coverage.reporter.join(','));
      }

      // Add coverage directory
      if (config.coverage?.reportsDirectory) {
        args.push('--coverage.reportsDirectory', config.coverage.reportsDirectory);
      }
    }

    // Add watch mode
    if (options.watch || config.watch) {
      args.push('--watch');
    } else {
      // Add --run to disable watch mode by default
      args.push('--run');
    }

    // Add UI mode
    if (config.ui) {
      args.push('--ui');

      // Add open flag
      if (config.open) {
        args.push('--open');
      }
    }

    // Add API mode
    if (config.api) {
      if (typeof config.api === 'boolean') {
        args.push('--api');
      } else {
        args.push('--api');
        if (config.api.port) {
          args.push('--api.port', config.api.port.toString());
        }
        if (config.api.host) {
          args.push('--api.host', config.api.host);
        }
      }
    }

    // Add threads option
    if (config.threads !== undefined) {
      args.push('--threads', config.threads.toString());
    }

    // Add isolate option
    if (config.isolate !== undefined) {
      args.push('--isolate', config.isolate.toString());
    }

    // Add max workers
    if (options.maxWorkers) {
      args.push('--maxThreads', options.maxWorkers.toString());
    } else if (config.maxThreads) {
      args.push('--maxThreads', config.maxThreads.toString());
    }

    // Add min threads
    if (config.minThreads) {
      args.push('--minThreads', config.minThreads.toString());
    }

    // Add reporters
    if (config.reporters && config.reporters.length > 0) {
      args.push('--reporter', config.reporters.join(','));
    }

    // Add silent mode
    if (config.silent) {
      args.push('--silent');
    }

    // Add hide skipped tests
    if (config.hideSkippedTests) {
      args.push('--hideSkippedTests');
    }

    // Add bail option
    if (config.bail !== undefined) {
      args.push('--bail', config.bail.toString());
    }

    // Add retry option
    if (config.retry !== undefined) {
      args.push('--retry', config.retry.toString());
    }

    // Add globals option
    if (config.globals) {
      args.push('--globals');
    }

    // Add environment
    if (config.environment) {
      args.push('--environment', config.environment);
    }

    // Add allow only
    if (config.allowOnly) {
      args.push('--allowOnly');
    }

    // Add pass with no tests
    if (config.passWithNoTests) {
      args.push('--passWithNoTests');
    }

    // Add log heap usage
    if (config.logHeapUsage) {
      args.push('--logHeapUsage');
    }

    // Add JSON reporter for easier parsing
    args.push('--reporter=json');
    args.push('--outputFile=vitest-report.json');

    return args;
  }

  /**
   * Validate Vitest configuration
   *
   * @param config - Vitest configuration to validate
   * @returns Validation result with errors and warnings
   */
  validateConfig(config: VitestConfig): { valid: boolean; errors: string[]; warnings: string[] } {
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

    // Validate bail
    if (config.bail !== undefined && config.bail < 0) {
      result.valid = false;
      result.errors.push('Bail must be a non-negative number');
    }

    // Validate retry
    if (config.retry !== undefined && config.retry < 0) {
      result.valid = false;
      result.errors.push('Retry must be a non-negative number');
    }

    // Validate max threads
    if (config.maxThreads !== undefined && config.maxThreads < 1) {
      result.valid = false;
      result.errors.push('maxThreads must be at least 1');
    }

    // Validate min threads
    if (config.minThreads !== undefined && config.minThreads < 1) {
      result.valid = false;
      result.errors.push('minThreads must be at least 1');
    }

    // Validate environment
    const validEnvironments = ['node', 'jsdom', 'happy-dom', 'edge-runtime'];
    if (config.environment && !validEnvironments.includes(config.environment)) {
      result.warnings.push(
        `Environment "${config.environment}" may not be supported. Valid options: ${validEnvironments.join(', ')}`
      );
    }

    // Validate coverage provider
    if (config.coverage?.provider && !['c8', 'istanbul'].includes(config.coverage.provider)) {
      result.valid = false;
      result.errors.push('Coverage provider must be either "c8" or "istanbul"');
    }

    // Validate coverage thresholds
    if (config.coverage) {
      const thresholds = ['lines', 'functions', 'branches', 'statements'] as const;
      for (const threshold of thresholds) {
        const value = config.coverage[threshold];
        if (value !== undefined && (value < 0 || value > 100)) {
          result.valid = false;
          result.errors.push(`Coverage ${threshold} threshold must be between 0 and 100`);
        }
      }
    }

    return result;
  }

  /**
   * Get Vitest-specific environment variables
   *
   * @param config - Vitest configuration
   * @returns Environment variables object
   */
  getEnvironmentVariables(config: VitestConfig): Record<string, string> {
    const env: Record<string, string> = {};

    // Set NODE_ENV if not already set
    if (!process.env['NODE_ENV']) {
      env['NODE_ENV'] = 'test';
    }

    // Add Vitest-specific env vars
    if (config.environment) {
      env['VITEST_ENVIRONMENT'] = config.environment;
    }

    // Add globals flag
    if (config.globals) {
      env['VITEST_GLOBALS'] = 'true';
    }

    return env;
  }

  /**
   * Parse Vitest JSON report
   *
   * @param reportPath - Path to JSON report file
   * @returns Parsed test statistics
   */
  async parseJsonReport(reportPath: string): Promise<{
    tests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  } | null> {
    try {
      const content = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(content);

      return {
        tests: report.numTotalTests || 0,
        passed: report.numPassedTests || 0,
        failed: report.numFailedTests || 0,
        skipped: report.numPendingTests || 0,
        duration:
          report.testResults?.reduce(
            (sum: number, result: any) => sum + (result.duration || 0),
            0
          ) || 0,
      };
    } catch (error) {
      console.error(`Error parsing Vitest JSON report: ${error}`);
      return null;
    }
  }

  /**
   * Check if UI mode is available
   *
   * @returns True if @vitest/ui is installed
   */
  async isUiModeAvailable(): Promise<boolean> {
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      return '@vitest/ui' in allDeps;
    } catch {
      return false;
    }
  }

  /**
   * Check if coverage provider is installed
   *
   * @param provider - Coverage provider ('c8' or 'istanbul')
   * @returns True if provider is installed
   */
  async isCoverageProviderInstalled(provider: 'c8' | 'istanbul'): Promise<boolean> {
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const packageName = provider === 'c8' ? '@vitest/coverage-c8' : '@vitest/coverage-istanbul';
      return packageName in allDeps;
    } catch {
      return false;
    }
  }
}
