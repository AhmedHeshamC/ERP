import { PrismaService } from '../../../database/prisma.service';
import { IntegrationTestHelpers } from '../integration-setup';

/**
 * Base Data Factory Class
 *
 * Provides common functionality for all test data factories
 * with proper cleanup, unique data generation, and relationship management
 */
export abstract class BaseDataFactory {
  constructor(protected prisma: PrismaService) {}

  /**
   * Generate unique identifier with timestamp
   */
  protected generateUniqueId(prefix: string): string {
    return IntegrationTestHelpers.generateUniqueData(prefix);
  }

  /**
   * Generate unique email for testing
   */
  protected generateTestEmail(identifier: string): string {
    return IntegrationTestHelpers.generateTestEmail(identifier);
  }

  /**
   * Generate unique reference number
   */
  protected generateReference(prefix: string): string {
    return IntegrationTestHelpers.generateReference(prefix);
  }

  /**
   * Generate unique phone number
   */
  protected generatePhoneNumber(): string {
    return `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
  }

  /**
   * Generate random monetary amount
   */
  protected generateAmount(min: number = 0, max: number = 10000): number {
    return Number((Math.random() * (max - min) + min).toFixed(2));
  }

  /**
   * Generate random percentage
   */
  protected generatePercentage(min: number = 0, max: number = 100): number {
    return Number((Math.random() * (max - min) + min).toFixed(2));
  }

  /**
   * Generate future date
   */
  protected generateFutureDate(daysFromNow: number = 30): Date {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  }

  /**
   * Generate past date
   */
  protected generatePastDate(daysAgo: number = 30): Date {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }

  /**
   * Generate random boolean
   */
  protected generateBoolean(probability: number = 0.5): boolean {
    return Math.random() < probability;
  }

  /**
   * Select random item from array
   */
  protected selectRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  /**
   * Select random items from array
   */
  protected selectRandomItems<T>(items: T[], count: number): T[] {
    const shuffled = [...items].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, items.length));
  }

  /**
   * Generate random string
   */
  protected generateRandomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate lorem ipsum text
   */
  protected generateLoremIpsum(words: number = 10): string {
    const loremWords = [
      'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
      'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
      'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
      'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo'
    ];

    const result = [];
    for (let i = 0; i < words; i++) {
      result.push(this.selectRandom(loremWords));
    }

    return result.join(' ').charAt(0).toUpperCase() + result.join(' ').slice(1);
  }

  /**
   * Generate realistic address
   */
  protected generateAddress(): {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  } {
    const streets = [
      '123 Main St', '456 Oak Ave', '789 Pine Rd', '321 Elm Blvd', '654 Maple Dr',
      '987 Cedar Ln', '147 Birch Way', '258 Walnut Ct', '369 Spruce Cir', '741 Ash Pl'
    ];

    const cities = [
      'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
      'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville'
    ];

    const states = [
      'CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'NJ', 'VA'
    ];

    return {
      street: this.selectRandom(streets),
      city: this.selectRandom(cities),
      state: this.selectRandom(states),
      zipCode: Math.floor(Math.random() * 90000 + 10000).toString(),
      country: 'USA'
    };
  }

  /**
   * Create test user with specified role
   */
  async createTestUser(role: string, overrides?: any): Promise<any> {
    const timestamp = Date.now();
    const userData = {
      email: this.generateTestEmail(`${role}-${timestamp}`),
      username: `${role.toLowerCase()}-${timestamp}`,
      firstName: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(),
      lastName: 'Test User',
      password: 'TestPassword123!',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    try {
      return await this.prisma.user.create({ data: userData });
    } catch (error) {
      // User might already exist, try to find existing
      return await this.prisma.user.findFirst({
        where: { email: userData.email }
      });
    }
  }

  /**
   * Clean up test data by patterns
   */
  async cleanupTestData(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      try {
        await this.prisma.user.deleteMany({
          where: {
            OR: [
              { email: { contains: pattern } },
              { username: { contains: pattern } }
            ]
          }
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Execute database operation with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 100
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await IntegrationTestHelpers.sleep(delay * attempt);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Validate foreign key relationship exists
   */
  protected async validateRelationship(
    model: string,
    id: string
  ): Promise<boolean> {
    try {
      // @ts-ignore - Dynamic model access
      const record = await this.prisma[model].findUnique({
        where: { id }
      });
      return record !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create multiple records with batch operation
   */
  protected async createBatch<T>(
    model: string,
    data: any[]
  ): Promise<T[]> {
    try {
      // @ts-ignore - Dynamic model access
      return await this.prisma[model].createMany({
        data,
        skipDuplicates: true
      });
    } catch (error) {
      // Fallback to individual creation
      const results = [];
      for (const item of data) {
        try {
          // @ts-ignore - Dynamic model access
          const result = await this.prisma[model].create({ data: item });
          results.push(result);
        } catch (error) {
          // Continue with other items
        }
      }
      return results as T[];
    }
  }
}

/**
 * Common test data constants
 */
export const TEST_DATA_CONSTANTS = {
  COMPANIES: [
    'Acme Corporation', 'Global Industries', 'Tech Solutions Inc', 'Innovation Labs',
    'Enterprise Systems', 'Digital Dynamics', 'Future Tech', 'Smart Solutions'
  ],

  INDUSTRIES: [
    'Technology', 'Manufacturing', 'Healthcare', 'Finance', 'Retail',
    'Education', 'Government', 'Construction', 'Transportation', 'Energy'
  ],

  CURRENCIES: [
    'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'
  ],

  LANGUAGES: [
    'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Korean', 'Portuguese'
  ],

  TIMEZONES: [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'
  ]
};

/**
 * Interface for test data factory
 */
export interface ITestDataFactory {
  createBaseData(): Promise<void>;
  cleanupTestData(): Promise<void>;
  generateTestData(overrides?: any): any;
}