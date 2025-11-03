import { v4 as uuidv4 } from 'uuid';

/**
 * Base interface for all domain events
 * Follows SOLID principles with single responsibility for event data
 */
export interface IDomainEvent {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly occurredAt: Date;
  readonly version: number;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly metadata: Record<string, any>;
  readonly schemaVersion: string;
}

/**
 * Base event class implementing IDomainEvent
 * Provides common functionality for all events
 */
export abstract class DomainEvent implements IDomainEvent {
  public readonly id: string;
  public readonly type: string;
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly occurredAt: Date;
  public readonly version: number;
  public readonly correlationId?: string;
  public readonly causationId?: string;
  public readonly metadata: Record<string, any>;
  public readonly schemaVersion: string;

  constructor(data: Omit<IDomainEvent, 'id' | 'occurredAt'>) {
    this.id = uuidv4();
    this.type = data.type;
    this.aggregateId = data.aggregateId;
    this.aggregateType = data.aggregateType;
    this.occurredAt = new Date();
    this.version = data.version;
    this.correlationId = data.correlationId;
    this.causationId = data.causationId;
    this.metadata = data.metadata || {};
    this.schemaVersion = data.schemaVersion;
  }

  /**
   * Serialize event to JSON
   */
  toJSON(): string {
    return JSON.stringify({
      id: this.id,
      type: this.type,
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      occurredAt: this.occurredAt.toISOString(),
      version: this.version,
      correlationId: this.correlationId,
      causationId: this.causationId,
      metadata: this.metadata,
      schemaVersion: this.schemaVersion
    });
  }

  /**
   * Create event from JSON
   */
  static fromJSON<T extends DomainEvent>(
    this: new (data: IDomainEvent) => T,
    json: string
  ): T {
    const data = JSON.parse(json);
    return new this({
      ...data,
      occurredAt: new Date(data.occurredAt)
    });
  }
}

/**
 * Event envelope for transport and storage
 * Contains additional transport metadata
 */
export interface IEventEnvelope {
  readonly eventId: string;
  readonly event: IDomainEvent;
  readonly streamId: string;
  readonly streamVersion: number;
  readonly recordedAt: Date;
  readonly recordedBy?: string;
  readonly retryCount: number;
  readonly lastError?: string;
}

/**
 * Event stream representation
 * Contains all events for an aggregate
 */
export interface IEventStream {
  readonly streamId: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly version: number;
  readonly events: IDomainEvent[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Event subscription configuration
 */
export interface IEventSubscription {
  readonly id: string;
  readonly eventType: string;
  readonly handlerName: string;
  readonly filter?: IEventFilter;
  readonly retryPolicy: IRetryPolicy;
  readonly isActive: boolean;
  readonly createdAt: Date;
}

/**
 * Event filter for subscription routing
 */
export interface IEventFilter {
  readonly aggregateType?: string;
  readonly version?: number | number[];
  readonly metadata?: Record<string, any>;
  readonly customFilter?: (event: IDomainEvent) => boolean;
}

/**
 * Retry policy for event handling
 */
export interface IRetryPolicy {
  readonly maxRetries: number;
  readonly initialDelay: number;
  readonly maxDelay: number;
  readonly backoffMultiplier: number;
  readonly retryableErrors: string[];
}

/**
 * Event handling result
 */
export interface IEventHandlingResult {
  readonly eventId: string;
  readonly subscriptionId: string;
  readonly status: 'success' | 'failed' | 'retry';
  readonly error?: string;
  readonly duration: number;
  readonly handledAt: Date;
}

/**
 * Event statistics for monitoring
 */
export interface IEventStatistics {
  readonly totalEvents: number;
  readonly eventTypes: Record<string, number>;
  readonly successfulEvents: number;
  readonly failedEvents: number;
  readonly averageProcessingTime: number;
  readonly lastEventAt?: Date;
}