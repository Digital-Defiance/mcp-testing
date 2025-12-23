/**
 * FrameworkDetector component
 *
 * Detects installed test frameworks and their configurations from package.json
 * and framework-specific configuration files.
 *
 * @packageDocumentation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TestFramework } from '../types';

/**
 * Detected framework information
 */
export interface DetectedFramework {
  framework: TestFramework;
  version: string;
  configFile?: string;
  testDirectory: string;
  supported: boolean;
}

/**
 * Framework configuration
 */
export interface FrameworkConfig {
  framework: TestFramework;
  testMatch: string[];
  testPathIgnorePatterns: string[];
  coverageDirectory: string;
  coverageReporters: string[];
  timeout: number;
  customConfig: Record<string, unknown>;
}

/**
 * Framework defaults
 */
export interface FrameworkDefaults {
  testMatch: string[];
  testPathIgnorePatterns: string[];
  coverageDirectory: string;
  coverageReporters: string[];
  timeout: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Framework configuration file mappings
 */
const FRAMEWORK_CONFIG_FILES: Record<TestFramework, string[]> = {
  [TestFramework.JEST]: [
    'jest.config.js',
    'jest.config.ts',
    'jest.config.mjs',
    'jest.config.cjs',
    'jest.config.json',
  ],
  [TestFramework.MOCHA]: [
    '.mocharc.json',
    '.mocharc.js',
    '.mocharc.cjs',
    '.mocharc.yaml',
    '.mocharc.yml',
  ],
  [TestFramework.PYTEST]: ['pytest.ini', 'pyproject.toml', 'tox.ini', 'setup.cfg'],
  [TestFramework.VITEST]: [
    'vitest.config.js',
    'vitest.config.ts',
    'vitest.config.mjs',
    'vite.config.js',
    'vite.config.ts',
  ],
  [TestFramework.JASMINE]: ['jasmine.json', 'spec/support/jasmine.json'],
  [TestFramework.AVA]: ['ava.config.js', 'ava.config.cjs', 'ava.config.mjs'],
};

/**
 * Framework package name mappings
 */
const FRAMEWORK_PACKAGES: Record<TestFramework, string[]> = {
  [TestFramework.JEST]: ['jest', '@jest/core'],
  [TestFramework.MOCHA]: ['mocha'],
  [TestFramework.PYTEST]: ['pytest'],
  [TestFramework.VITEST]: ['vitest'],
  [TestFramework.JASMINE]: ['jasmine', 'jasmine-core'],
  [TestFramework.AVA]: ['ava'],
};

/**
 * Framework defaults
 */
const FRAMEWORK_DEFAULTS_MAP: Record<TestFramework, FrameworkDefaults> = {
  [TestFramework.JEST]: {
    testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
    coverageDirectory: 'coverage',
    coverageReporters: ['json', 'lcov', 'text', 'clover'],
    timeout: 5000,
  },
  [TestFramework.MOCHA]: {
    testMatch: ['test/**/*.js', 'test/**/*.ts', '**/*.test.js', '**/*.spec.js'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
    coverageDirectory: 'coverage',
    coverageReporters: ['json', 'lcov', 'text'],
    timeout: 2000,
  },
  [TestFramework.PYTEST]: {
    testMatch: ['test_*.py', '*_test.py', 'tests/**/*.py'],
    testPathIgnorePatterns: ['__pycache__', '.pytest_cache', 'venv', '.venv'],
    coverageDirectory: 'htmlcov',
    coverageReporters: ['html', 'xml', 'term'],
    timeout: 0, // Pytest doesn't have a default timeout
  },
  [TestFramework.VITEST]: {
    testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
    coverageDirectory: 'coverage',
    coverageReporters: ['json', 'lcov', 'text', 'html'],
    timeout: 5000,
  },
  [TestFramework.JASMINE]: {
    testMatch: ['**/*[sS]pec.js', '**/*[sS]pec.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
    coverageDirectory: 'coverage',
    coverageReporters: ['json', 'lcov', 'text'],
    timeout: 5000,
  },
  [TestFramework.AVA]: {
    testMatch: ['test/**/*.js', 'test/**/*.ts', '**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
    coverageDirectory: 'coverage',
    coverageReporters: ['json', 'lcov', 'text'],
    timeout: 10000,
  },
};

/**
 * FrameworkDetector class
 *
 * Detects installed test frameworks and loads their configurations
 */
export class FrameworkDetector {
  /**
   * Detect installed test frameworks in a project
   *
   * @param projectPath - Path to the project root
   * @returns Array of detected frameworks
   */
  async detectFrameworks(projectPath: string): Promise<DetectedFramework[]> {
    // In mock mode, return all frameworks as available
    if (process.env['MCP_TESTING_MOCK_MODE'] === 'true') {
      return [
        {
          framework: TestFramework.JEST,
          version: '29.0.0',
          configFile: 'jest.config.js',
          testDirectory: 'test',
          supported: true,
        },
        {
          framework: TestFramework.MOCHA,
          version: '10.0.0',
          configFile: '.mocharc.json',
          testDirectory: 'test',
          supported: true,
        },
        {
          framework: TestFramework.PYTEST,
          version: '7.0.0',
          configFile: 'pytest.ini',
          testDirectory: 'tests',
          supported: true,
        },
        {
          framework: TestFramework.VITEST,
          version: '1.0.0',
          configFile: 'vitest.config.ts',
          testDirectory: 'test',
          supported: true,
        },
      ];
    }

    const detected: DetectedFramework[] = [];

    try {
      // Read package.json
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Check each framework
      for (const [framework, packages] of Object.entries(FRAMEWORK_PACKAGES)) {
        const frameworkEnum = framework as TestFramework;
        const installedPackage = packages.find((pkg) => pkg in allDeps);

        if (installedPackage) {
          const version = allDeps[installedPackage];
          const configFile = await this.findConfigFile(projectPath, frameworkEnum);
          const testDirectory = await this.findTestDirectory(projectPath, frameworkEnum);

          detected.push({
            framework: frameworkEnum,
            version: version.replace(/^[\^~]/, ''), // Remove version prefixes
            configFile,
            testDirectory,
            supported: true,
          });
        }
      }
    } catch (error) {
      // If package.json doesn't exist or can't be read, return empty array
      console.error(`Error detecting frameworks: ${error}`);
    }

    return detected;
  }

  /**
   * Get framework configuration
   *
   * @param framework - Test framework
   * @param projectPath - Path to the project root
   * @returns Framework configuration
   */
  async getFrameworkConfig(
    framework: TestFramework,
    projectPath: string
  ): Promise<FrameworkConfig> {
    const defaults = this.getFrameworkDefaults(framework);
    const configFile = await this.findConfigFile(projectPath, framework);

    let customConfig: Record<string, unknown> = {};

    if (configFile) {
      try {
        customConfig = await this.loadConfigFile(path.join(projectPath, configFile), framework);
      } catch (error) {
        console.error(`Error loading config file ${configFile}: ${error}`);
      }
    }

    return {
      framework,
      testMatch: (customConfig['testMatch'] as string[]) || defaults.testMatch,
      testPathIgnorePatterns:
        (customConfig['testPathIgnorePatterns'] as string[]) || defaults.testPathIgnorePatterns,
      coverageDirectory:
        (customConfig['coverageDirectory'] as string) || defaults.coverageDirectory,
      coverageReporters:
        (customConfig['coverageReporters'] as string[]) || defaults.coverageReporters,
      timeout: (customConfig['timeout'] as number) || defaults.timeout,
      customConfig,
    };
  }

  /**
   * Validate framework compatibility
   *
   * @param framework - Test framework
   * @param version - Framework version
   * @returns Validation result
   */
  validateFramework(framework: TestFramework, version: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Check if framework is supported
    if (!Object.values(TestFramework).includes(framework)) {
      result.valid = false;
      result.errors.push(`Framework ${framework} is not supported`);
      return result;
    }

    // Parse version
    const versionMatch = version.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!versionMatch) {
      result.warnings.push(`Could not parse version ${version}`);
      return result;
    }

    const [, major, minor] = versionMatch.map(Number);

    // Check minimum versions
    const minVersions: Record<TestFramework, { major: number; minor: number }> = {
      [TestFramework.JEST]: { major: 27, minor: 0 },
      [TestFramework.MOCHA]: { major: 8, minor: 0 },
      [TestFramework.PYTEST]: { major: 6, minor: 0 },
      [TestFramework.VITEST]: { major: 0, minor: 34 },
      [TestFramework.JASMINE]: { major: 3, minor: 0 },
      [TestFramework.AVA]: { major: 4, minor: 0 },
    };

    const minVersion = minVersions[framework];
    if (major < minVersion.major || (major === minVersion.major && minor < minVersion.minor)) {
      result.warnings.push(
        `Framework version ${version} is below recommended minimum ${minVersion.major}.${minVersion.minor}.0`
      );
    }

    return result;
  }

  /**
   * Get framework defaults
   *
   * @param framework - Test framework
   * @returns Framework defaults
   */
  getFrameworkDefaults(framework: TestFramework): FrameworkDefaults {
    return FRAMEWORK_DEFAULTS_MAP[framework];
  }

  /**
   * Find configuration file for a framework
   *
   * @param projectPath - Path to the project root
   * @param framework - Test framework
   * @returns Path to config file relative to project root, or undefined
   */
  private async findConfigFile(
    projectPath: string,
    framework: TestFramework
  ): Promise<string | undefined> {
    const configFiles = FRAMEWORK_CONFIG_FILES[framework];

    for (const configFile of configFiles) {
      try {
        const fullPath = path.join(projectPath, configFile);
        await fs.access(fullPath);
        return configFile;
      } catch {
        // File doesn't exist, continue
      }
    }

    return undefined;
  }

  /**
   * Find test directory for a framework
   *
   * @param projectPath - Path to the project root
   * @param framework - Test framework
   * @returns Path to test directory
   */
  private async findTestDirectory(projectPath: string, framework: TestFramework): Promise<string> {
    // Common test directory names
    const testDirs = ['test', 'tests', '__tests__', 'spec', 'specs'];

    for (const dir of testDirs) {
      try {
        const fullPath = path.join(projectPath, dir);
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          return dir;
        }
      } catch {
        // Directory doesn't exist, continue
      }
    }

    // Default to 'test' if no directory found
    return 'test';
  }

  /**
   * Load configuration file
   *
   * @param configPath - Path to config file
   * @param framework - Test framework
   * @returns Configuration object
   */
  private async loadConfigFile(
    configPath: string,
    framework: TestFramework
  ): Promise<Record<string, unknown>> {
    const ext = path.extname(configPath);

    try {
      if (ext === '.json') {
        const content = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(content);
      } else if (ext === '.js' || ext === '.cjs' || ext === '.mjs' || ext === '.ts') {
        // For JS/TS files, we would need to use dynamic import
        // For now, return empty config
        // TODO: Implement dynamic import for JS/TS config files
        return {};
      } else if (ext === '.yaml' || ext === '.yml') {
        // For YAML files, we would need a YAML parser
        // For now, return empty config
        // TODO: Implement YAML parsing
        return {};
      } else if (ext === '.ini' || ext === '.toml') {
        // For INI/TOML files, we would need appropriate parsers
        // For now, return empty config
        // TODO: Implement INI/TOML parsing
        return {};
      }
    } catch (error) {
      console.error(`Error loading config file ${configPath}: ${error}`);
    }

    return {};
  }
}
