/**
 * Workflow type definitions and utilities following SOLID principles
 */

import {
  WorkflowState,
  WorkflowStepType,
  WorkflowPriority,
  WorkflowCommandType
} from '../interfaces/workflow-execution.interface';

// Type guards for workflow validation
export const isValidWorkflowState = (state: string): state is WorkflowState => {
  return Object.values(WorkflowState).includes(state as WorkflowState);
};

export const isValidWorkflowStepType = (type: string): type is WorkflowStepType => {
  return Object.values(WorkflowStepType).includes(type as WorkflowStepType);
};

export const isValidWorkflowPriority = (priority: string): priority is WorkflowPriority => {
  return Object.values(WorkflowPriority).includes(priority as WorkflowPriority);
};

export const isValidWorkflowCommandType = (type: string): type is WorkflowCommandType => {
  return Object.values(WorkflowCommandType).includes(type as WorkflowCommandType);
};

// Workflow execution context types
export interface WorkflowExecutionContext {
  instanceId: string;
  stepId: string;
  variables: Record<string, any>;
  input: Record<string, any>;
  output: Record<string, any>;
  metadata: Record<string, any>;
  startTime: Date;
  correlationId: string;
  userId: string;
}

// Step execution result types
export interface StepExecutionResult {
  success: boolean;
  output?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  nextSteps?: string[];
  shouldRetry?: boolean;
  shouldRollback?: boolean;
}

// Expression evaluation context
export interface ExpressionContext {
  variables: Record<string, any>;
  input: Record<string, any>;
  output: Record<string, any>;
  step: {
    id: string;
    name: string;
    type: WorkflowStepType;
  };
  workflow: {
    id: string;
    version: string;
    name: string;
  };
  instance: {
    id: string;
    userId: string;
    correlationId: string;
  };
  system: {
    timestamp: Date;
    environment: string;
  };
}

// Event handling types
export interface EventHandler {
  eventType: string;
  handler: (event: any) => Promise<void>;
  filter?: (event: any) => boolean;
  priority?: number;
}

export interface EventSubscription {
  id: string;
  instanceId: string;
  eventType: string;
  condition?: string;
  timeout?: number;
  createdAt: Date;
  expiresAt?: Date;
}

// Configuration types
export interface WorkflowEngineConfig {
  maxConcurrentWorkflows: number;
  defaultTimeout: number;
  cleanupInterval: number;
  metricsEnabled: boolean;
  monitoringEnabled: boolean;
  debugMode: boolean;
  storageBackend: 'memory' | 'database' | 'redis';
  eventBusType: 'memory' | 'redis' | 'message-queue';
}

// Error types
export class WorkflowExecutionError extends Error {
  public readonly code: string;
  public readonly stepId?: string;
  public readonly instanceId: string;
  public readonly timestamp: Date;
  public readonly retryable: boolean;
  public readonly recoverable: boolean;
  public readonly details?: Record<string, any>;

  constructor(
    code: string,
    message: string,
    instanceId: string,
    stepId?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'WorkflowExecutionError';
    this.code = code;
    this.instanceId = instanceId;
    this.stepId = stepId;
    this.timestamp = new Date();
    this.retryable = this.isRetryable(code);
    this.recoverable = this.isRecoverable(code);
    this.details = details;
  }

  private isRetryable(code: string): boolean {
    const retryableCodes = [
      'TIMEOUT_ERROR',
      'NETWORK_ERROR',
      'TEMPORARY_FAILURE',
      'RESOURCE_UNAVAILABLE',
      'RATE_LIMIT_EXCEEDED'
    ];
    return retryableCodes.includes(code);
  }

  private isRecoverable(code: string): boolean {
    const recoverableCodes = [
      'VALIDATION_ERROR',
      'PERMISSION_DENIED',
      'BUSINESS_RULE_VIOLATION',
      'DATA_CONFLICT'
    ];
    return recoverableCodes.includes(code);
  }
}

// Utility types for type-safe workflow operations
export type WorkflowStepAction = (
  context: WorkflowExecutionContext,
  config?: Record<string, any>
) => Promise<StepExecutionResult>;

export type WorkflowConditionEvaluator = (
  condition: string,
  context: ExpressionContext
) => boolean;

export type WorkflowVariableResolver = (
  template: string,
  context: ExpressionContext
) => string;

// State management types
export interface WorkflowStateTransition {
  from: WorkflowState;
  to: WorkflowState;
  event: string;
  guard?: (instance: any) => boolean;
  action?: (instance: any) => Promise<void>;
}

// Performance monitoring types
export interface WorkflowPerformanceMetrics {
  instanceId: string;
  workflowId: string;
  stepMetrics: Record<string, StepPerformanceMetrics>;
  totalExecutionTime: number;
  memoryPeak: number;
  cpuTime: number;
  timestamp: Date;
}

export interface StepPerformanceMetrics {
  stepId: string;
  executionCount: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  lastExecuted: Date;
}

// Cache types
export interface WorkflowCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// Queue types for async processing
export interface WorkflowQueue {
  enqueue(job: WorkflowJob): Promise<void>;
  dequeue(): Promise<WorkflowJob | null>;
  peek(): Promise<WorkflowJob | null>;
  size(): Promise<number>;
  clear(): Promise<void>;
}

export interface WorkflowJob {
  id: string;
  type: string;
  instanceId: string;
  stepId?: string;
  payload: Record<string, any>;
  priority: WorkflowPriority;
  createdAt: Date;
  scheduledAt?: Date;
  retryCount: number;
  maxRetries: number;
}

// Lock management types
export interface WorkflowLock {
  acquire(resourceId: string, ttl?: number): Promise<string>;
  release(lockId: string): Promise<boolean>;
  extend(lockId: string, ttl: number): Promise<boolean>;
  isLocked(resourceId: string): Promise<boolean>;
}

// Plugin system types
export interface WorkflowPlugin {
  name: string;
  version: string;
  initialize(engine: any): Promise<void>;
  beforeStepExecution?(context: WorkflowExecutionContext): Promise<void>;
  afterStepExecution?(context: WorkflowExecutionContext, result: StepExecutionResult): Promise<void>;
  beforeWorkflowCompletion?(context: WorkflowExecutionContext): Promise<void>;
  afterWorkflowCompletion?(context: WorkflowExecutionContext, result: any): Promise<void>;
}

// Validation types
export interface WorkflowValidator {
  validateDefinition(definition: any): ValidationResult;
  validateStep(step: any): ValidationResult;
  validateTransition(transition: any): ValidationResult;
  validateExpression(expression: string): ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  path: string;
  severity: 'error';
}

export interface ValidationWarning {
  code: string;
  message: string;
  path: string;
  severity: 'warning';
}

// Serialization types
export interface WorkflowSerializer {
  serialize(instance: any): string;
  deserialize(data: string): any;
  serializeDefinition(definition: any): string;
  deserializeDefinition(data: string): any;
}

// Constants
export const WORKFLOW_CONSTANTS = {
  DEFAULT_TIMEOUT: 300000, // 5 minutes
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000,
  MAX_PARALLEL_STEPS: 10,
  CLEANUP_INTERVAL: 60000, // 1 minute
  EVENT_TIMEOUT: 300000, // 5 minutes
  LOCK_DEFAULT_TTL: 60000, // 1 minute
  MAX_WORKFLOW_VARIABLES: 100,
  MAX_STEP_CONFIG_SIZE: 1024 * 1024, // 1MB
  MAX_WORKFLOW_DEFINITION_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

// Error codes
export const WORKFLOW_ERROR_CODES = {
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  // Workflow definition errors
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  INVALID_WORKFLOW_DEFINITION: 'INVALID_WORKFLOW_DEFINITION',
  STEP_NOT_FOUND: 'STEP_NOT_FOUND',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',

  // Execution errors
  WORKFLOW_ALREADY_RUNNING: 'WORKFLOW_ALREADY_RUNNING',
  WORKFLOW_NOT_RUNNING: 'WORKFLOW_NOT_RUNNING',
  WORKFLOW_COMPLETED: 'WORKFLOW_COMPLETED',
  WORKFLOW_FAILED: 'WORKFLOW_FAILED',
  WORKFLOW_CANCELLED: 'WORKFLOW_CANCELLED',

  // Step execution errors
  STEP_EXECUTION_FAILED: 'STEP_EXECUTION_FAILED',
  STEP_TIMEOUT: 'STEP_TIMEOUT',
  STEP_CANCELLED: 'STEP_CANCELLED',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  TEMPORARY_FAILURE: 'TEMPORARY_FAILURE',

  // System errors
  INSUFFICIENT_RESOURCES: 'INSUFFICIENT_RESOURCES',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',

  // Business logic errors
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  DATA_CONFLICT: 'DATA_CONFLICT',

  // Retry related errors
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  RETRY_DELAY_EXCEEDED: 'RETRY_DELAY_EXCEEDED',
} as const;