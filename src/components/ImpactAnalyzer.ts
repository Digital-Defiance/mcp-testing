/**
 * ImpactAnalyzer component
 *
 * Analyzes which tests are affected by code changes using git diff,
 * import analysis, and coverage data. Prioritizes affected tests by
 * impact severity and supports selective test execution.
 *
 * @packageDocumentation
 */

import {
  TestFramework,
  TestCase,
  ImpactAnalysis,
  CodeChange,
  CoverageReport,
  ImpactAnalysisOptions,
} from '../types';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Import dependency graph
 */
interface DependencyGraph {
  [file: string]: Set<string>; // file -> files that import it
}

/**
 * ImpactAnalyzer class
 *
 * Analyzes code changes and determines which tests are affected
 */
export class ImpactAnalyzer {
  private projectRoot: string;
  private dependencyGraph: DependencyGraph = {};
  private testFilePatterns: RegExp[];

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.testFilePatterns = [
      /\.test\.(ts|js|tsx|jsx)$/,
      /\.spec\.(ts|js|tsx|jsx)$/,
      /_test\.(ts|js|tsx|jsx)$/,
      /test_.*\.py$/,
      /.*_test\.py$/,
    ];
  }

  /**
   * Analyze test impact from code changes
   *
   * @param options - Impact analysis options
   * @returns Promise resolving to impact analysis result
   */
  async analyzeImpact(options: ImpactAnalysisOptions): Promise<ImpactAnalysis> {
    // Get code changes
    const changes =
      options.changes || (await this.getChangesFromGit(options.gitDiff, options.baseBranch));

    // Build dependency graph if not already built
    if (Object.keys(this.dependencyGraph).length === 0) {
      await this.buildDependencyGraph();
    }

    // Get all test files
    const allTests = await this.discoverAllTests(options.framework);

    // Find affected tests
    const affectedTests = await this.findAffectedTests(changes, allTests, options.coverageReport);

    // Prioritize affected tests
    const prioritizedTests = this.prioritizeTests(affectedTests, changes, options.coverageReport);

    // Calculate statistics
    const affectedPercentage =
      allTests.length > 0 ? (affectedTests.length / allTests.length) * 100 : 0;

    return {
      affectedTests,
      totalTests: allTests.length,
      affectedPercentage,
      changes,
      prioritizedTests,
    };
  }

  /**
   * Get affected tests for a specific file
   *
   * @param filePath - File path to analyze
   * @returns Promise resolving to array of affected test cases
   */
  async getAffectedTests(filePath: string): Promise<TestCase[]> {
    // Build dependency graph if not already built
    if (Object.keys(this.dependencyGraph).length === 0) {
      await this.buildDependencyGraph();
    }

    const affectedTestFiles = new Set<string>();

    // Check if the file itself is a test
    if (this.isTestFile(filePath)) {
      affectedTestFiles.add(filePath);
    }

    // Find test files that import this file (directly or indirectly)
    const importers = this.findImporters(filePath);
    for (const importer of importers) {
      if (this.isTestFile(importer)) {
        affectedTestFiles.add(importer);
      }
    }

    // Convert test files to test cases
    const testCases: TestCase[] = [];
    for (const testFile of affectedTestFiles) {
      testCases.push({
        id: testFile,
        name: path.basename(testFile),
        file: testFile,
        line: 0,
        suite: [],
        tags: [],
        priority: 0,
      });
    }

    return testCases;
  }

  /**
   * Prioritize tests based on impact severity
   *
   * @param tests - Tests to prioritize
   * @param changes - Code changes
   * @param coverageReport - Optional coverage report
   * @returns Prioritized array of test cases
   */
  prioritizeTests(
    tests: TestCase[],
    changes: CodeChange[],
    coverageReport?: CoverageReport
  ): TestCase[] {
    // Calculate priority score for each test
    const testsWithScores = tests.map((test) => {
      let score = 0;

      // Higher priority for tests that directly test changed files
      for (const change of changes) {
        const testDir = path.dirname(test.file);
        const changeDir = path.dirname(change.file);

        // Same directory: high priority
        if (testDir === changeDir) {
          score += 100;
        }

        // Test file name matches source file: very high priority
        const testBaseName = path.basename(test.file).replace(/\.(test|spec)\./, '.');
        const changeBaseName = path.basename(change.file);
        if (testBaseName.includes(changeBaseName.replace(/\.(ts|js|tsx|jsx|py)$/, ''))) {
          score += 200;
        }

        // Change type affects priority
        if (change.type === 'added') {
          score += 50; // New code needs testing
        } else if (change.type === 'modified') {
          score += 30; // Modified code needs retesting
        } else if (change.type === 'deleted') {
          score += 10; // Deleted code has lower priority
        }

        // More lines changed = higher priority
        score += Math.min(change.lines.length, 50); // Cap at 50
      }

      // Use coverage data to increase priority
      if (coverageReport) {
        for (const change of changes) {
          const fileCoverage = coverageReport.files[change.file];
          if (fileCoverage) {
            // Tests covering changed lines get higher priority
            const coveredLines = change.lines.filter((line) => fileCoverage.lines[line]?.covered);
            score += coveredLines.length * 10;
          }
        }
      }

      return {
        test,
        score,
      };
    });

    // Sort by score (descending) and return tests
    testsWithScores.sort((a, b) => b.score - a.score);

    // Update priority field
    return testsWithScores.map((item, index) => ({
      ...item.test,
      priority: testsWithScores.length - index, // Higher number = higher priority
    }));
  }

  /**
   * Map a file to its test files
   *
   * @param filePath - File path to map
   * @returns Promise resolving to array of test file paths
   */
  async mapFileToTests(filePath: string): Promise<string[]> {
    const affectedTests = await this.getAffectedTests(filePath);
    return affectedTests.map((test) => test.file);
  }

  /**
   * Get code changes from git diff
   *
   * @param gitDiff - Optional git diff string
   * @param baseBranch - Optional base branch to compare against
   * @returns Promise resolving to array of code changes
   */
  private async getChangesFromGit(
    gitDiff?: string,
    baseBranch: string = 'main'
  ): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];

    try {
      // Get git diff
      let diff: string;
      if (gitDiff) {
        diff = gitDiff;
      } else {
        // Get diff from git
        try {
          diff = execSync(`git diff ${baseBranch}...HEAD --name-status`, {
            cwd: this.projectRoot,
            encoding: 'utf-8',
          });
        } catch {
          // If git diff fails, try unstaged changes
          diff = execSync('git diff --name-status', {
            cwd: this.projectRoot,
            encoding: 'utf-8',
          });
        }
      }

      // Parse diff output
      const lines = diff.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length < 2) continue;

        const status = parts[0];
        const file = parts[1];

        // Determine change type
        let type: 'added' | 'modified' | 'deleted';
        if (status.startsWith('A')) {
          type = 'added';
        } else if (status.startsWith('D')) {
          type = 'deleted';
        } else {
          type = 'modified';
        }

        // Get changed lines and functions
        const changedLines = await this.getChangedLines(file, baseBranch);
        const changedFunctions = await this.getChangedFunctions(file, changedLines);

        changes.push({
          file,
          type,
          lines: changedLines,
          functions: changedFunctions,
        });
      }
    } catch (error) {
      // If git operations fail, return empty changes
      console.warn('Failed to get git changes:', error);
    }

    return changes;
  }

  /**
   * Get changed lines for a file
   *
   * @param file - File path
   * @param baseBranch - Base branch
   * @returns Promise resolving to array of line numbers
   */
  private async getChangedLines(file: string, baseBranch: string): Promise<number[]> {
    const lines: number[] = [];

    try {
      // Get unified diff for the file
      const diff = execSync(`git diff ${baseBranch}...HEAD -U0 -- "${file}"`, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      });

      // Parse diff to extract line numbers
      const diffLines = diff.split('\n');
      for (const line of diffLines) {
        // Look for @@ -old +new @@ markers
        const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          const startLine = parseInt(match[1], 10);
          const lineCount = match[2] ? parseInt(match[2], 10) : 1;

          // Add all changed lines
          for (let i = 0; i < lineCount; i++) {
            lines.push(startLine + i);
          }
        }
      }
    } catch {
      // If git diff fails, return empty array
    }

    return lines;
  }

  /**
   * Get changed functions for a file
   *
   * @param file - File path
   * @param changedLines - Changed line numbers
   * @returns Promise resolving to array of function names
   */
  private async getChangedFunctions(file: string, changedLines: number[]): Promise<string[]> {
    const functions: string[] = [];

    try {
      const filePath = path.join(this.projectRoot, file);
      if (!fs.existsSync(filePath)) {
        return functions;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Simple function detection (works for JS/TS/Python)
      const functionPatterns = [
        /function\s+(\w+)/,
        /const\s+(\w+)\s*=\s*(?:async\s+)?\(/,
        /let\s+(\w+)\s*=\s*(?:async\s+)?\(/,
        /(\w+)\s*:\s*(?:async\s+)?\(/,
        /def\s+(\w+)/,
        /class\s+(\w+)/,
      ];

      // Track current function for each line
      const lineFunctions = new Map<number, string>();
      let currentFunction = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this line defines a function
        for (const pattern of functionPatterns) {
          const match = line.match(pattern);
          if (match) {
            currentFunction = match[1];
            break;
          }
        }

        // Map line to current function
        if (currentFunction) {
          lineFunctions.set(i + 1, currentFunction);
        }
      }

      // Find functions that contain changed lines
      const functionSet = new Set<string>();
      for (const lineNum of changedLines) {
        const func = lineFunctions.get(lineNum);
        if (func) {
          functionSet.add(func);
        }
      }

      functions.push(...functionSet);
    } catch {
      // If function detection fails, return empty array
    }

    return functions;
  }

  /**
   * Build dependency graph by analyzing imports
   *
   * @returns Promise that resolves when graph is built
   */
  private async buildDependencyGraph(): Promise<void> {
    this.dependencyGraph = {};

    try {
      // Find all source files
      const sourceFiles = await this.findSourceFiles();

      // Analyze imports for each file
      for (const file of sourceFiles) {
        const imports = await this.extractImports(file);

        // Add to dependency graph
        for (const importedFile of imports) {
          if (!this.dependencyGraph[importedFile]) {
            this.dependencyGraph[importedFile] = new Set();
          }
          this.dependencyGraph[importedFile].add(file);
        }
      }
    } catch (error) {
      console.warn('Failed to build dependency graph:', error);
    }
  }

  /**
   * Find all source files in the project
   *
   * @returns Promise resolving to array of file paths
   */
  private async findSourceFiles(): Promise<string[]> {
    const files: string[] = [];

    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(this.projectRoot, fullPath);

          // Skip node_modules, .git, etc.
          if (
            relativePath.includes('node_modules') ||
            relativePath.includes('.git') ||
            relativePath.includes('dist') ||
            relativePath.includes('build')
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile()) {
            // Include source files
            if (/\.(ts|js|tsx|jsx|py)$/.test(entry.name)) {
              files.push(relativePath);
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    walk(this.projectRoot);
    return files;
  }

  /**
   * Extract imports from a file
   *
   * @param file - File path
   * @returns Promise resolving to array of imported file paths
   */
  private async extractImports(file: string): Promise<string[]> {
    const imports: string[] = [];

    try {
      const filePath = path.join(this.projectRoot, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Extract imports (simple regex-based approach)
      const importPatterns = [
        /import\s+.*\s+from\s+['"](.+)['"]/g,
        /require\(['"](.+)['"]\)/g,
        /from\s+['"](.+)['"]\s+import/g, // Python
      ];

      for (const pattern of importPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const importPath = match[1];

          // Resolve relative imports
          if (importPath.startsWith('.')) {
            const resolvedPath = path.join(path.dirname(file), importPath);
            const normalizedPath = path.normalize(resolvedPath);

            // Try different extensions
            const extensions = ['', '.ts', '.js', '.tsx', '.jsx', '.py'];
            for (const ext of extensions) {
              const fullPath = normalizedPath + ext;
              if (fs.existsSync(path.join(this.projectRoot, fullPath))) {
                imports.push(fullPath);
                break;
              }
            }
          }
        }
      }
    } catch {
      // If import extraction fails, return empty array
    }

    return imports;
  }

  /**
   * Find all files that import a given file (directly or indirectly)
   *
   * @param file - File path
   * @param visited - Set of already visited files (for cycle detection)
   * @returns Set of file paths that import the given file
   */
  private findImporters(file: string, visited: Set<string> = new Set()): Set<string> {
    const importers = new Set<string>();

    // Avoid cycles
    if (visited.has(file)) {
      return importers;
    }
    visited.add(file);

    // Get direct importers
    const directImporters = this.dependencyGraph[file] || new Set();

    for (const importer of directImporters) {
      importers.add(importer);

      // Recursively find importers of importers
      const transitiveImporters = this.findImporters(importer, visited);
      for (const transitive of transitiveImporters) {
        importers.add(transitive);
      }
    }

    return importers;
  }

  /**
   * Check if a file is a test file
   *
   * @param file - File path
   * @returns True if file is a test file
   */
  private isTestFile(file: string): boolean {
    return this.testFilePatterns.some((pattern) => pattern.test(file));
  }

  /**
   * Discover all tests in the project
   *
   * @param framework - Test framework
   * @returns Promise resolving to array of test cases
   */
  private async discoverAllTests(framework: TestFramework): Promise<TestCase[]> {
    const testCases: TestCase[] = [];

    try {
      const sourceFiles = await this.findSourceFiles();
      const testFiles = sourceFiles.filter((file) => this.isTestFile(file));

      for (const testFile of testFiles) {
        testCases.push({
          id: testFile,
          name: path.basename(testFile),
          file: testFile,
          line: 0,
          suite: [],
          tags: [],
          priority: 0,
        });
      }
    } catch (error) {
      console.warn('Failed to discover tests:', error);
    }

    return testCases;
  }

  /**
   * Find affected tests based on code changes
   *
   * @param changes - Code changes
   * @param allTests - All available tests
   * @param coverageReport - Optional coverage report
   * @returns Promise resolving to array of affected test cases
   */
  private async findAffectedTests(
    changes: CodeChange[],
    allTests: TestCase[],
    coverageReport?: CoverageReport
  ): Promise<TestCase[]> {
    const affectedTestFiles = new Set<string>();

    for (const change of changes) {
      // If the changed file is a test, it's affected
      if (this.isTestFile(change.file)) {
        affectedTestFiles.add(change.file);
      }

      // Find tests that import the changed file
      const importers = this.findImporters(change.file);
      for (const importer of importers) {
        if (this.isTestFile(importer)) {
          affectedTestFiles.add(importer);
        }
      }

      // Use coverage data to find tests that cover changed lines
      if (coverageReport) {
        const fileCoverage = coverageReport.files[change.file];
        if (fileCoverage) {
          // Find which tests cover the changed lines
          // This is a simplified approach - in reality, we'd need test-specific coverage
          for (const test of allTests) {
            // Check if test file is in coverage report
            const testCoverage = coverageReport.files[test.file];
            if (testCoverage) {
              // If test has coverage data, assume it might cover changed file
              affectedTestFiles.add(test.file);
            }
          }
        }
      }
    }

    // Convert file paths to test cases
    return allTests.filter((test) => affectedTestFiles.has(test.file));
  }
}
