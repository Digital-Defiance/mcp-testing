/**
 * Integration with mcp-debugger-server
 *
 * @packageDocumentation
 */

import {
  DebuggerOperations,
  DebugSession,
  DebugSessionOptions,
  StackFrame,
} from './DebugIntegration';

/**
 * MCP Debugger Server client interface
 */
export interface MCPDebuggerClient {
  callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
  isConnected(): boolean;
}

/**
 * Debugger server integration implementation
 */
export class DebuggerServerIntegration implements DebuggerOperations {
  private client: MCPDebuggerClient;
  private sessions: Map<string, DebugSession>;

  constructor(client: MCPDebuggerClient) {
    this.client = client;
    this.sessions = new Map();
  }

  /**
   * Start debug session using mcp-debugger-server
   */
  async startDebugSession(options: DebugSessionOptions): Promise<DebugSession> {
    if (!this.client.isConnected()) {
      throw new Error('MCP Debugger Server is not connected');
    }

    try {
      // Call debugger_start tool from mcp-debugger-server
      const result = await this.client.callTool('debugger_start', {
        file: options.file,
        line: options.line,
        column: options.column || 0,
        breakOnEntry: options.breakOnFailure,
        testContext: {
          testName: options.testName,
          captureVariables: options.captureVariables || [],
        },
      });

      // Parse response from debugger server
      const debuggerResponse = result as {
        sessionId: string;
        status: string;
      };

      const session: DebugSession = {
        id: debuggerResponse.sessionId,
        file: options.file,
        line: options.line,
        column: options.column,
        testName: options.testName,
        status: this.mapDebuggerStatus(debuggerResponse.status),
        startTime: new Date().toISOString(),
      };

      this.sessions.set(session.id, session);
      return session;
    } catch (error) {
      throw new Error(
        `Failed to start debug session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Stop debug session
   */
  async stopDebugSession(sessionId: string): Promise<void> {
    if (!this.client.isConnected()) {
      throw new Error('MCP Debugger Server is not connected');
    }

    try {
      await this.client.callTool('debugger_stop', {
        sessionId,
      });

      const session = this.sessions.get(sessionId);
      if (session) {
        session.status = 'stopped';
      }
    } catch (error) {
      throw new Error(
        `Failed to stop debug session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get variable values from debug session
   */
  async getVariableValues(
    sessionId: string,
    variableNames: string[]
  ): Promise<Record<string, unknown>> {
    if (!this.client.isConnected()) {
      throw new Error('MCP Debugger Server is not connected');
    }

    try {
      const result = await this.client.callTool('debugger_get_variables', {
        sessionId,
        variableNames: variableNames.length > 0 ? variableNames : undefined,
      });

      return (result as { variables: Record<string, unknown> }).variables;
    } catch (error) {
      throw new Error(
        `Failed to get variable values: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get call stack from debug session
   */
  async getCallStack(sessionId: string): Promise<StackFrame[]> {
    if (!this.client.isConnected()) {
      throw new Error('MCP Debugger Server is not connected');
    }

    try {
      const result = await this.client.callTool('debugger_get_stack', {
        sessionId,
      });

      const stackFrames = (result as { stack: unknown[] }).stack;

      return stackFrames.map((frame: any) => ({
        file: frame.file || '',
        line: frame.line || 0,
        column: frame.column || 0,
        functionName: frame.functionName || frame.function || 'anonymous',
        source: frame.source,
      }));
    } catch (error) {
      throw new Error(
        `Failed to get call stack: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Evaluate expression in debug session
   */
  async evaluateExpression(sessionId: string, expression: string): Promise<unknown> {
    if (!this.client.isConnected()) {
      throw new Error('MCP Debugger Server is not connected');
    }

    try {
      const result = await this.client.callTool('debugger_evaluate', {
        sessionId,
        expression,
      });

      return (result as { value: unknown }).value;
    } catch (error) {
      throw new Error(
        `Failed to evaluate expression: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Map debugger server status to session status
   */
  private mapDebuggerStatus(status: string): 'active' | 'paused' | 'stopped' {
    switch (status.toLowerCase()) {
      case 'running':
      case 'active':
        return 'active';
      case 'paused':
      case 'breakpoint':
        return 'paused';
      case 'stopped':
      case 'terminated':
        return 'stopped';
      default:
        return 'active';
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): DebugSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status !== 'stopped');
  }
}
