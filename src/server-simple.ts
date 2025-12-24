/**
 * MCP Testing Server implementation (Simplified)
 *
 * @packageDocumentation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as toolSchemas from './tool-schemas';
import {
  TestFramework,
  FlakyDetectionOptions,
  MutationTestOptions,
  ImpactAnalysisOptions,
  PerformanceBenchmarkOptions,
} from './types';

/**
 * MCP Testing Server class
 */
export class MCPTestingServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-testing',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Set up request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Test Execution Tools
        {
          name: 'test_run',
          description:
            'Execute tests with specified options. Supports Jest, Mocha, Pytest, and Vitest frameworks with options for watch mode, coverage, and parallel execution.',
          inputSchema: toolSchemas.testRunSchema,
        },
        {
          name: 'test_stop',
          description: 'Stop a running test execution by run ID.',
          inputSchema: toolSchemas.testStopSchema,
        },
        {
          name: 'test_list',
          description:
            'List all available tests in the project with their file paths, suite names, and test names.',
          inputSchema: toolSchemas.testListSchema,
        },
        {
          name: 'test_search',
          description: 'Search for tests by name pattern, tag, file path, or suite.',
          inputSchema: toolSchemas.testSearchSchema,
        },

        // Coverage Tools
        {
          name: 'test_coverage_analyze',
          description:
            'Analyze test coverage and return line, branch, function, and statement coverage metrics.',
          inputSchema: toolSchemas.coverageAnalyzeSchema,
        },
        {
          name: 'test_coverage_report',
          description:
            'Generate a coverage report in the specified format (JSON, HTML, LCOV, or Cobertura).',
          inputSchema: toolSchemas.coverageReportSchema,
        },
        {
          name: 'test_coverage_gaps',
          description: 'Identify uncovered code segments with file paths and line numbers.',
          inputSchema: toolSchemas.coverageGapsSchema,
        },
        {
          name: 'test_coverage_trends',
          description: 'Get coverage trends over time with historical comparison.',
          inputSchema: toolSchemas.coverageTrendsSchema,
        },
        {
          name: 'test_coverage_export',
          description: 'Export coverage data to a file in the specified format.',
          inputSchema: toolSchemas.coverageExportSchema,
        },

        // Test Generation Tools
        {
          name: 'test_generate',
          description:
            'Generate unit tests for a specific function with edge cases and property-based tests.',
          inputSchema: toolSchemas.testGenerateSchema,
        },
        {
          name: 'test_generate_from_code',
          description: 'Generate tests from an entire code file by analyzing all functions.',
          inputSchema: toolSchemas.testGenerateFromCodeSchema,
        },
        {
          name: 'test_generate_fixtures',
          description: 'Generate test fixtures and setup functions based on code requirements.',
          inputSchema: toolSchemas.testGenerateFixturesSchema,
        },
        {
          name: 'test_suggest_cases',
          description: 'Suggest additional test cases to improve coverage based on existing tests.',
          inputSchema: toolSchemas.testSuggestCasesSchema,
        },

        // Debugging Tools
        {
          name: 'test_debug',
          description:
            'Start a debug session for a specific test using mcp-debugger-server integration.',
          inputSchema: toolSchemas.testDebugSchema,
        },
        {
          name: 'test_analyze_failure',
          description: 'Analyze a test failure and suggest potential root causes.',
          inputSchema: toolSchemas.testAnalyzeFailureSchema,
        },
        {
          name: 'test_compare_values',
          description:
            'Compare expected and actual values from a test failure and highlight differences.',
          inputSchema: toolSchemas.testCompareValuesSchema,
        },

        // Advanced Testing Tools
        {
          name: 'test_detect_flaky',
          description:
            'Detect flaky tests by running them multiple times and analyzing result consistency.',
          inputSchema: toolSchemas.testDetectFlakySchema,
        },
        {
          name: 'test_mutation_run',
          description:
            'Run mutation testing to verify test suite effectiveness by generating and testing code mutations.',
          inputSchema: toolSchemas.testMutationRunSchema,
        },
        {
          name: 'test_impact_analyze',
          description:
            'Analyze which tests are affected by code changes using git diff and coverage data.',
          inputSchema: toolSchemas.testImpactAnalyzeSchema,
        },
        {
          name: 'test_performance_benchmark',
          description:
            'Benchmark test performance, identify slow tests, and detect performance regressions.',
          inputSchema: toolSchemas.testPerformanceBenchmarkSchema,
        },

        // Configuration Tools
        {
          name: 'test_configure_framework',
          description: 'Configure test framework settings with custom configuration.',
          inputSchema: toolSchemas.testConfigureFrameworkSchema,
        },
        {
          name: 'test_get_config',
          description: 'Get current test framework configuration.',
          inputSchema: toolSchemas.testGetConfigSchema,
        },
        {
          name: 'test_set_config',
          description: 'Set test framework configuration with optional merge.',
          inputSchema: toolSchemas.testSetConfigSchema,
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result;

        switch (name) {
          // Test Execution Tools
          case 'test_run':
            result = await this.handleTestRun(args);
            break;
          case 'test_stop':
            result = await this.handleTestStop(args);
            break;
          case 'test_list':
            result = await this.handleTestList(args);
            break;
          case 'test_search':
            result = await this.handleTestSearch(args);
            break;

          // Coverage Tools
          case 'test_coverage_analyze':
            result = await this.handleCoverageAnalyze(args);
            break;
          case 'test_coverage_report':
            result = await this.handleCoverageReport(args);
            break;
          case 'test_coverage_gaps':
            result = await this.handleCoverageGaps(args);
            break;
          case 'test_coverage_trends':
            result = await this.handleCoverageTrends(args);
            break;
          case 'test_coverage_export':
            result = await this.handleCoverageExport(args);
            break;

          // Test Generation Tools
          case 'test_generate':
            result = await this.handleTestGenerate(args);
            break;
          case 'test_generate_from_code':
            result = await this.handleTestGenerateFromCode(args);
            break;
          case 'test_generate_fixtures':
            result = await this.handleTestGenerateFixtures(args);
            break;
          case 'test_suggest_cases':
            result = await this.handleTestSuggestCases(args);
            break;

          // Debugging Tools
          case 'test_debug':
            result = await this.handleTestDebug(args);
            break;
          case 'test_analyze_failure':
            result = await this.handleTestAnalyzeFailure(args);
            break;
          case 'test_compare_values':
            result = await this.handleTestCompareValues(args);
            break;

          // Advanced Testing Tools
          case 'test_detect_flaky':
            result = await this.handleTestDetectFlaky(args);
            break;
          case 'test_mutation_run':
            result = await this.handleTestMutationRun(args);
            break;
          case 'test_impact_analyze':
            result = await this.handleTestImpactAnalyze(args);
            break;
          case 'test_performance_benchmark':
            result = await this.handleTestPerformanceBenchmark(args);
            break;

          // Configuration Tools
          case 'test_configure_framework':
            result = await this.handleTestConfigureFramework(args);
            break;
          case 'test_get_config':
            result = await this.handleTestGetConfig(args);
            break;
          case 'test_set_config':
            result = await this.handleTestSetConfig(args);
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'error',
                  error: errorMessage,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  // Tool handler implementations
  private async handleTestRun(args: unknown) {
    const {
      framework,
      projectPath,
      testPath,
      pattern,
      watch,
      coverage,
      parallel,
      maxWorkers,
      timeout,
      env,
    } = args as {
      framework: TestFramework;
      projectPath?: string;
      testPath?: string;
      pattern?: string;
      watch?: boolean;
      coverage?: boolean;
      parallel?: boolean;
      maxWorkers?: number;
      timeout?: number;
      env?: Record<string, string>;
    };

    // Validate required parameters
    if (!framework) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Required parameter missing: framework',
          remediation: this.getErrorRemediation('INVALID_PARAMETERS'),
          timestamp: new Date().toISOString(),
        },
      };
    }

    try {
      const { TestRunnerManager } = await import('./components/TestRunnerManager');
      const runner = new TestRunnerManager(projectPath);

      const options = {
        framework,
        testPath,
        pattern,
        watch,
        coverage,
        parallel,
        maxWorkers,
        timeout,
        env,
      };

      const results = await runner.runTests(options);

      return {
        status: 'success',
        data: {
          results,
          summary: {
            passed: results.filter((r) => r.status === 'passed').length,
            failed: results.filter((r) => r.status === 'failed').length,
            skipped: results.filter((r) => r.status === 'skipped').length,
            total: results.length,
          },
        },
      };
    } catch (error) {
      const errorCode = (error as any).code || 'TEST_EXECUTION_FAILED';
      return {
        status: 'error',
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : String(error),
          remediation: this.getErrorRemediation(errorCode),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Get remediation advice for error codes
   */
  private getErrorRemediation(code: string): string {
    const remediations: Record<string, string> = {
      TEST_FILE_NOT_FOUND: 'Verify the test file path exists and is accessible',
      TEST_EXECUTION_FAILED: 'Check test framework installation and configuration',
      FRAMEWORK_NOT_FOUND: 'Install the test framework via npm/pip',
      FRAMEWORK_NOT_ALLOWED: 'Add the framework to the security allowlist',
      TIMEOUT: 'Increase timeout or optimize slow tests',
      INVALID_PARAMETERS: 'Check that all required parameters are provided with correct types',
      FUNCTION_NOT_FOUND: 'Verify the function name exists in the source file',
      TEST_GENERATION_FAILED: 'Check the source file syntax and ensure it contains valid code',
    };
    return remediations[code] || 'Check the error message for details';
  }

  private async handleTestStop(args: unknown) {
    const { runId } = args as { runId: string };

    try {
      const { TestRunnerManager } = await import('./components/TestRunnerManager');
      const runner = new TestRunnerManager();

      await runner.stopTests(runId);

      return {
        status: 'success',
        data: {
          runId,
          stopped: true,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: 'TEST_STOP_FAILED',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async handleTestList(args: unknown) {
    const { framework, projectPath } = args as {
      framework: TestFramework;
      projectPath?: string;
    };

    try {
      const { TestManager } = await import('./components/TestManager');
      const manager = new TestManager(projectPath || process.cwd());

      const tests = await manager.discoverTests(framework);

      return {
        status: 'success',
        data: {
          framework,
          projectPath: projectPath || process.cwd(),
          tests,
          total: tests.length,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: 'TEST_LIST_FAILED',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async handleTestSearch(args: unknown) {
    const { framework, projectPath, pattern, tags, file, suite, status } = args as {
      framework: TestFramework;
      projectPath?: string;
      pattern?: string;
      tags?: string[];
      file?: string;
      suite?: string;
      status?: string;
    };

    try {
      const { TestManager } = await import('./components/TestManager');
      const manager = new TestManager(projectPath || process.cwd());

      // First discover tests
      await manager.discoverTests(framework);

      // Then search with criteria
      const tests = manager.searchTests({
        pattern,
        tags,
        file,
        suite,
        status: status as any,
      });

      return {
        status: 'success',
        data: {
          framework,
          projectPath: projectPath || process.cwd(),
          tests,
          total: tests.length,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: 'TEST_SEARCH_FAILED',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async handleCoverageAnalyze(args: unknown) {
    const { framework, testResults, coverageDataPath } = args as {
      framework: TestFramework;
      testResults?: any[];
      coverageDataPath?: string;
    };

    try {
      const { CoverageAnalyzer } = await import('./components/CoverageAnalyzer');
      const analyzer = new CoverageAnalyzer(coverageDataPath);

      // If testResults not provided, use empty array (coverage data comes from files)
      const results = testResults || [];

      const coverageReport = await analyzer.analyzeCoverage(results, framework);

      return {
        status: 'success',
        data: coverageReport,
      };
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: 'COVERAGE_ANALYSIS_FAILED',
          message: error instanceof Error ? error.message : String(error),
          remediation: this.getErrorRemediation('COVERAGE_ANALYSIS_FAILED'),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async handleCoverageReport(args: unknown) {
    const { framework, format, testResults, coverageDataPath } = args as {
      framework: TestFramework;
      format: string;
      testResults?: any[];
      coverageDataPath?: string;
    };

    try {
      const { CoverageAnalyzer } = await import('./components/CoverageAnalyzer');
      const { ReportFormat } = await import('./types');
      const analyzer = new CoverageAnalyzer(coverageDataPath);

      // First analyze coverage
      const results = testResults || [];
      const coverageReport = await analyzer.analyzeCoverage(results, framework);

      // Then generate report in requested format
      const reportFormat = format.toUpperCase() as keyof typeof ReportFormat;
      const reportContent = await analyzer.generateReport(
        coverageReport,
        ReportFormat[reportFormat]
      );

      return {
        status: 'success',
        data: {
          format,
          content: reportContent,
          metrics: coverageReport.overall,
        },
      };
    } catch (error) {
      throw new Error(
        `Coverage report generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleCoverageGaps(args: unknown) {
    const { framework, testResults, coverageDataPath } = args as {
      framework: TestFramework;
      testResults?: any[];
      coverageDataPath?: string;
    };

    try {
      const { CoverageAnalyzer } = await import('./components/CoverageAnalyzer');
      const analyzer = new CoverageAnalyzer(coverageDataPath);

      // First analyze coverage
      const results = testResults || [];
      const coverageReport = await analyzer.analyzeCoverage(results, framework);

      // Then get coverage gaps
      const gaps = analyzer.getCoverageGaps(coverageReport);

      return {
        status: 'success',
        data: {
          gaps,
          totalGaps: gaps.length,
          gapsByType: {
            line: gaps.filter((g) => g.type === 'line').length,
            branch: gaps.filter((g) => g.type === 'branch').length,
            function: gaps.filter((g) => g.type === 'function').length,
          },
        },
      };
    } catch (error) {
      throw new Error(
        `Coverage gap analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleCoverageTrends(args: unknown) {
    const { timeRange, coverageDataPath } = args as {
      timeRange: { start: string; end: string };
      coverageDataPath?: string;
    };

    try {
      const { CoverageAnalyzer } = await import('./components/CoverageAnalyzer');
      const analyzer = new CoverageAnalyzer(coverageDataPath);

      const trends = await analyzer.getCoverageTrends(timeRange);

      return {
        status: 'success',
        data: {
          trends,
          totalDataPoints: trends.length,
          timeRange,
        },
      };
    } catch (error) {
      throw new Error(
        `Coverage trend analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleCoverageExport(args: unknown) {
    const { framework, format, outputPath, testResults, coverageDataPath } = args as {
      framework: TestFramework;
      format: string;
      outputPath: string;
      testResults?: any[];
      coverageDataPath?: string;
    };

    try {
      const { CoverageAnalyzer } = await import('./components/CoverageAnalyzer');
      const { ReportFormat } = await import('./types');
      const fs = await import('fs/promises');
      const path = await import('path');

      const analyzer = new CoverageAnalyzer(coverageDataPath);

      // First analyze coverage
      const results = testResults || [];
      const coverageReport = await analyzer.analyzeCoverage(results, framework);

      // Generate report in requested format
      const reportFormat = format.toUpperCase() as keyof typeof ReportFormat;
      const reportContent = await analyzer.generateReport(
        coverageReport,
        ReportFormat[reportFormat]
      );

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Write report to file
      await fs.writeFile(outputPath, reportContent, 'utf-8');

      return {
        status: 'success',
        data: {
          outputPath,
          format,
          fileSize: reportContent.length,
          metrics: coverageReport.overall,
        },
      };
    } catch (error) {
      throw new Error(
        `Coverage export failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleTestGenerate(args: unknown) {
    const { framework, filePath, functionName, includeEdgeCases, includePropertyTests } = args as {
      framework: TestFramework;
      filePath: string;
      functionName?: string;
      includeEdgeCases?: boolean;
      includePropertyTests?: boolean;
    };

    try {
      const { TestGenerator } = await import('./components/TestGenerator');
      const generator = new TestGenerator();

      // Read the source file and analyze functions
      const sourceCode = await generator['filesystem'].readFile(filePath);
      const functions = await generator['analyzeFunctionsFromSource'](sourceCode, filePath);

      // Filter to specific function if provided
      const targetFunctions = functionName
        ? functions.filter((f) => f.name === functionName)
        : functions;

      if (targetFunctions.length === 0) {
        return {
          status: 'error',
          error: {
            code: 'FUNCTION_NOT_FOUND',
            message: functionName
              ? `Function '${functionName}' not found in ${filePath}`
              : `No functions found in ${filePath}`,
            remediation: functionName
              ? 'Verify the function name exists in the source file'
              : 'Ensure the source file contains exportable functions',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Generate tests for each function
      const allTests = [];
      for (const func of targetFunctions) {
        const tests = await generator.generateTests(func);
        allTests.push(...tests);
      }

      return {
        status: 'success',
        data: {
          framework,
          filePath,
          functionName,
          testsGenerated: allTests.length,
          tests: allTests,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: 'TEST_GENERATION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          remediation: this.getErrorRemediation('TEST_GENERATION_FAILED'),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async handleTestGenerateFromCode(args: unknown) {
    const { framework, filePath, outputPath } = args as {
      framework: TestFramework;
      filePath: string;
      outputPath?: string;
    };

    try {
      const { TestGenerator } = await import('./components/TestGenerator');
      const path = await import('path');
      const generator = new TestGenerator();

      // Generate tests from the entire code file
      const tests = await generator.generateTestsFromCode(filePath);

      if (tests.length === 0) {
        return {
          status: 'error',
          error: {
            code: 'NO_FUNCTIONS_FOUND',
            message: `No testable functions found in ${filePath}`,
            remediation: 'Ensure the source file contains exportable functions',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Determine output path if not provided
      const finalOutputPath =
        outputPath ||
        filePath.replace(/\.(ts|js)$/, '.test.$1').replace(/^src\//, 'src/__tests__/');

      // Write generated tests to file
      await generator.writeGeneratedTests(tests, finalOutputPath);

      return {
        status: 'success',
        data: {
          framework,
          filePath,
          outputPath: finalOutputPath,
          testsGenerated: tests.length,
          tests: tests.map((t) => ({
            name: t.name,
            type: t.type,
            targetFunction: t.targetFunction,
            description: t.description,
          })),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: 'TEST_GENERATION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          remediation: this.getErrorRemediation('TEST_GENERATION_FAILED'),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async handleTestGenerateFixtures(args: unknown) {
    const { framework, filePath } = args as {
      framework: TestFramework;
      filePath: string;
    };

    try {
      const { TestGenerator } = await import('./components/TestGenerator');
      const generator = new TestGenerator();

      // Read the source file to extract data schemas
      const sourceCode = await generator['filesystem'].readFile(filePath);

      // Parse TypeScript to extract interfaces/types that can be used as schemas
      const schemas = await this.extractDataSchemas(sourceCode, filePath);

      if (schemas.length === 0) {
        return {
          status: 'error',
          error: {
            code: 'NO_SCHEMAS_FOUND',
            message: `No data schemas found in ${filePath}`,
            remediation: 'Ensure the source file contains interface or type definitions',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Generate fixtures for each schema
      const allFixtures = [];
      for (const schema of schemas) {
        const fixtures = await generator.generateFixtures(schema);
        allFixtures.push(...fixtures);
      }

      return {
        status: 'success',
        data: {
          framework,
          filePath,
          schemasFound: schemas.length,
          fixturesGenerated: allFixtures.length,
          fixtures: allFixtures,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: 'FIXTURE_GENERATION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          remediation: 'Check the source file syntax and ensure it contains valid type definitions',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async handleTestSuggestCases(args: unknown) {
    const { framework, testPath } = args as {
      framework: TestFramework;
      testPath: string;
    };

    try {
      const { TestGenerator } = await import('./components/TestGenerator');
      const generator = new TestGenerator();

      // Read the test file
      const testCode = await generator['filesystem'].readFile(testPath);

      // Extract existing test cases from the file
      const existingTests = await this.extractExistingTests(testCode, testPath);

      if (existingTests.length === 0) {
        return {
          status: 'error',
          error: {
            code: 'NO_TESTS_FOUND',
            message: `No existing tests found in ${testPath}`,
            remediation: 'Ensure the test file contains test cases (it/test blocks)',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Generate suggestions based on existing tests
      const suggestions = await generator.suggestTestCases(existingTests);

      return {
        status: 'success',
        data: {
          framework,
          testPath,
          existingTests: existingTests.length,
          suggestionsGenerated: suggestions.length,
          suggestions: suggestions.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: 'TEST_SUGGESTION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          remediation: 'Check the test file syntax and ensure it contains valid test code',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Extract data schemas from source code
   */
  private async extractDataSchemas(
    sourceCode: string,
    filePath: string
  ): Promise<Array<{ name: string; properties: Record<string, any>; required?: string[] }>> {
    const ts = await import('typescript');
    const schemas: Array<{ name: string; properties: Record<string, any>; required?: string[] }> =
      [];

    const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);

    const visit = (node: any) => {
      // Look for interface declarations
      if (ts.isInterfaceDeclaration(node)) {
        const schema = this.extractSchemaFromInterface(node, ts);
        if (schema) {
          schemas.push(schema);
        }
      }

      // Look for type aliases
      if (ts.isTypeAliasDeclaration(node)) {
        const schema = this.extractSchemaFromTypeAlias(node, ts);
        if (schema) {
          schemas.push(schema);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return schemas;
  }

  /**
   * Extract schema from interface declaration
   */
  private extractSchemaFromInterface(
    node: any,
    ts: any
  ): { name: string; properties: Record<string, any>; required?: string[] } | null {
    const name = node.name.text;
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const member of node.members) {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
        const propName = member.name.text;
        const propType = member.type ? this.typeNodeToSchemaType(member.type, ts) : 'any';

        properties[propName] = {
          type: propType,
        };

        // Check if property is required (no question token)
        if (!member.questionToken) {
          required.push(propName);
        }
      }
    }

    return {
      name,
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Extract schema from type alias
   */
  private extractSchemaFromTypeAlias(
    node: any,
    ts: any
  ): { name: string; properties: Record<string, any>; required?: string[] } | null {
    const name = node.name.text;

    // Only handle object type literals
    if (!ts.isTypeLiteralNode(node.type)) {
      return null;
    }

    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const member of node.type.members) {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
        const propName = member.name.text;
        const propType = member.type ? this.typeNodeToSchemaType(member.type, ts) : 'any';

        properties[propName] = {
          type: propType,
        };

        if (!member.questionToken) {
          required.push(propName);
        }
      }
    }

    return {
      name,
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Convert TypeScript type node to schema type
   */
  private typeNodeToSchemaType(typeNode: any, ts: any): string {
    // Check if it's a keyword type node by checking the kind property
    if (typeNode.kind !== undefined) {
      switch (typeNode.kind) {
        case ts.SyntaxKind.StringKeyword:
          return 'string';
        case ts.SyntaxKind.NumberKeyword:
          return 'number';
        case ts.SyntaxKind.BooleanKeyword:
          return 'boolean';
        case ts.SyntaxKind.AnyKeyword:
          return 'any';
      }
    }

    // Check for array type
    if (ts.isArrayTypeNode && ts.isArrayTypeNode(typeNode)) {
      return 'array';
    }

    // Check for type literal (object)
    if (ts.isTypeLiteralNode && ts.isTypeLiteralNode(typeNode)) {
      return 'object';
    }

    return 'any';
  }

  /**
   * Extract existing tests from test file
   */
  private async extractExistingTests(
    testCode: string,
    testPath: string
  ): Promise<Array<{ name: string; description: string; assertions: number; coverage: string[] }>> {
    const ts = await import('typescript');
    const tests: Array<{
      name: string;
      description: string;
      assertions: number;
      coverage: string[];
    }> = [];

    const sourceFile = ts.createSourceFile(testPath, testCode, ts.ScriptTarget.Latest, true);

    const visit = (node: any) => {
      // Look for test calls (it, test, describe)
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        if (ts.isIdentifier(expression)) {
          const functionName = expression.text;

          if (functionName === 'it' || functionName === 'test') {
            // Extract test name from first argument
            const firstArg = node.arguments[0];
            if (firstArg && ts.isStringLiteral(firstArg)) {
              const testName = firstArg.text;

              // Count assertions in test body
              const secondArg = node.arguments[1];
              let assertions = 0;
              if (secondArg) {
                const testBody = secondArg.getText();
                assertions = (testBody.match(/expect\(/g) || []).length;
              }

              tests.push({
                name: testName,
                description: testName,
                assertions,
                coverage: this.inferCoverageFromTestName(testName),
              });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return tests;
  }

  /**
   * Infer coverage areas from test name
   */
  private inferCoverageFromTestName(testName: string): string[] {
    const coverage: string[] = [];
    const lowerName = testName.toLowerCase();

    if (lowerName.includes('error') || lowerName.includes('throw')) {
      coverage.push('error-handling');
    }
    if (lowerName.includes('edge') || lowerName.includes('boundary')) {
      coverage.push('edge-cases');
    }
    if (
      lowerName.includes('empty') ||
      lowerName.includes('null') ||
      lowerName.includes('undefined')
    ) {
      coverage.push('boundary-conditions');
    }
    if (lowerName.includes('integration') || lowerName.includes('workflow')) {
      coverage.push('integration');
    }

    // Default to basic functionality if no specific coverage identified
    if (coverage.length === 0) {
      coverage.push('basic-functionality');
    }

    return coverage;
  }

  private async handleTestDebug(args: unknown) {
    const { framework, testPath, testName } = args as {
      framework: TestFramework;
      testPath: string;
      testName: string;
    };

    try {
      const { DebugIntegration } = await import('./components/DebugIntegration');
      const { TestStatus } = await import('./types');

      // Create debugger integration without mcp-debugger-server for now
      // In production, this would be configured with actual debugger client
      const debugIntegration = new DebugIntegration();

      // Create a test result to demonstrate the flow
      // In a real implementation, this would come from running the test
      const testResult = {
        id: `${testPath}::${testName}`,
        name: testName,
        fullName: testName,
        status: TestStatus.FAILED,
        duration: 0,
        file: testPath,
        line: 1,
        suite: [],
        tags: [],
        metadata: {
          framework,
          retries: 0,
          flaky: false,
          slow: false,
          tags: [],
          customData: {},
        },
        timestamp: new Date().toISOString(),
        error: {
          message: 'Test failed - run the test first to get actual failure details',
          stack: `at ${testPath}:1:1`,
        },
      };

      // Extract failure location
      const location = debugIntegration.extractFailureLocation(testResult);

      // Capture error information
      const errorInfo = debugIntegration.captureErrorInformation(testResult);

      return {
        status: 'success',
        data: {
          debugInfo: {
            file: location.file,
            line: location.line,
            column: location.column,
            functionName: location.functionName,
            testName,
          },
          errorInfo: errorInfo
            ? {
                message: errorInfo.message,
                stack: errorInfo.stack,
                expected: errorInfo.expected,
                actual: errorInfo.actual,
              }
            : null,
          message:
            'Debug information prepared. To start an interactive debug session, configure mcp-debugger-server integration.',
          instructions: [
            'Set a breakpoint at the failure location',
            'Run the test in debug mode',
            'Inspect variables and call stack at the failure point',
          ],
        },
      };
    } catch (error) {
      throw new Error(
        `Test debug failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleTestAnalyzeFailure(args: unknown) {
    const argsObj = args as {
      testId?: string;
      error?: {
        message: string;
        stack?: string;
      };
      // Legacy format support
      framework?: TestFramework;
      testPath?: string;
      testName?: string;
      errorMessage?: string;
    };

    // Support both new format (testId, error) and legacy format (framework, testPath, testName, errorMessage)
    let testId: string;
    let error: { message: string; stack?: string } | undefined;

    if (argsObj.testId) {
      // New format
      testId = argsObj.testId;
      error = argsObj.error;
    } else if (argsObj.testPath && argsObj.testName) {
      // Legacy format
      testId = `${argsObj.testPath}::${argsObj.testName}`;
      if (argsObj.errorMessage) {
        error = {
          message: argsObj.errorMessage,
          stack: `at ${argsObj.testPath}:1:1\n${argsObj.errorMessage}`,
        };
      }
    } else {
      // Invalid parameters
      return {
        status: 'error',
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Required parameter missing: testId (or testPath and testName)',
          remediation: this.getErrorRemediation('INVALID_PARAMETERS'),
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Parse testId to extract testPath and testName
    const [testPath, testName] = testId.includes('::') ? testId.split('::') : [testId, 'unknown'];
    const errorMessage = error?.message;

    try {
      const { DebugIntegration } = await import('./components/DebugIntegration');
      const { TestStatus } = await import('./types');
      const debugIntegration = new DebugIntegration();

      // Create a test result from the provided information
      const testResult = {
        id: `${testPath}::${testName}`,
        name: testName,
        fullName: testName,
        status: TestStatus.FAILED,
        duration: 0,
        file: testPath,
        line: 1,
        suite: [],
        tags: [],
        metadata: {
          framework: TestFramework.JEST,
          retries: 0,
          flaky: false,
          slow: false,
          tags: [],
          customData: {},
        },
        timestamp: new Date().toISOString(),
        error: {
          message: error?.message || errorMessage || 'Unknown error',
          stack:
            error?.stack ||
            `at ${testPath}:1:1\n${error?.message || errorMessage || 'Unknown error'}`,
        },
      };

      // Capture complete error information
      const errorInfo = debugIntegration.captureErrorInformation(testResult);

      // Extract failure location
      const location = debugIntegration.extractFailureLocation(testResult);

      // Analyze root cause
      const rootCauses = debugIntegration.analyzeRootCause(testResult);

      return {
        status: 'success',
        data: {
          testId,
          testName,
          testPath,
          errorInfo: errorInfo
            ? {
                message: errorInfo.message,
                stack: errorInfo.stack,
                expected: errorInfo.expected,
                actual: errorInfo.actual,
                diff: errorInfo.diff,
                code: errorInfo.code,
              }
            : null,
          location: {
            file: location.file,
            line: location.line,
            column: location.column,
            functionName: location.functionName,
            source: location.source,
          },
          rootCauses: rootCauses.map((cause) => ({
            type: cause.type,
            confidence: cause.confidence,
            description: cause.description,
            suggestedFix: cause.suggestedFix,
            relatedCode: cause.relatedCode,
          })),
          summary: `Analyzed ${rootCauses.length} potential root cause(s) for test failure`,
          analysis: {
            errorInfo: errorInfo
              ? {
                  message: errorInfo.message,
                  stack: errorInfo.stack,
                  expected: errorInfo.expected,
                  actual: errorInfo.actual,
                  diff: errorInfo.diff,
                  code: errorInfo.code,
                }
              : null,
            location: {
              file: location.file,
              line: location.line,
              column: location.column,
              functionName: location.functionName,
              source: location.source,
            },
            rootCauses: rootCauses.map((cause) => ({
              type: cause.type,
              confidence: cause.confidence,
              description: cause.description,
              suggestedFix: cause.suggestedFix,
              relatedCode: cause.relatedCode,
            })),
            summary: `Analyzed ${rootCauses.length} potential root cause(s) for test failure`,
          },
        },
      };
    } catch (error) {
      throw new Error(
        `Test failure analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleTestCompareValues(args: unknown) {
    const { expected, actual, deep } = args as {
      expected: unknown;
      actual: unknown;
      deep?: boolean;
    };

    try {
      const { DebugIntegration } = await import('./components/DebugIntegration');
      const debugIntegration = new DebugIntegration();

      // Compare expected and actual values
      const comparison = debugIntegration.compareValues(expected, actual);

      return {
        status: 'success',
        data: {
          expected: comparison.expected,
          actual: comparison.actual,
          type: comparison.type,
          diff: comparison.diff,
          differences: comparison.differences.map((diff) => ({
            path: diff.path,
            expectedValue: diff.expectedValue,
            actualValue: diff.actualValue,
            type: diff.type,
          })),
          summary: `Found ${comparison.differences.length} difference(s) between expected and actual values`,
          areEqual: comparison.differences.length === 0,
        },
      };
    } catch (error) {
      throw new Error(
        `Value comparison failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleTestDetectFlaky(args: unknown) {
    const { framework, testPath, testName, iterations, timeout } = args as {
      framework: TestFramework;
      testPath?: string;
      testName?: string;
      iterations?: number;
      timeout?: number;
    };

    try {
      const { FlakyDetector } = await import('./components/FlakyDetector');

      const detector = new FlakyDetector();

      // Create flaky detection options
      const options: FlakyDetectionOptions = {
        framework,
        testPath,
        testId: testName,
        iterations,
        timeout,
      };

      // Detect flaky tests
      const flakyTests = await detector.detectFlakyTests(options);

      // Generate fix suggestions for each flaky test
      const testsWithFixes = await Promise.all(
        flakyTests.map(async (test) => {
          const fixes = await detector.suggestFixes(test);
          return {
            ...test,
            suggestedFixes: fixes,
          };
        })
      );

      return {
        status: 'success',
        data: {
          flakyTests: testsWithFixes,
          totalTests: testsWithFixes.length,
          summary: `Found ${testsWithFixes.length} flaky test(s) after ${iterations || 10} iterations`,
          statistics: {
            totalFlaky: testsWithFixes.length,
            highFailureRate: testsWithFixes.filter((t) => t.failureRate > 0.5).length,
            mediumFailureRate: testsWithFixes.filter(
              (t) => t.failureRate > 0.2 && t.failureRate <= 0.5
            ).length,
            lowFailureRate: testsWithFixes.filter((t) => t.failureRate <= 0.2).length,
          },
        },
      };
    } catch (error) {
      throw new Error(
        `Flaky test detection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleTestMutationRun(args: unknown) {
    const { framework, filePath, testPath, timeout } = args as {
      framework: TestFramework;
      filePath: string;
      testPath?: string;
      timeout?: number;
    };

    try {
      const { MutationTester } = await import('./components/MutationTester');

      const tester = new MutationTester();

      // Create mutation test options
      const options: MutationTestOptions = {
        framework,
        filePath,
        testPath,
        timeout,
      };

      // Run mutation testing
      const report = await tester.runMutationTesting(options);

      // Categorize mutations by type
      const mutationsByType: Record<string, number> = {};
      for (const mutation of report.mutations) {
        mutationsByType[mutation.mutationType] = (mutationsByType[mutation.mutationType] || 0) + 1;
      }

      // Get surviving mutations (high priority for fixing)
      const survivingMutations = report.mutations
        .filter((m) => !m.killed)
        .map((m) => ({
          id: m.id,
          file: m.file,
          line: m.line,
          type: m.mutationType,
          original: m.original,
          mutated: m.mutated,
          suggestion: `Add test case to catch this mutation: ${m.original} → ${m.mutated}`,
        }));

      return {
        status: 'success',
        data: {
          mutations: report.mutations.map((m) => ({
            id: m.id,
            file: m.file,
            line: m.line,
            type: m.mutationType,
            original: m.original,
            mutated: m.mutated,
            killed: m.killed,
            killedBy: m.killedBy,
          })),
          report: {
            totalMutations: report.totalMutations,
            killedMutations: report.killedMutations,
            survivedMutations: report.survivedMutations,
            mutationScore: report.mutationScore,
            timestamp: report.timestamp,
          },
          mutationsByType,
          survivingMutations,
          summary: `Mutation score: ${report.mutationScore.toFixed(1)}% (${report.killedMutations}/${report.totalMutations} mutations killed)`,
          recommendation:
            report.mutationScore >= 80
              ? 'Excellent test coverage! Your tests catch most mutations.'
              : report.mutationScore >= 60
                ? 'Good test coverage, but consider adding tests for surviving mutations.'
                : 'Test coverage needs improvement. Many mutations survived.',
        },
      };
    } catch (error) {
      throw new Error(
        `Mutation testing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleTestImpactAnalyze(args: unknown) {
    const { framework, gitDiff, baseBranch, changedFiles } = args as {
      framework: TestFramework;
      gitDiff?: string;
      baseBranch?: string;
      changedFiles?: string[];
    };

    try {
      const { ImpactAnalyzer } = await import('./components/ImpactAnalyzer');

      const analyzer = new ImpactAnalyzer();

      // Create impact analysis options
      const options: ImpactAnalysisOptions = {
        framework,
        gitDiff,
        baseBranch,
      };

      // If changedFiles provided, create CodeChange objects
      if (changedFiles && changedFiles.length > 0) {
        options.changes = changedFiles.map((file) => ({
          file,
          type: 'modified' as const,
          lines: [],
          functions: [],
        }));
      }

      // Analyze impact
      const analysis = await analyzer.analyzeImpact(options);

      // Categorize affected tests by priority
      const highPriority = analysis.prioritizedTests.filter((t) => t.priority >= 80);
      const mediumPriority = analysis.prioritizedTests.filter(
        (t) => t.priority >= 40 && t.priority < 80
      );
      const lowPriority = analysis.prioritizedTests.filter((t) => t.priority < 40);

      return {
        status: 'success',
        data: {
          affectedTests: analysis.affectedTests.map((t) => ({
            id: t.id,
            name: t.name,
            file: t.file,
            line: t.line,
            priority: t.priority,
          })),
          analysis: {
            totalTests: analysis.totalTests,
            affectedTests: analysis.affectedTests.length,
            affectedPercentage: analysis.affectedPercentage.toFixed(1),
            changes: analysis.changes.map((c) => ({
              file: c.file,
              type: c.type,
              linesChanged: c.lines.length,
              functionsChanged: c.functions.length,
            })),
          },
          prioritizedTests: {
            high: highPriority.map((t) => ({
              name: t.name,
              file: t.file,
              priority: t.priority,
            })),
            medium: mediumPriority.map((t) => ({
              name: t.name,
              file: t.file,
              priority: t.priority,
            })),
            low: lowPriority.map((t) => ({
              name: t.name,
              file: t.file,
              priority: t.priority,
            })),
          },
          summary: `${analysis.affectedTests.length} of ${analysis.totalTests} tests affected (${analysis.affectedPercentage.toFixed(1)}%)`,
          recommendation:
            analysis.affectedPercentage < 20
              ? 'Run only affected tests for faster feedback'
              : analysis.affectedPercentage < 50
                ? 'Consider running affected tests first, then full suite'
                : 'Changes affect many tests. Consider running full test suite.',
        },
      };
    } catch (error) {
      throw new Error(
        `Test impact analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleTestPerformanceBenchmark(args: unknown) {
    const { framework, testPath, pattern, slowThreshold, includeHistory, timeout } = args as {
      framework: TestFramework;
      testPath?: string;
      pattern?: string;
      slowThreshold?: number;
      includeHistory?: boolean;
      timeout?: number;
    };

    try {
      const { PerformanceBenchmarker } = await import('./components/PerformanceBenchmarker');

      const benchmarker = new PerformanceBenchmarker();

      // Create benchmark options
      const options: PerformanceBenchmarkOptions = {
        framework,
        testPath,
        pattern,
        slowThreshold,
        includeHistory,
        timeout,
      };

      // Run benchmark
      const report = await benchmarker.runBenchmark(options);

      // Format slow tests with suggestions
      const slowTestsWithSuggestions = report.slowTests.map((test) => ({
        name: test.testName,
        file: test.file,
        duration: test.duration,
        durationFormatted: `${(test.duration / 1000).toFixed(2)}s`,
        trend: test.trend
          ? {
              current: test.trend.current,
              average: test.trend.average,
              regression: test.trend.regression,
              regressionPercentage: test.trend.regressionPercentage?.toFixed(1),
            }
          : undefined,
        optimizations: test.optimizationSuggestions.map((s) => ({
          type: s.type,
          description: s.description,
          priority: s.priority,
          estimatedImprovement: s.estimatedImprovement,
          code: s.code,
        })),
      }));

      // Format regressions
      const regressionsFormatted = report.regressions.map((test) => ({
        name: test.testName,
        file: test.file,
        duration: test.duration,
        previousAverage: test.trend?.average,
        regressionPercentage: test.trend?.regressionPercentage?.toFixed(1),
      }));

      return {
        status: 'success',
        data: {
          benchmarks: report.slowTests.map((t) => ({
            name: t.testName,
            file: t.file,
            duration: t.duration,
            durationFormatted: `${(t.duration / 1000).toFixed(2)}s`,
          })),
          summary: {
            totalTests: report.totalTests,
            totalDuration: report.totalDuration,
            totalDurationFormatted: `${(report.totalDuration / 1000).toFixed(2)}s`,
            averageDuration: report.averageDuration,
            averageDurationFormatted: `${(report.averageDuration / 1000).toFixed(2)}s`,
            slowTests: report.slowTests.length,
            regressions: report.regressions.length,
          },
          slowTests: slowTestsWithSuggestions,
          fastestTests: report.fastestTests.map((t) => ({
            name: t.testName,
            file: t.file,
            duration: t.duration,
            durationFormatted: `${(t.duration / 1000).toFixed(2)}s`,
          })),
          slowestTests: report.slowestTests.map((t) => ({
            name: t.testName,
            file: t.file,
            duration: t.duration,
            durationFormatted: `${(t.duration / 1000).toFixed(2)}s`,
          })),
          regressions: regressionsFormatted,
          recommendation:
            report.slowTests.length === 0
              ? 'All tests are performing well!'
              : report.slowTests.length <= 3
                ? 'A few slow tests detected. Consider optimizing them.'
                : 'Many slow tests detected. Review optimization suggestions.',
        },
      };
    } catch (error) {
      throw new Error(
        `Performance benchmark failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleTestConfigureFramework(args: unknown) {
    const { framework, configPath } = args as {
      framework: TestFramework;
      configPath?: string;
    };

    try {
      const { FrameworkDetector } = await import('./components/FrameworkDetector');
      const detector = new FrameworkDetector();

      // Get current working directory as project path
      const projectPath = process.cwd();

      // Detect if framework is installed
      const detectedFrameworks = await detector.detectFrameworks(projectPath);
      const frameworkInfo = detectedFrameworks.find((f) => f.framework === framework);

      if (!frameworkInfo) {
        throw new Error(
          `Framework '${framework}' is not installed in the project. Please install it first.`
        );
      }

      // Validate framework version
      const validation = detector.validateFramework(framework, frameworkInfo.version);
      if (!validation.valid) {
        throw new Error(`Framework validation failed: ${validation.errors.join(', ')}`);
      }

      // Get framework configuration
      const config = await detector.getFrameworkConfig(framework, projectPath);

      // If custom config path provided, verify it exists
      let customConfigPath = configPath;
      if (configPath) {
        const fs = await import('fs/promises');
        const path = await import('path');
        const fullPath = path.join(projectPath, configPath);
        try {
          await fs.access(fullPath);
          customConfigPath = configPath;
        } catch {
          throw new Error(`Configuration file not found: ${configPath}`);
        }
      } else {
        customConfigPath = frameworkInfo.configFile;
      }

      return {
        status: 'success',
        data: {
          framework,
          version: frameworkInfo.version,
          configFile: customConfigPath || 'Using defaults (no config file found)',
          testDirectory: frameworkInfo.testDirectory,
          config: {
            testMatch: config.testMatch,
            testPathIgnorePatterns: config.testPathIgnorePatterns,
            coverageDirectory: config.coverageDirectory,
            coverageReporters: config.coverageReporters,
            timeout: config.timeout,
          },
          configuration: {
            testMatch: config.testMatch,
            testPathIgnorePatterns: config.testPathIgnorePatterns,
            coverageDirectory: config.coverageDirectory,
            coverageReporters: config.coverageReporters,
            timeout: config.timeout,
          },
          validation: {
            valid: validation.valid,
            warnings: validation.warnings,
          },
          message: `Framework '${framework}' configured successfully`,
        },
      };
    } catch (error) {
      throw new Error(
        `Framework configuration failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleTestGetConfig(args: unknown) {
    const { framework } = args as {
      framework: TestFramework;
    };

    try {
      const { FrameworkDetector } = await import('./components/FrameworkDetector');
      const detector = new FrameworkDetector();

      // Get current working directory as project path
      const projectPath = process.cwd();

      // Detect if framework is installed
      const detectedFrameworks = await detector.detectFrameworks(projectPath);
      const frameworkInfo = detectedFrameworks.find((f) => f.framework === framework);

      if (!frameworkInfo) {
        throw new Error(
          `Framework '${framework}' is not installed in the project. Available frameworks: ${detectedFrameworks.map((f) => f.framework).join(', ') || 'none'}`
        );
      }

      // Get framework configuration
      const config = await detector.getFrameworkConfig(framework, projectPath);

      // Get framework defaults for comparison
      const defaults = detector.getFrameworkDefaults(framework);

      return {
        status: 'success',
        data: {
          framework,
          version: frameworkInfo.version,
          configFile: frameworkInfo.configFile || null,
          testDirectory: frameworkInfo.testDirectory,
          config: {
            testMatch: config.testMatch,
            testPathIgnorePatterns: config.testPathIgnorePatterns,
            coverageDirectory: config.coverageDirectory,
            coverageReporters: config.coverageReporters,
            timeout: config.timeout,
            customConfig: config.customConfig,
          },
          defaults: {
            testMatch: defaults.testMatch,
            testPathIgnorePatterns: defaults.testPathIgnorePatterns,
            coverageDirectory: defaults.coverageDirectory,
            coverageReporters: defaults.coverageReporters,
            timeout: defaults.timeout,
          },
          usingDefaults: !frameworkInfo.configFile,
          message: frameworkInfo.configFile
            ? `Configuration loaded from ${frameworkInfo.configFile}`
            : 'Using default configuration (no config file found)',
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: 'CONFIGURATION_GET_FAILED',
          message: error instanceof Error ? error.message : String(error),
          remediation: this.getErrorRemediation('CONFIGURATION_GET_FAILED'),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async handleTestSetConfig(args: unknown) {
    const { framework, merge, ...configOptions } = args as {
      framework: TestFramework;
      merge?: boolean;
      [key: string]: unknown;
    };

    try {
      const { FrameworkDetector } = await import('./components/FrameworkDetector');
      const fs = await import('fs/promises');
      const path = await import('path');

      const detector = new FrameworkDetector();
      const projectPath = process.cwd();

      // Detect if framework is installed
      const detectedFrameworks = await detector.detectFrameworks(projectPath);
      const frameworkInfo = detectedFrameworks.find((f) => f.framework === framework);

      if (!frameworkInfo) {
        throw new Error(
          `Framework '${framework}' is not installed in the project. Please install it first.`
        );
      }

      // Get current configuration if merge is enabled
      let finalConfig: Record<string, unknown> = {};

      if (merge && frameworkInfo.configFile) {
        const currentConfig = await detector.getFrameworkConfig(framework, projectPath);
        finalConfig = { ...currentConfig.customConfig };
      } else if (!merge) {
        // If not merging, start with defaults
        const defaults = detector.getFrameworkDefaults(framework);
        finalConfig = {
          testMatch: defaults.testMatch,
          testPathIgnorePatterns: defaults.testPathIgnorePatterns,
          coverageDirectory: defaults.coverageDirectory,
          coverageReporters: defaults.coverageReporters,
          timeout: defaults.timeout,
        };
      }

      // Merge or replace with new config options
      // Remove framework and merge from configOptions
      const { framework: _, merge: __, ...newConfig } = configOptions;
      finalConfig = { ...finalConfig, ...newConfig };

      // Determine config file path
      let configFilePath: string;
      if (frameworkInfo.configFile) {
        configFilePath = path.join(projectPath, frameworkInfo.configFile);
      } else {
        // Create default config file based on framework
        const defaultConfigFiles: Record<TestFramework, string> = {
          [TestFramework.JEST]: 'jest.config.json',
          [TestFramework.MOCHA]: '.mocharc.json',
          [TestFramework.PYTEST]: 'pytest.ini',
          [TestFramework.VITEST]: 'vitest.config.json',
          [TestFramework.JASMINE]: 'jasmine.json',
          [TestFramework.AVA]: 'ava.config.json',
        };
        configFilePath = path.join(projectPath, defaultConfigFiles[framework]);
      }

      // Write configuration to file
      // For JSON config files
      if (configFilePath.endsWith('.json')) {
        await fs.writeFile(configFilePath, JSON.stringify(finalConfig, null, 2), 'utf-8');
      } else {
        // For other formats, we'll create a JSON file with a note
        // In production, this would handle different config formats properly
        const jsonConfigPath = configFilePath.replace(/\.[^.]+$/, '.json');
        await fs.writeFile(jsonConfigPath, JSON.stringify(finalConfig, null, 2), 'utf-8');
        configFilePath = jsonConfigPath;
      }

      // Reload configuration to verify
      const updatedConfig = await detector.getFrameworkConfig(framework, projectPath);

      return {
        status: 'success',
        data: {
          framework,
          configFile: path.relative(projectPath, configFilePath),
          merged: merge || false,
          configuration: {
            testMatch: updatedConfig.testMatch,
            testPathIgnorePatterns: updatedConfig.testPathIgnorePatterns,
            coverageDirectory: updatedConfig.coverageDirectory,
            coverageReporters: updatedConfig.coverageReporters,
            timeout: updatedConfig.timeout,
            customConfig: updatedConfig.customConfig,
          },
          message: merge
            ? `Configuration merged and saved to ${path.relative(projectPath, configFilePath)}`
            : `Configuration replaced and saved to ${path.relative(projectPath, configFilePath)}`,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: 'CONFIGURATION_SET_FAILED',
          message: error instanceof Error ? error.message : String(error),
          remediation: this.getErrorRemediation('CONFIGURATION_SET_FAILED'),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Testing Server running on stdio');
  }
}

/**
 * Main entry point
 */
export async function main(): Promise<void> {
  const server = new MCPTestingServer();
  await server.start();
}
