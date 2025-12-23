/**
 * TestGenerator component for generating tests from code analysis
 *
 * @packageDocumentation
 */

import * as ts from 'typescript';
import { TestFramework } from '../types';

/**
 * Filesystem operations interface for reading/writing files
 */
export interface FilesystemOperations {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
}

/**
 * Default filesystem operations using Node.js fs
 */
class DefaultFilesystemOperations implements FilesystemOperations {
  async readFile(path: string): Promise<string> {
    const fs = await import('fs/promises');
    return fs.readFile(path, 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(path, content, 'utf-8');
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Function information extracted from code
 */
export interface FunctionInfo {
  name: string;
  filePath: string;
  line: number;
  parameters: ParameterInfo[];
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
  documentation?: string;
}

/**
 * Parameter information
 */
export interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

/**
 * Generated test
 */
export interface GeneratedTest {
  name: string;
  code: string;
  framework: TestFramework;
  type: 'unit' | 'property' | 'integration';
  targetFunction: string;
  targetFile: string;
  description: string;
}

/**
 * Test suggestion
 */
export interface TestSuggestion {
  testCase: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  category: 'edge-case' | 'boundary' | 'error' | 'integration';
}

/**
 * Test fixture
 */
export interface TestFixture {
  name: string;
  code: string;
  description: string;
  dependencies: string[];
}

/**
 * Data schema for fixture generation
 */
export interface DataSchema {
  name: string;
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

/**
 * Schema property definition
 */
export interface SchemaProperty {
  type: string;
  description?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

/**
 * Generated test case information
 */
export interface GeneratedTestCase {
  name: string;
  description: string;
  assertions: number;
  coverage: string[];
}

/**
 * TestGenerator class for generating tests from code
 */
export class TestGenerator {
  private filesystem: FilesystemOperations;

  constructor(filesystem?: FilesystemOperations) {
    this.filesystem = filesystem || new DefaultFilesystemOperations();
  }

  /**
   * Generate tests for a function
   */
  async generateTests(functionInfo: FunctionInfo): Promise<GeneratedTest[]> {
    const tests: GeneratedTest[] = [];

    // Generate basic unit test
    tests.push(this.generateBasicUnitTest(functionInfo));

    // Generate edge case tests
    tests.push(...this.generateEdgeCaseTests(functionInfo));

    // Generate error handling tests
    tests.push(...this.generateErrorTests(functionInfo));

    return tests;
  }

  /**
   * Generate tests from code file
   */
  async generateTestsFromCode(filePath: string): Promise<GeneratedTest[]> {
    // Read the file using filesystem operations
    const fileExists = await this.filesystem.fileExists(filePath);
    if (!fileExists) {
      throw new Error(`File not found: ${filePath}`);
    }

    const sourceCode = await this.filesystem.readFile(filePath);

    // Analyze functions in the source code
    const functions = await this.analyzeFunctionsFromSource(sourceCode, filePath);
    const allTests: GeneratedTest[] = [];

    for (const func of functions) {
      const tests = await this.generateTests(func);
      allTests.push(...tests);
    }

    return allTests;
  }

  /**
   * Write generated tests to a file
   */
  async writeGeneratedTests(tests: GeneratedTest[], outputPath: string): Promise<void> {
    // Combine all test code
    const combinedCode = tests.map((test) => test.code).join('\n\n');

    // Write to file using filesystem operations
    await this.filesystem.writeFile(outputPath, combinedCode);
  }

  /**
   * Generate test fixtures
   */
  async generateFixtures(dataSchema: DataSchema): Promise<TestFixture[]> {
    const fixtures: TestFixture[] = [];

    // Generate valid data fixture
    fixtures.push(this.generateValidDataFixture(dataSchema));

    // Generate invalid data fixtures
    fixtures.push(...this.generateInvalidDataFixtures(dataSchema));

    // Generate edge case fixtures
    fixtures.push(...this.generateEdgeCaseFixtures(dataSchema));

    return fixtures;
  }

  /**
   * Suggest additional test cases
   */
  async suggestTestCases(existingTests: GeneratedTestCase[]): Promise<TestSuggestion[]> {
    const suggestions: TestSuggestion[] = [];

    // Analyze coverage gaps
    const coverageGaps = this.analyzeCoverageGaps(existingTests);
    suggestions.push(...this.suggestionsFromGaps(coverageGaps));

    // Suggest boundary tests
    suggestions.push(...this.suggestBoundaryTests(existingTests));

    // Suggest error handling tests
    suggestions.push(...this.suggestErrorHandlingTests(existingTests));

    // Suggest integration tests
    suggestions.push(...this.suggestIntegrationTests(existingTests));

    return suggestions;
  }

  /**
   * Analyze functions in source code
   */
  private async analyzeFunctionsFromSource(
    sourceCode: string,
    filePath: string
  ): Promise<FunctionInfo[]> {
    const functions: FunctionInfo[] = [];

    // Parse TypeScript source code
    const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);

    // Visit all nodes in the AST
    const visit = (node: ts.Node) => {
      // Check if node is a function declaration
      if (ts.isFunctionDeclaration(node) && node.name) {
        const functionInfo = this.extractFunctionInfo(node, filePath, sourceFile);
        if (functionInfo) {
          functions.push(functionInfo);
        }
      }

      // Check if node is an arrow function or function expression assigned to a variable
      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (
            declaration.initializer &&
            (ts.isArrowFunction(declaration.initializer) ||
              ts.isFunctionExpression(declaration.initializer))
          ) {
            const functionInfo = this.extractFunctionInfoFromVariable(
              declaration,
              filePath,
              sourceFile
            );
            if (functionInfo) {
              functions.push(functionInfo);
            }
          }
        }
      }

      // Recursively visit child nodes
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return functions;
  }

  /**
   * Extract function information from a function declaration node
   */
  private extractFunctionInfo(
    node: ts.FunctionDeclaration,
    filePath: string,
    sourceFile: ts.SourceFile
  ): FunctionInfo | null {
    if (!node.name) {
      return null;
    }

    const name = node.name.text;
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const parameters = this.extractParameters(node);
    const returnType = this.extractReturnType(node);
    const isAsync = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) || false;
    const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) || false;

    return {
      name,
      filePath,
      line,
      parameters,
      returnType,
      isAsync,
      isExported,
    };
  }

  /**
   * Extract function information from a variable declaration
   */
  private extractFunctionInfoFromVariable(
    declaration: ts.VariableDeclaration,
    filePath: string,
    sourceFile: ts.SourceFile
  ): FunctionInfo | null {
    if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
      return null;
    }

    const name = declaration.name.text;
    const line = sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1;

    const functionNode = declaration.initializer as ts.ArrowFunction | ts.FunctionExpression;
    const parameters = this.extractParameters(functionNode);
    const returnType = this.extractReturnType(functionNode);
    const isAsync =
      functionNode.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) || false;

    // Check if parent is exported
    const parent = declaration.parent?.parent;
    const isExported =
      (parent &&
        ts.isVariableStatement(parent) &&
        parent.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) ||
      false;

    return {
      name,
      filePath,
      line,
      parameters,
      returnType,
      isAsync,
      isExported,
    };
  }

  /**
   * Extract parameters from a function node
   */
  private extractParameters(
    node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression
  ): ParameterInfo[] {
    return node.parameters.map((param) => {
      const name = param.name.getText();
      const type = param.type ? param.type.getText() : 'any';
      const optional = param.questionToken !== undefined;
      const defaultValue = param.initializer ? param.initializer.getText() : undefined;

      return {
        name,
        type,
        optional,
        defaultValue,
      };
    });
  }

  /**
   * Extract return type from a function node
   */
  private extractReturnType(
    node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression
  ): string {
    if (node.type) {
      return node.type.getText();
    }

    // Try to infer from async modifier
    if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
      return 'Promise<any>';
    }

    return 'any';
  }

  /**
   * Generate basic unit test
   */
  private generateBasicUnitTest(functionInfo: FunctionInfo): GeneratedTest {
    const testName = `should ${this.inferTestName(functionInfo)}`;
    const code = this.generateTestCode(functionInfo, 'basic');

    return {
      name: testName,
      code,
      framework: TestFramework.JEST,
      type: 'unit',
      targetFunction: functionInfo.name,
      targetFile: functionInfo.filePath,
      description: `Basic unit test for ${functionInfo.name}`,
    };
  }

  /**
   * Generate edge case tests
   */
  private generateEdgeCaseTests(functionInfo: FunctionInfo): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const edgeCases = this.identifyEdgeCases(functionInfo);

    for (const edgeCase of edgeCases) {
      tests.push({
        name: `should handle ${edgeCase.name}`,
        code: this.generateTestCode(functionInfo, 'edge-case', edgeCase),
        framework: TestFramework.JEST,
        type: 'unit',
        targetFunction: functionInfo.name,
        targetFile: functionInfo.filePath,
        description: `Edge case test: ${edgeCase.description}`,
      });
    }

    return tests;
  }

  /**
   * Generate error handling tests
   */
  private generateErrorTests(functionInfo: FunctionInfo): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const errorScenarios = this.identifyErrorScenarios(functionInfo);

    for (const scenario of errorScenarios) {
      tests.push({
        name: `should throw error when ${scenario.name}`,
        code: this.generateTestCode(functionInfo, 'error', scenario),
        framework: TestFramework.JEST,
        type: 'unit',
        targetFunction: functionInfo.name,
        targetFile: functionInfo.filePath,
        description: `Error handling test: ${scenario.description}`,
      });
    }

    return tests;
  }

  /**
   * Identify edge cases for a function
   */
  private identifyEdgeCases(
    functionInfo: FunctionInfo
  ): Array<{ name: string; description: string; input: unknown }> {
    const edgeCases: Array<{ name: string; description: string; input: unknown }> = [];

    for (const param of functionInfo.parameters) {
      // Identify edge cases based on parameter type
      if (param.type.includes('string')) {
        edgeCases.push({
          name: 'empty string',
          description: `Empty string for parameter ${param.name}`,
          input: '',
        });
        edgeCases.push({
          name: 'whitespace string',
          description: `Whitespace-only string for parameter ${param.name}`,
          input: '   ',
        });
      }

      if (param.type.includes('number')) {
        edgeCases.push({
          name: 'zero',
          description: `Zero value for parameter ${param.name}`,
          input: 0,
        });
        edgeCases.push({
          name: 'negative number',
          description: `Negative value for parameter ${param.name}`,
          input: -1,
        });
      }

      if (param.type.includes('[]') || param.type.includes('Array')) {
        edgeCases.push({
          name: 'empty array',
          description: `Empty array for parameter ${param.name}`,
          input: [],
        });
      }

      if (param.optional) {
        edgeCases.push({
          name: 'undefined optional parameter',
          description: `Undefined value for optional parameter ${param.name}`,
          input: undefined,
        });
      }
    }

    return edgeCases;
  }

  /**
   * Identify error scenarios for a function
   */
  private identifyErrorScenarios(
    functionInfo: FunctionInfo
  ): Array<{ name: string; description: string; input: unknown }> {
    const scenarios: Array<{ name: string; description: string; input: unknown }> = [];

    for (const param of functionInfo.parameters) {
      if (!param.optional) {
        scenarios.push({
          name: `${param.name} is null`,
          description: `Null value for required parameter ${param.name}`,
          input: null,
        });
        scenarios.push({
          name: `${param.name} is undefined`,
          description: `Undefined value for required parameter ${param.name}`,
          input: undefined,
        });
      }

      // Type-specific error scenarios
      if (param.type.includes('number')) {
        scenarios.push({
          name: `${param.name} is NaN`,
          description: `NaN value for number parameter ${param.name}`,
          input: NaN,
        });
      }
    }

    return scenarios;
  }

  /**
   * Generate test code
   */
  private generateTestCode(
    functionInfo: FunctionInfo,
    testType: 'basic' | 'edge-case' | 'error',
    scenario?: { name: string; description: string; input: unknown }
  ): string {
    const importPath = this.getImportPath(functionInfo.filePath);
    const functionCall = this.generateFunctionCall(functionInfo, scenario);

    let code = `import { ${functionInfo.name} } from '${importPath}';\n\n`;

    if (testType === 'basic') {
      code += `describe('${functionInfo.name}', () => {\n`;
      code += `  it('should ${this.inferTestName(functionInfo)}', ${functionInfo.isAsync ? 'async ' : ''}() => {\n`;
      code += `    // Arrange\n`;
      code += `    const input = ${this.generateSampleInput(functionInfo)};\n\n`;
      code += `    // Act\n`;
      code += `    const result = ${functionInfo.isAsync ? 'await ' : ''}${functionCall};\n\n`;
      code += `    // Assert\n`;
      code += `    expect(result).toBeDefined();\n`;
      code += `  });\n`;
      code += `});\n`;
    } else if (testType === 'edge-case') {
      code += `describe('${functionInfo.name}', () => {\n`;
      code += `  it('should handle ${scenario?.name}', ${functionInfo.isAsync ? 'async ' : ''}() => {\n`;
      code += `    // Arrange\n`;
      code += `    const input = ${JSON.stringify(scenario?.input)};\n\n`;
      code += `    // Act\n`;
      code += `    const result = ${functionInfo.isAsync ? 'await ' : ''}${functionCall};\n\n`;
      code += `    // Assert\n`;
      code += `    expect(result).toBeDefined();\n`;
      code += `  });\n`;
      code += `});\n`;
    } else if (testType === 'error') {
      code += `describe('${functionInfo.name}', () => {\n`;
      code += `  it('should throw error when ${scenario?.name}', ${functionInfo.isAsync ? 'async ' : ''}() => {\n`;
      code += `    // Arrange\n`;
      code += `    const input = ${JSON.stringify(scenario?.input)};\n\n`;
      code += `    // Act & Assert\n`;
      if (functionInfo.isAsync) {
        code += `    await expect(${functionCall}).rejects.toThrow();\n`;
      } else {
        code += `    expect(() => ${functionCall}).toThrow();\n`;
      }
      code += `  });\n`;
      code += `});\n`;
    }

    return code;
  }

  /**
   * Infer test name from function info
   */
  private inferTestName(functionInfo: FunctionInfo): string {
    // Convert camelCase to readable text
    const name = functionInfo.name
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .trim();
    return name;
  }

  /**
   * Get import path for a file
   */
  private getImportPath(filePath: string): string {
    // Convert absolute path to relative import
    return filePath.replace(/\.ts$/, '');
  }

  /**
   * Generate function call with parameters
   */
  private generateFunctionCall(functionInfo: FunctionInfo, scenario?: { input: unknown }): string {
    if (scenario) {
      return `${functionInfo.name}(input)`;
    }

    const params = functionInfo.parameters.map((p) => p.name).join(', ');
    return `${functionInfo.name}(${params})`;
  }

  /**
   * Generate sample input for function
   */
  private generateSampleInput(functionInfo: FunctionInfo): string {
    // Generate sample values based on parameter types
    const samples: string[] = [];

    for (const param of functionInfo.parameters) {
      if (param.type.includes('string')) {
        samples.push(`'test'`);
      } else if (param.type.includes('number')) {
        samples.push('42');
      } else if (param.type.includes('boolean')) {
        samples.push('true');
      } else if (param.type.includes('[]')) {
        samples.push('[]');
      } else {
        samples.push('{}');
      }
    }

    return samples.length === 1
      ? samples[0]
      : `{ ${functionInfo.parameters.map((p, i) => `${p.name}: ${samples[i]}`).join(', ')} }`;
  }

  /**
   * Generate valid data fixture
   */
  private generateValidDataFixture(dataSchema: DataSchema): TestFixture {
    const code = this.generateFixtureCode(dataSchema, 'valid');

    return {
      name: `valid${dataSchema.name}`,
      code,
      description: `Valid ${dataSchema.name} fixture`,
      dependencies: [],
    };
  }

  /**
   * Generate invalid data fixtures
   */
  private generateInvalidDataFixtures(dataSchema: DataSchema): TestFixture[] {
    const fixtures: TestFixture[] = [];

    // Missing required fields
    if (dataSchema.required && dataSchema.required.length > 0) {
      for (const requiredField of dataSchema.required) {
        fixtures.push({
          name: `invalid${dataSchema.name}Missing${this.capitalize(requiredField)}`,
          code: this.generateFixtureCode(dataSchema, 'missing-field', requiredField),
          description: `Invalid ${dataSchema.name} with missing ${requiredField}`,
          dependencies: [],
        });
      }
    }

    // Invalid types
    for (const [propName, propSchema] of Object.entries(dataSchema.properties)) {
      fixtures.push({
        name: `invalid${dataSchema.name}Wrong${this.capitalize(propName)}Type`,
        code: this.generateFixtureCode(dataSchema, 'wrong-type', propName),
        description: `Invalid ${dataSchema.name} with wrong type for ${propName}`,
        dependencies: [],
      });
    }

    return fixtures;
  }

  /**
   * Generate edge case fixtures
   */
  private generateEdgeCaseFixtures(dataSchema: DataSchema): TestFixture[] {
    const fixtures: TestFixture[] = [];

    for (const [propName, propSchema] of Object.entries(dataSchema.properties)) {
      if (propSchema.type === 'string') {
        fixtures.push({
          name: `${dataSchema.name}WithEmpty${this.capitalize(propName)}`,
          code: this.generateFixtureCode(dataSchema, 'empty-string', propName),
          description: `${dataSchema.name} with empty ${propName}`,
          dependencies: [],
        });
      }

      if (propSchema.type === 'number') {
        if (propSchema.minimum !== undefined) {
          fixtures.push({
            name: `${dataSchema.name}WithMin${this.capitalize(propName)}`,
            code: this.generateFixtureCode(dataSchema, 'min-value', propName),
            description: `${dataSchema.name} with minimum ${propName}`,
            dependencies: [],
          });
        }

        if (propSchema.maximum !== undefined) {
          fixtures.push({
            name: `${dataSchema.name}WithMax${this.capitalize(propName)}`,
            code: this.generateFixtureCode(dataSchema, 'max-value', propName),
            description: `${dataSchema.name} with maximum ${propName}`,
            dependencies: [],
          });
        }
      }
    }

    return fixtures;
  }

  /**
   * Generate fixture code
   */
  private generateFixtureCode(
    dataSchema: DataSchema,
    variant: string,
    targetField?: string
  ): string {
    let code = `export const fixture = {\n`;

    for (const [propName, propSchema] of Object.entries(dataSchema.properties)) {
      if (variant === 'missing-field' && propName === targetField) {
        continue; // Skip this field
      }

      let value: string;

      if (variant === 'wrong-type' && propName === targetField) {
        value = propSchema.type === 'string' ? '123' : '"wrong"';
      } else if (variant === 'empty-string' && propName === targetField) {
        value = '""';
      } else if (
        variant === 'min-value' &&
        propName === targetField &&
        propSchema.minimum !== undefined
      ) {
        value = String(propSchema.minimum);
      } else if (
        variant === 'max-value' &&
        propName === targetField &&
        propSchema.maximum !== undefined
      ) {
        value = String(propSchema.maximum);
      } else {
        value = this.generateSampleValue(propSchema);
      }

      code += `  ${propName}: ${value},\n`;
    }

    code += `};\n`;
    return code;
  }

  /**
   * Generate sample value for schema property
   */
  private generateSampleValue(propSchema: SchemaProperty): string {
    if (propSchema.enum && propSchema.enum.length > 0) {
      return JSON.stringify(propSchema.enum[0]);
    }

    switch (propSchema.type) {
      case 'string':
        return propSchema.pattern ? `'test-${Date.now()}'` : "'test'";
      case 'number':
        return propSchema.minimum !== undefined ? String(propSchema.minimum + 1) : '42';
      case 'boolean':
        return 'true';
      case 'array':
        return '[]';
      case 'object':
        return '{}';
      default:
        return 'null';
    }
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Analyze coverage gaps
   */
  private analyzeCoverageGaps(existingTests: GeneratedTestCase[]): string[] {
    const gaps: string[] = [];
    const coveredAreas = new Set<string>();

    for (const test of existingTests) {
      test.coverage.forEach((area) => coveredAreas.add(area));
    }

    // Identify common areas that might be missing
    const commonAreas = [
      'error-handling',
      'edge-cases',
      'boundary-conditions',
      'integration',
      'performance',
    ];

    for (const area of commonAreas) {
      if (!coveredAreas.has(area)) {
        gaps.push(area);
      }
    }

    return gaps;
  }

  /**
   * Generate suggestions from coverage gaps
   */
  private suggestionsFromGaps(gaps: string[]): TestSuggestion[] {
    return gaps.map((gap) => ({
      testCase: `Add tests for ${gap}`,
      reason: `No existing tests cover ${gap}`,
      priority: 'high' as const,
      category: this.categorizeGap(gap),
    }));
  }

  /**
   * Categorize coverage gap
   */
  private categorizeGap(gap: string): 'edge-case' | 'boundary' | 'error' | 'integration' {
    if (gap.includes('edge')) return 'edge-case';
    if (gap.includes('boundary')) return 'boundary';
    if (gap.includes('error')) return 'error';
    return 'integration';
  }

  /**
   * Suggest boundary tests
   */
  private suggestBoundaryTests(existingTests: GeneratedTestCase[]): TestSuggestion[] {
    const suggestions: TestSuggestion[] = [];

    // Check if boundary tests exist
    const hasBoundaryTests = existingTests.some(
      (test) =>
        test.name.toLowerCase().includes('boundary') || test.name.toLowerCase().includes('limit')
    );

    if (!hasBoundaryTests) {
      suggestions.push({
        testCase: 'Test with minimum valid input',
        reason: 'No boundary tests found for minimum values',
        priority: 'high',
        category: 'boundary',
      });

      suggestions.push({
        testCase: 'Test with maximum valid input',
        reason: 'No boundary tests found for maximum values',
        priority: 'high',
        category: 'boundary',
      });
    }

    return suggestions;
  }

  /**
   * Suggest error handling tests
   */
  private suggestErrorHandlingTests(existingTests: GeneratedTestCase[]): TestSuggestion[] {
    const suggestions: TestSuggestion[] = [];

    const hasErrorTests = existingTests.some(
      (test) =>
        test.name.toLowerCase().includes('error') || test.name.toLowerCase().includes('throw')
    );

    if (!hasErrorTests) {
      suggestions.push({
        testCase: 'Test with invalid input',
        reason: 'No error handling tests found',
        priority: 'high',
        category: 'error',
      });

      suggestions.push({
        testCase: 'Test with null/undefined input',
        reason: 'No null/undefined handling tests found',
        priority: 'high',
        category: 'error',
      });
    }

    return suggestions;
  }

  /**
   * Suggest integration tests
   */
  private suggestIntegrationTests(existingTests: GeneratedTestCase[]): TestSuggestion[] {
    const suggestions: TestSuggestion[] = [];

    const hasIntegrationTests = existingTests.some(
      (test) =>
        test.name.toLowerCase().includes('integration') ||
        test.description.toLowerCase().includes('integration')
    );

    if (!hasIntegrationTests && existingTests.length > 5) {
      suggestions.push({
        testCase: 'Add integration test for complete workflow',
        reason: 'No integration tests found despite having multiple unit tests',
        priority: 'medium',
        category: 'integration',
      });
    }

    return suggestions;
  }
}
