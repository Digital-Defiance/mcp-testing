/**
 * MutationTester component
 *
 * Performs mutation testing to verify test suite effectiveness.
 * Generates code mutations, executes tests against each mutation,
 * tracks killed vs survived mutations, and calculates mutation score.
 *
 * @packageDocumentation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  TestFramework,
  TestResult,
  TestStatus,
  Mutation,
  MutationType,
  MutationResult,
  MutationReport,
  MutationTestOptions,
  TestRunOptions,
} from '../types';
import { TestRunnerManager } from './TestRunnerManager';

/**
 * Mutation operator definition
 */
interface MutationOperator {
  type: MutationType;
  pattern: RegExp;
  replacements: (match: string) => string[];
  description: (original: string, mutated: string) => string;
}

/**
 * MutationTester class
 *
 * Generates and tests code mutations to verify test suite effectiveness
 */
export class MutationTester {
  private testRunnerManager: TestRunnerManager;
  private mutationOperators: MutationOperator[];

  constructor(testRunnerManager?: TestRunnerManager) {
    this.testRunnerManager = testRunnerManager || new TestRunnerManager();
    this.mutationOperators = this.initializeMutationOperators();
  }

  /**
   * Run mutation testing
   *
   * @param options - Mutation test options
   * @returns Promise resolving to mutation report
   */
  async runMutationTesting(options: MutationTestOptions): Promise<MutationReport> {
    const startTime = Date.now();

    // Generate mutations
    const mutations = await this.generateMutations(options.filePath || '');

    // Filter mutations by type if specified
    const filteredMutations = options.mutationTypes
      ? mutations.filter((m) => options.mutationTypes!.includes(m.mutationType))
      : mutations;

    // Test each mutation
    const mutationResults: MutationResult[] = [];
    for (const mutation of filteredMutations) {
      const result = await this.testMutation(mutation, options);
      mutationResults.push(result);
    }

    // Calculate mutation score
    const killedMutations = mutationResults.filter((r) => r.killed).length;
    const mutationScore = this.calculateMutationScore(mutationResults);

    const report: MutationReport = {
      totalMutations: mutationResults.length,
      killedMutations,
      survivedMutations: mutationResults.length - killedMutations,
      mutationScore,
      mutations: mutationResults,
      timestamp: new Date().toISOString(),
    };

    return report;
  }

  /**
   * Generate mutations from a code file
   *
   * @param filePath - Path to the file to mutate
   * @returns Promise resolving to array of mutations
   */
  async generateMutations(filePath: string): Promise<Mutation[]> {
    if (!filePath) {
      return [];
    }

    try {
      // Read the file content
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const mutations: Mutation[] = [];
      let mutationId = 0;

      // Apply each mutation operator to each line
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];

        for (const operator of this.mutationOperators) {
          const matches = line.matchAll(operator.pattern);

          for (const match of matches) {
            if (!match.index) continue;

            const original = match[0];
            const replacements = operator.replacements(original);

            for (const mutated of replacements) {
              if (mutated === original) continue;

              mutations.push({
                id: `mutation-${mutationId++}`,
                file: filePath,
                line: lineIndex + 1,
                column: match.index,
                mutationType: operator.type,
                original,
                mutated,
                description: operator.description(original, mutated),
              });
            }
          }
        }
      }

      return mutations;
    } catch (error) {
      console.error(`Failed to generate mutations for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Test a single mutation
   *
   * @param mutation - Mutation to test
   * @param options - Mutation test options
   * @returns Promise resolving to mutation result
   */
  async testMutation(mutation: Mutation, options: MutationTestOptions): Promise<MutationResult> {
    const startTime = Date.now();

    try {
      // Apply the mutation
      await this.applyMutation(mutation);

      // Run the test suite
      const runOptions: TestRunOptions = {
        framework: options.framework,
        testPath: options.testPath,
        pattern: options.pattern,
        timeout: options.timeout,
      };

      const testResults = await this.testRunnerManager.runTests(runOptions);

      // Check if mutation was killed (at least one test failed)
      const failedTests = testResults.filter((r) => r.status === TestStatus.FAILED);
      const killed = failedTests.length > 0;
      const killedBy = failedTests.map((r) => r.fullName);

      // Revert the mutation
      await this.revertMutation(mutation);

      const duration = Date.now() - startTime;

      return {
        id: mutation.id,
        file: mutation.file,
        line: mutation.line,
        mutationType: mutation.mutationType,
        original: mutation.original,
        mutated: mutation.mutated,
        killed,
        killedBy,
        duration,
      };
    } catch (error) {
      // Revert the mutation in case of error
      await this.revertMutation(mutation);

      // If test execution failed, consider mutation killed
      const duration = Date.now() - startTime;
      return {
        id: mutation.id,
        file: mutation.file,
        line: mutation.line,
        mutationType: mutation.mutationType,
        original: mutation.original,
        mutated: mutation.mutated,
        killed: true,
        killedBy: ['test-execution-error'],
        duration,
      };
    }
  }

  /**
   * Calculate mutation score
   *
   * @param results - Array of mutation results
   * @returns Mutation score as percentage (0-100)
   */
  calculateMutationScore(results: MutationResult[]): number {
    if (results.length === 0) {
      return 0;
    }

    const killedCount = results.filter((r) => r.killed).length;
    return (killedCount / results.length) * 100;
  }

  /**
   * Apply a mutation to the source file
   *
   * @param mutation - Mutation to apply
   */
  private async applyMutation(mutation: Mutation): Promise<void> {
    try {
      // Read the file
      const content = await fs.readFile(mutation.file, 'utf-8');
      const lines = content.split('\n');

      // Apply the mutation to the specific line
      const lineIndex = mutation.line - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        const before = line.substring(0, mutation.column);
        const after = line.substring(mutation.column + mutation.original.length);
        lines[lineIndex] = before + mutation.mutated + after;

        // Write the mutated content back
        const mutatedContent = lines.join('\n');
        await fs.writeFile(mutation.file, mutatedContent, 'utf-8');
      }
    } catch (error) {
      console.error(`Failed to apply mutation ${mutation.id}:`, error);
      throw error;
    }
  }

  /**
   * Revert a mutation from the source file
   *
   * @param mutation - Mutation to revert
   */
  private async revertMutation(mutation: Mutation): Promise<void> {
    try {
      // Read the file
      const content = await fs.readFile(mutation.file, 'utf-8');
      const lines = content.split('\n');

      // Revert the mutation on the specific line
      const lineIndex = mutation.line - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        const before = line.substring(0, mutation.column);
        const after = line.substring(mutation.column + mutation.mutated.length);
        lines[lineIndex] = before + mutation.original + after;

        // Write the original content back
        const originalContent = lines.join('\n');
        await fs.writeFile(mutation.file, originalContent, 'utf-8');
      }
    } catch (error) {
      console.error(`Failed to revert mutation ${mutation.id}:`, error);
      throw error;
    }
  }

  /**
   * Initialize mutation operators
   *
   * @returns Array of mutation operators
   */
  private initializeMutationOperators(): MutationOperator[] {
    return [
      // Arithmetic operators
      {
        type: MutationType.ARITHMETIC_OPERATOR,
        pattern: /(\+|-|\*|\/|%)/g,
        replacements: (match) => {
          const operators = ['+', '-', '*', '/', '%'];
          return operators.filter((op) => op !== match);
        },
        description: (original, mutated) =>
          `Replace arithmetic operator ${original} with ${mutated}`,
      },

      // Relational operators
      {
        type: MutationType.RELATIONAL_OPERATOR,
        pattern: /(===|!==|==|!=|<=|>=|<|>)/g,
        replacements: (match) => {
          const operators = ['===', '!==', '==', '!=', '<=', '>=', '<', '>'];
          return operators.filter((op) => op !== match);
        },
        description: (original, mutated) =>
          `Replace relational operator ${original} with ${mutated}`,
      },

      // Logical operators
      {
        type: MutationType.LOGICAL_OPERATOR,
        pattern: /(&&|\|\|)/g,
        replacements: (match) => {
          return match === '&&' ? ['||'] : ['&&'];
        },
        description: (original, mutated) => `Replace logical operator ${original} with ${mutated}`,
      },

      // Unary operators
      {
        type: MutationType.UNARY_OPERATOR,
        pattern: /(!(?!=))/g,
        replacements: () => [''],
        description: (original, mutated) => `Remove unary operator ${original}`,
      },

      // Assignment operators
      {
        type: MutationType.ASSIGNMENT_OPERATOR,
        pattern: /(\+=|-=|\*=|\/=|%=)/g,
        replacements: (match) => {
          const operators = ['+=', '-=', '*=', '/=', '%='];
          return operators.filter((op) => op !== match);
        },
        description: (original, mutated) =>
          `Replace assignment operator ${original} with ${mutated}`,
      },

      // Return values (true/false)
      {
        type: MutationType.RETURN_VALUE,
        pattern: /\b(true|false)\b/g,
        replacements: (match) => {
          return match === 'true' ? ['false'] : ['true'];
        },
        description: (original, mutated) => `Replace ${original} with ${mutated}`,
      },

      // Numeric literals (increment/decrement by 1)
      {
        type: MutationType.LITERAL,
        pattern: /\b(\d+)\b/g,
        replacements: (match) => {
          const num = parseInt(match, 10);
          return [(num + 1).toString(), (num - 1).toString()];
        },
        description: (original, mutated) => `Replace literal ${original} with ${mutated}`,
      },

      // String literals (empty string)
      {
        type: MutationType.LITERAL,
        pattern: /(['"`])(?:(?=(\\?))\2.)*?\1/g,
        replacements: (match) => {
          const quote = match[0];
          return match.length > 2 ? [`${quote}${quote}`] : [];
        },
        description: (original, mutated) => `Replace string ${original} with empty string`,
      },
    ];
  }
}
