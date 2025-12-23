/**
 * Pytest Framework Integration
 *
 * Provides Pytest-specific test runner integration with support for:
 * - Pytest configuration loading and validation
 * - Fixtures and parametrized tests
 * - Coverage reporting with pytest-cov
 * - Multiple output formats
 *
 * @packageDocumentation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TestFramework, TestRunOptions } from '../../types';
import { FrameworkConfig } from '../FrameworkDetector';

/**
 * Pytest-specific configuration options
 */
export interface PytestConfig extends FrameworkConfig {
  // Pytest-specific options
  pythonPath?: string;
  addopts?: string;
  minversion?: string;
  testpaths?: string[];
  pythonFiles?: string[];
  pythonClasses?: string[];
  pythonFunctions?: string[];
  markers?: Record<string, string>;
  usefixtures?: string[];
  filterwarnings?: string[];
  logLevel?: string;
  logFormat?: string;
  xfailStrict?: boolean;
  junit?: {
    family?: string;
    suiteName?: string;
  };
  cache?: {
    dir?: string;
  };
}

/**
 * Pytest fixture information
 */
export interface PytestFixture {
  name: string;
  scope: 'function' | 'class' | 'module' | 'package' | 'session';
  params?: unknown[];
  autouse?: boolean;
}

/**
 * Pytest Integration class
 *
 * Handles Pytest-specific test execution, configuration, and features
 */
export class PytestIntegration {
  /**
   * Load Pytest configuration from project
   *
   * @param projectPath - Path to project root
   * @returns Pytest configuration
   */
  async loadConfig(projectPath: string): Promise<PytestConfig> {
    // Try to find Pytest config file
    const configFiles = ['pytest.ini', 'pyproject.toml', 'tox.ini', 'setup.cfg'];

    for (const configFile of configFiles) {
      const configPath = path.join(projectPath, configFile);
      try {
        await fs.access(configPath);

        // For pytest.ini, parse INI format
        if (configFile === 'pytest.ini') {
          const content = await fs.readFile(configPath, 'utf-8');
          return this.parseIniConfig(content);
        }

        // For pyproject.toml, would need TOML parser
        if (configFile === 'pyproject.toml') {
          console.log(
            `Found Pytest config at ${configFile}, using defaults (TOML parser not implemented)`
          );
          return this.getDefaultConfig();
        }

        // For tox.ini and setup.cfg, would need INI parser
        console.log(
          `Found Pytest config at ${configFile}, using defaults (INI parser not implemented)`
        );
        return this.getDefaultConfig();
      } catch {
        // File doesn't exist, continue
      }
    }

    // Return default config
    return this.getDefaultConfig();
  }

  /**
   * Get default Pytest configuration
   *
   * @returns Default Pytest configuration
   */
  getDefaultConfig(): PytestConfig {
    return {
      framework: TestFramework.PYTEST,
      testMatch: ['test_*.py', '*_test.py', 'tests/**/*.py'],
      testPathIgnorePatterns: ['__pycache__', '.pytest_cache', 'venv', '.venv'],
      coverageDirectory: 'htmlcov',
      coverageReporters: ['html', 'xml', 'term'],
      timeout: 0, // Pytest doesn't have a default timeout
      customConfig: {},
      pythonPath: 'python',
      testpaths: ['tests'],
      pythonFiles: ['test_*.py', '*_test.py'],
      pythonClasses: ['Test*'],
      pythonFunctions: ['test_*'],
      logLevel: 'INFO',
      xfailStrict: false,
    };
  }

  /**
   * Parse pytest.ini configuration
   *
   * @param content - INI file content
   * @returns Parsed Pytest configuration
   */
  private parseIniConfig(content: string): PytestConfig {
    const defaults = this.getDefaultConfig();
    const config: Partial<PytestConfig> = {
      framework: TestFramework.PYTEST,
      customConfig: {},
    };

    // Simple INI parser for pytest section
    const lines = content.split('\n');
    let inPytestSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for [pytest] or [tool:pytest] section
      if (trimmed === '[pytest]' || trimmed === '[tool:pytest]') {
        inPytestSection = true;
        continue;
      }

      // Check for new section
      if (trimmed.startsWith('[')) {
        inPytestSection = false;
        continue;
      }

      // Parse key-value pairs in pytest section
      if (inPytestSection && trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();

          switch (key.trim()) {
            case 'testpaths':
              config.testpaths = value.split(/\s+/);
              break;
            case 'python_files':
              config.pythonFiles = value.split(/\s+/);
              break;
            case 'python_classes':
              config.pythonClasses = value.split(/\s+/);
              break;
            case 'python_functions':
              config.pythonFunctions = value.split(/\s+/);
              break;
            case 'addopts':
              config.addopts = value;
              break;
            case 'minversion':
              config.minversion = value;
              break;
            case 'log_level':
              config.logLevel = value;
              break;
            case 'log_format':
              config.logFormat = value;
              break;
            case 'xfail_strict':
              config.xfailStrict = value.toLowerCase() === 'true';
              break;
          }
        }
      }
    }

    return {
      ...defaults,
      ...config,
    };
  }

  /**
   * Build Pytest command arguments
   *
   * @param options - Test run options
   * @param config - Pytest configuration
   * @returns Command arguments array
   */
  buildCommandArgs(options: TestRunOptions, config: PytestConfig): string[] {
    const args: string[] = ['-m', 'pytest'];

    // Add test path if specified
    if (options.testPath) {
      args.push(options.testPath);
    } else if (config.testpaths && config.testpaths.length > 0) {
      // Use test paths from config
      args.push(...config.testpaths);
    }

    // Add test name pattern (-k option)
    if (options.pattern) {
      args.push('-k', options.pattern);
    }

    // Add coverage
    if (options.coverage) {
      args.push('--cov');

      // Add coverage options
      if (config.coverageDirectory) {
        args.push(`--cov-report=html:${config.coverageDirectory}`);
      }

      // Add coverage reporters
      if (config.coverageReporters && config.coverageReporters.length > 0) {
        config.coverageReporters.forEach((reporter) => {
          if (reporter === 'xml') {
            args.push('--cov-report=xml');
          } else if (reporter === 'term') {
            args.push('--cov-report=term');
          } else if (reporter === 'json') {
            args.push('--cov-report=json');
          }
        });
      }
    }

    // Add verbose output
    args.push('-v');

    // Add additional options from config
    if (config.addopts) {
      // Split addopts and add them
      const additionalOpts = config.addopts.split(/\s+/);
      args.push(...additionalOpts);
    }

    // Add log level
    if (config.logLevel) {
      args.push('--log-level', config.logLevel);
    }

    // Add xfail strict
    if (config.xfailStrict) {
      args.push('--strict-markers');
    }

    // Add JSON output for easier parsing
    args.push('--json-report');
    args.push('--json-report-file=pytest-report.json');

    // Add no colors for cleaner output parsing
    args.push('--color=no');

    // Add parallel execution if requested
    if (options.parallel && options.maxWorkers) {
      args.push('-n', options.maxWorkers.toString());
    }

    return args;
  }

  /**
   * Validate Pytest configuration
   *
   * @param config - Pytest configuration to validate
   * @returns Validation result with errors and warnings
   */
  validateConfig(config: PytestConfig): { valid: boolean; errors: string[]; warnings: string[] } {
    const result = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    // Validate test paths
    if (!config.testpaths || config.testpaths.length === 0) {
      result.warnings.push('No testpaths specified, using defaults');
    }

    // Validate python files patterns
    if (!config.pythonFiles || config.pythonFiles.length === 0) {
      result.warnings.push('No python_files patterns specified, using defaults');
    }

    // Validate python classes patterns
    if (!config.pythonClasses || config.pythonClasses.length === 0) {
      result.warnings.push('No python_classes patterns specified, using defaults');
    }

    // Validate python functions patterns
    if (!config.pythonFunctions || config.pythonFunctions.length === 0) {
      result.warnings.push('No python_functions patterns specified, using defaults');
    }

    // Validate log level
    const validLogLevels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];
    if (config.logLevel && !validLogLevels.includes(config.logLevel.toUpperCase())) {
      result.warnings.push(
        `Log level "${config.logLevel}" may not be valid. Valid options: ${validLogLevels.join(', ')}`
      );
    }

    return result;
  }

  /**
   * Get Pytest-specific environment variables
   *
   * @param config - Pytest configuration
   * @returns Environment variables object
   */
  getEnvironmentVariables(config: PytestConfig): Record<string, string> {
    const env: Record<string, string> = {};

    // Set PYTHONPATH if not already set
    if (!process.env['PYTHONPATH']) {
      env['PYTHONPATH'] = process.cwd();
    }

    // Add pytest-specific env vars
    if (config.logLevel) {
      env['PYTEST_LOG_LEVEL'] = config.logLevel;
    }

    return env;
  }

  /**
   * Parse parametrized test information
   *
   * @param testName - Test name with parameters
   * @returns Parsed parameter information
   */
  parseParametrizedTest(testName: string): {
    baseName: string;
    parameters: Record<string, unknown>;
  } | null {
    try {
      // Pytest parametrized tests have format: test_name[param1-param2-...]
      const match = testName.match(/^(.+)\[(.+)\]$/);

      if (match) {
        const [, baseName, paramsStr] = match;
        const paramValues = paramsStr.split('-');

        // Create parameters object
        const parameters: Record<string, unknown> = {};
        paramValues.forEach((value, index) => {
          parameters[`param${index}`] = value;
        });

        return {
          baseName,
          parameters,
        };
      }

      return null;
    } catch (error) {
      console.error(`Error parsing parametrized test: ${error}`);
      return null;
    }
  }

  /**
   * Parse Pytest JSON report
   *
   * @param reportPath - Path to JSON report file
   * @returns Parsed test statistics
   */
  async parseJsonReport(reportPath: string): Promise<{
    tests: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
    duration: number;
  } | null> {
    try {
      const content = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(content);

      return {
        tests: report.summary?.total || 0,
        passed: report.summary?.passed || 0,
        failed: report.summary?.failed || 0,
        skipped: report.summary?.skipped || 0,
        errors: report.summary?.error || 0,
        duration: report.duration || 0,
      };
    } catch (error) {
      console.error(`Error parsing Pytest JSON report: ${error}`);
      return null;
    }
  }

  /**
   * Get fixture information from test file
   *
   * @param filePath - Path to test file
   * @returns Array of fixture information
   */
  async getFixtures(filePath: string): Promise<PytestFixture[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const fixtures: PytestFixture[] = [];

      // Simple regex to find fixture decorators
      // @pytest.fixture or @pytest.fixture(scope="...")
      const fixtureRegex = /@pytest\.fixture(?:\(([^)]+)\))?\s+def\s+(\w+)/g;

      let match;
      while ((match = fixtureRegex.exec(content)) !== null) {
        const [, options, name] = match;

        const fixture: PytestFixture = {
          name,
          scope: 'function', // default scope
        };

        // Parse options if present
        if (options) {
          const scopeMatch = options.match(/scope\s*=\s*["'](\w+)["']/);
          if (scopeMatch) {
            fixture.scope = scopeMatch[1] as PytestFixture['scope'];
          }

          const autouseMatch = options.match(/autouse\s*=\s*(True|False)/);
          if (autouseMatch) {
            fixture.autouse = autouseMatch[1] === 'True';
          }
        }

        fixtures.push(fixture);
      }

      return fixtures;
    } catch (error) {
      console.error(`Error getting fixtures from ${filePath}: ${error}`);
      return [];
    }
  }

  /**
   * Check if pytest-cov is installed
   *
   * @returns True if pytest-cov is available
   */
  async isPytestCovInstalled(): Promise<boolean> {
    try {
      // Try to import pytest_cov
      const { spawn } = await import('child_process');
      const process = spawn('python', ['-c', 'import pytest_cov']);

      return new Promise((resolve) => {
        process.on('exit', (code) => {
          resolve(code === 0);
        });

        process.on('error', () => {
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }
}
