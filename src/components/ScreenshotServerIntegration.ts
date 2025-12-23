/**
 * ScreenshotServerIntegration component for integrating with mcp-screenshot
 *
 * @packageDocumentation
 */

import {
  ScreenshotOperations,
  ScreenshotCaptureOptions,
  ScreenshotResult,
} from './VisualRegressionTester';

/**
 * MCP Screenshot tool call interface
 */
export interface MCPScreenshotClient {
  callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
}

/**
 * Screenshot server integration options
 */
export interface ScreenshotServerOptions {
  client: MCPScreenshotClient;
  defaultFormat?: 'png' | 'jpeg' | 'webp';
  defaultQuality?: number;
  savePath?: string;
}

/**
 * ScreenshotServerIntegration class for integrating with mcp-screenshot
 */
export class ScreenshotServerIntegration implements ScreenshotOperations {
  private client: MCPScreenshotClient;
  private defaultFormat: 'png' | 'jpeg' | 'webp';
  private defaultQuality: number;
  private savePath?: string;

  constructor(options: ScreenshotServerOptions) {
    this.client = options.client;
    this.defaultFormat = options.defaultFormat || 'png';
    this.defaultQuality = options.defaultQuality || 90;
    this.savePath = options.savePath;
  }

  /**
   * Capture screenshot using mcp-screenshot
   */
  async captureScreenshot(options: ScreenshotCaptureOptions): Promise<ScreenshotResult> {
    try {
      // Determine capture type based on options
      if (options.region) {
        return await this.captureRegion(options);
      } else if (options.windowTitle) {
        return await this.captureWindow(options);
      } else {
        return await this.captureFullScreen(options);
      }
    } catch (error) {
      throw new Error(
        `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Capture full screen screenshot
   */
  private async captureFullScreen(options: ScreenshotCaptureOptions): Promise<ScreenshotResult> {
    const args: Record<string, unknown> = {
      format: options.format || this.defaultFormat,
      quality: options.quality || this.defaultQuality,
    };

    if (this.savePath) {
      args['savePath'] = this.savePath;
    }

    const response = await this.client.callTool('screenshot_capture', args);

    return this.parseScreenshotResponse(response);
  }

  /**
   * Capture window screenshot
   */
  private async captureWindow(options: ScreenshotCaptureOptions): Promise<ScreenshotResult> {
    const args: Record<string, unknown> = {
      windowTitle: options.windowTitle,
      format: options.format || this.defaultFormat,
      quality: options.quality || this.defaultQuality,
    };

    if (this.savePath) {
      args['savePath'] = this.savePath;
    }

    const response = await this.client.callTool('screenshot_capture_window', args);

    return this.parseScreenshotResponse(response);
  }

  /**
   * Capture region screenshot
   */
  private async captureRegion(options: ScreenshotCaptureOptions): Promise<ScreenshotResult> {
    if (!options.region) {
      throw new Error('Region options are required for region capture');
    }

    const args: Record<string, unknown> = {
      x: options.region.x,
      y: options.region.y,
      width: options.region.width,
      height: options.region.height,
      format: options.format || this.defaultFormat,
      quality: options.quality || this.defaultQuality,
    };

    if (this.savePath) {
      args['savePath'] = this.savePath;
    }

    const response = await this.client.callTool('screenshot_capture_region', args);

    return this.parseScreenshotResponse(response);
  }

  /**
   * Parse screenshot response from mcp-screenshot
   */
  private parseScreenshotResponse(response: unknown): ScreenshotResult {
    // Validate response structure
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid screenshot response: response is not an object');
    }

    const resp = response as Record<string, unknown>;

    // Check for error status
    if (resp['status'] === 'error') {
      const error = resp['error'] as Record<string, unknown>;
      throw new Error(`Screenshot capture failed: ${error?.['message'] || 'Unknown error'}`);
    }

    // Extract screenshot data
    const data = resp['data'] as string;
    const metadata = resp['metadata'] as Record<string, unknown>;

    if (!data) {
      throw new Error('Invalid screenshot response: missing data field');
    }

    if (!metadata) {
      throw new Error('Invalid screenshot response: missing metadata field');
    }

    return {
      data,
      filePath: resp['filePath'] as string | undefined,
      width: metadata['width'] as number,
      height: metadata['height'] as number,
      format: metadata['format'] as string,
      timestamp: metadata['timestamp'] as string,
    };
  }

  /**
   * Test connection to mcp-screenshot server
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to list displays as a connection test
      await this.client.callTool('screenshot_list_displays', {});
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available displays
   */
  async listDisplays(): Promise<unknown[]> {
    try {
      const response = await this.client.callTool('screenshot_list_displays', {});

      if (response && typeof response === 'object') {
        const resp = response as Record<string, unknown>;
        if (resp['status'] === 'success' && Array.isArray(resp['displays'])) {
          return resp['displays'];
        }
      }

      return [];
    } catch (error) {
      throw new Error(
        `Failed to list displays: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get available windows
   */
  async listWindows(): Promise<unknown[]> {
    try {
      const response = await this.client.callTool('screenshot_list_windows', {});

      if (response && typeof response === 'object') {
        const resp = response as Record<string, unknown>;
        if (resp['status'] === 'success' && Array.isArray(resp['windows'])) {
          return resp['windows'];
        }
      }

      return [];
    } catch (error) {
      throw new Error(
        `Failed to list windows: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
