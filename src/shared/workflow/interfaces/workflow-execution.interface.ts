/**
 * Core workflow execution interfaces following SOLID principles
 */

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  steps: WorkflowStep[];
  initialStep: string;
  variables?: Record<string, any>;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  metadata?: Record<string, any>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  action: string;
  config?: Record<string, any>;
  transitions: WorkflowTransition[];
  timeout?: number;
  retryPolicy?: RetryPolicy;
  compensation?: string; // Step to execute for rollback
}

export interface WorkflowTransition {
  to: string | string[]; // Single step or parallel steps
  condition: string; // Expression or event type
  priority?: number;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  workflowVersion: string;
  status: WorkflowState;
  currentStep?: string;
  input: Record<string, any>;
  output?: Record<string, any>;
  variables: Record<string, any>;
  context: WorkflowContext;
  executionLog: WorkflowExecutionLogEntry[];
  metrics: WorkflowMetrics;
  error?: WorkflowError;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  userId: string;
  priority: WorkflowPriority;
  cancellationReason?: string;
}

export interface WorkflowContext {
  correlationId: string;
  traceId?: string;
  parentId?: string;
  requestId?: string;
  [key: string]: any;
}

export interface WorkflowExecutionRequest {
  workflowId: string;
  instanceId?: string;
  input: Record<string, any>;
  userId: string;
  priority?: WorkflowPriority;
  metadata?: Record<string, any>;
  timeout?: number;
  dryRun?: boolean;
}

export interface WorkflowExecutionResult {
  instanceId: string;
  workflowId: string;
  status: WorkflowState;
  input: Record<string, any>;
  output: Record<string, any>;
  workflowState: Record<string, any>;
  variables: Record<string, any>;
  executionPath: string[];
  executionLog: WorkflowExecutionLogEntry[];
  metrics: WorkflowMetrics;
  error?: WorkflowError;
  retryCount: number;
  rollbackLog: WorkflowRollbackEntry[];
  startedAt: Date;
  completedAt: Date;
  executionTime: number; // in milliseconds
  cancellationReason?: string;
}

export interface WorkflowExecutionLogEntry {
  timestamp: Date;
  stepId: string;
  action: string;
  status: 'started' | 'completed' | 'failed' | 'cancelled' | 'retry';
  duration?: number;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: WorkflowError;
  metadata?: Record<string, any>;
}

export interface WorkflowRollbackEntry {
  timestamp: Date;
  stepId: string;
  compensationAction: string;
  status: 'started' | 'completed' | 'failed';
  duration?: number;
  error?: WorkflowError;
}

export interface WorkflowMetrics {
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  skippedSteps: number;
  averageStepDuration: number;
  totalExecutionTime: number;
  memoryUsage?: number;
  cpuUsage?: number;
  customMetrics?: Record<string, any>;
}

export interface WorkflowError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
  stepId?: string;
  timestamp: Date;
  retryable: boolean;
  recoverable: boolean;
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier?: number;
  maxRetryDelay?: number;
  retryableErrors?: string[];
}

export interface WorkflowEvent {
  type: string;
  instanceId: string;
  data: Record<string, any>;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface WorkflowEventListener {
  eventType: string;
  handler: (event: WorkflowEvent) => Promise<void>;
  filter?: (event: WorkflowEvent) => boolean;
}

export interface WorkflowStepExecutor {
  execute(step: WorkflowStep, context: WorkflowContext, input: Record<string, any>): Promise<Record<string, any>>;
  compensate?(step: WorkflowStep, context: WorkflowContext, input: Record<string, any>): Promise<void>;
  validate?(step: WorkflowStep, input: Record<string, any>): Promise<boolean>;
}

export interface WorkflowStateStorage {
  save(instance: WorkflowInstance): Promise<void>;
  load(instanceId: string): Promise<WorkflowInstance | null>;
  update(instanceId: string, updates: Partial<WorkflowInstance>): Promise<void>;
  delete(instanceId: string): Promise<void>;
  find(filter: Partial<WorkflowInstance>): Promise<WorkflowInstance[]>;
}

export interface WorkflowEventEmitter {
  emit(event: WorkflowEvent): Promise<void>;
  on(eventType: string, listener: WorkflowEventListener): void;
  off(eventType: string, listener: WorkflowEventListener): void;
}

// Enums for type safety
export enum WorkflowState {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated'
}

export enum WorkflowStepType {
  TASK = 'task',
  DECISION = 'decision',
  PARALLEL = 'parallel',
  JOIN = 'join',
  EVENT_WAIT = 'event-wait',
  EVENT_EMIT = 'emit',
  SUBWORKFLOW = 'subworkflow',
  SCRIPT = 'script',
  HUMAN_TASK = 'human-task',
  TIMER = 'timer',
  ERROR_HANDLER = 'error-handler'
}

export enum WorkflowPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Command interfaces for workflow operations
export interface WorkflowCommand {
  id: string;
  type: WorkflowCommandType;
  instanceId: string;
  userId: string;
  timestamp: Date;
  payload?: Record<string, any>;
}

export enum WorkflowCommandType {
  START = 'start',
  CANCEL = 'cancel',
  SUSPEND = 'suspend',
  RESUME = 'resume',
  RETRY = 'retry',
  TERMINATE = 'terminate'
}

// Validation interfaces
export interface WorkflowValidationResult {
  isValid: boolean;
  errors: WorkflowValidationError[];
  warnings: WorkflowValidationError[];
}

export interface WorkflowValidationError {
  code: string;
  message: string;
  path?: string;
  severity: 'error' | 'warning';
}

// Monitoring interfaces
export interface WorkflowMonitoringMetrics {
  instanceId: string;
  workflowId: string;
  status: WorkflowState;
  stepMetrics: Record<string, StepMetrics>;
  systemMetrics: SystemMetrics;
  businessMetrics?: Record<string, any>;
}

export interface StepMetrics {
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  lastExecuted: Date;
}

export interface SystemMetrics {
  memoryUsage: number;
  cpuUsage: number;
  diskIO?: number;
  networkIO?: number;
  timestamp: Date;
}