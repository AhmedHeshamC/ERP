import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Test Environment Configuration Loader
 *
 * SOLID Principles Implementation:
 * - Single Responsibility: Only handles environment variable loading
 * - Open/Closed: Open for extension via new file paths, closed for modification
 * - Liskov Substitution: Can be substituted with other environment loaders
 * - Interface Segregation: Small, focused interface for environment loading
 * - Dependency Inversion: Depends on abstractions (fs, path), not concretions
 */
export class TestEnvironmentLoader {
  private static instance: TestEnvironmentLoader;
  private isLoaded = false;

  private constructor() {}

  /**
   * Singleton pattern with double-checked locking
   * Ensures only one instance loads environment variables
   */
  public static getInstance(): TestEnvironmentLoader {
    if (!TestEnvironmentLoader.instance) {
      TestEnvironmentLoader.instance = new TestEnvironmentLoader();
    }
    return TestEnvironmentLoader.instance;
  }

  /**
   * Load test environment variables with proper fallback chain
   *
   * Loading strategy:
   * 1. .env.test - Primary test environment configuration
   * 2. .env.local - Local development overrides
   * 3. .env - Default environment configuration
   * 4. Fallback to existing process.env
   *
   * @returns {void}
   */
  public loadTestEnvironment(): void {
    if (this.isLoaded) {
      return; // Prevent multiple loading and side effects
    }

    const envPaths = [
      path.resolve(process.cwd(), '.env.test'), // Primary test environment
      path.resolve(process.cwd(), '.env.local'), // Local override
      path.resolve(process.cwd(), '.env'), // Default environment
    ];

    for (const envPath of envPaths) {
      if (this.fileExists(envPath)) {
        this.loadEnvironmentFile(envPath);
        this.isLoaded = true;
        return;
      }
    }

    // Graceful fallback when no .env files exist
    this.handleMissingEnvironmentFiles();
    this.isLoaded = true;
  }

  /**
   * Validate critical environment variables are present
   * Interface Segregation: Only validates test-specific requirements
   *
   * @param {string[]} requiredVars - List of required environment variables
   * @throws {Error} When required variables are missing
   */
  public validateEnvironment(requiredVars: string[] = []): void {
    const defaultRequiredVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
    const allRequiredVars = [...defaultRequiredVars, ...requiredVars];

    const missingVars = allRequiredVars.filter(varName =>
      !process.env[varName] || process.env[varName]!.trim() === ''
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}. ` +
        `Please check your .env.test configuration.`
      );
    }
  }

  /**
   * Get the effective environment configuration (useful for debugging)
   *
   * @returns {object} Current environment state
   */
  public getEnvironmentSnapshot(): object {
    return {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? '***CONFIGURED***' : 'MISSING',
      JWT_SECRET: process.env.JWT_SECRET ? '***CONFIGURED***' : 'MISSING',
      isLoaded: this.isLoaded,
    };
  }

  /**
   * Reset the loader state (primarily for testing the loader itself)
   *
   * @internal
   */
  public _reset(): void {
    this.isLoaded = false;
  }

  /**
   * Check if a file exists safely
   *
   * @private
   * @param {string} filePath - Path to check
   * @returns {boolean} True if file exists
   */
  private fileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Load environment variables from a specific file
   *
   * @private
   * @param {string} envPath - Path to environment file
   */
  private loadEnvironmentFile(envPath: string): void {
    console.log(`Loading test environment from: ${path.basename(envPath)}`);
    dotenv.config({ path: envPath });
  }

  /**
   * Handle case when no environment files are found
   *
   * @private
   */
  private handleMissingEnvironmentFiles(): void {
    console.warn(
      'No .env files found (.env.test, .env.local, .env). ' +
      'Relying on existing process.env. Some tests may fail if required variables are missing.'
    );

    // Still attempt to load any available environment variables
    dotenv.config();
  }
}