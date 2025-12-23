/**
 * Retry handler with exponential backoff
 *
 * @packageDocumentation
 */

import { MCPTestingError } from './MCPTestingError';

/**
 * Retry options
 */
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [],
  onRetry: () => {},
};

/**
 * Retry handler class
 */
export class RetryHandler {
  private options: Required<RetryOptions>;

  constructor(options?: RetryOptions) {
    this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= this.options.maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Check if error is retryable
        if (!this.isRetryable(error as Error) || attempt > this.options.maxRetries) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);

        // Call retry callback
        this.options.onRetry(error as Error, attempt);

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: Error): boolean {
    // Check if it's an MCPTestingError with retryable flag
    if (error instanceof MCPTestingError) {
      return error.isRetryable();
    }

    // Check if error code is in retryable list
    if (this.options.retryableErrors.length > 0) {
      const errorCode = (error as any).code;
      return this.options.retryableErrors.includes(errorCode);
    }

    // Default: retry on network and timeout errors
    const retryablePatterns = [
      /ECONNREFUSED/,
      /ETIMEDOUT/,
      /ENOTFOUND/,
      /ENETUNREACH/,
      /timeout/i,
      /connection/i,
    ];

    return retryablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number): number {
    const delay = this.options.initialDelay * Math.pow(this.options.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.options.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Retry decorator for methods
 */
export function Retry(options?: RetryOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const retryHandler = new RetryHandler(options);

    descriptor.value = async function (...args: any[]) {
      return retryHandler.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
