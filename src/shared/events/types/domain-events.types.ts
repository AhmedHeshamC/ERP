import { DomainEvent } from './event.types';

/**
 * User Module Events
 */
export class UserCreatedEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    correlationId?: string;
  }) {
    super({
      type: 'UserCreated',
      aggregateId: data.aggregateId,
      aggregateType: 'User',
      version: 1,
      metadata: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}

export class UserUpdatedEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    changes: Record<string, any>;
    correlationId?: string;
  }) {
    super({
      type: 'UserUpdated',
      aggregateId: data.aggregateId,
      aggregateType: 'User',
      version: 1,
      metadata: {
        changes: data.changes
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}

export class UserDeletedEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    deletedBy: string;
    correlationId?: string;
  }) {
    super({
      type: 'UserDeleted',
      aggregateId: data.aggregateId,
      aggregateType: 'User',
      version: 1,
      metadata: {
        deletedBy: data.deletedBy
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}

/**
 * Product Module Events
 */
export class ProductCreatedEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    name: string;
    sku: string;
    price: number;
    stock: number;
    correlationId?: string;
  }) {
    super({
      type: 'ProductCreated',
      aggregateId: data.aggregateId,
      aggregateType: 'Product',
      version: 1,
      metadata: {
        name: data.name,
        sku: data.sku,
        price: data.price,
        stock: data.stock
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}

export class ProductUpdatedEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    changes: Record<string, any>;
    correlationId?: string;
  }) {
    super({
      type: 'ProductUpdated',
      aggregateId: data.aggregateId,
      aggregateType: 'Product',
      version: 1,
      metadata: {
        changes: data.changes
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}

export class StockAdjustedEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    adjustment: number;
    reason: string;
    previousStock: number;
    newStock: number;
    correlationId?: string;
  }) {
    super({
      type: 'StockAdjusted',
      aggregateId: data.aggregateId,
      aggregateType: 'Product',
      version: 1,
      metadata: {
        adjustment: data.adjustment,
        reason: data.reason,
        previousStock: data.previousStock,
        newStock: data.newStock
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}

/**
 * Sales Module Events
 */
export class OrderCreatedEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    customerId: string;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
    totalAmount: number;
    correlationId?: string;
  }) {
    super({
      type: 'OrderCreated',
      aggregateId: data.aggregateId,
      aggregateType: 'Order',
      version: 1,
      metadata: {
        customerId: data.customerId,
        items: data.items,
        totalAmount: data.totalAmount
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}

export class OrderStatusChangedEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    previousStatus: string;
    newStatus: string;
    reason?: string;
    correlationId?: string;
  }) {
    super({
      type: 'OrderStatusChanged',
      aggregateId: data.aggregateId,
      aggregateType: 'Order',
      version: 1,
      metadata: {
        previousStatus: data.previousStatus,
        newStatus: data.newStatus,
        reason: data.reason
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}

export class PaymentProcessedEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    paymentMethod: string;
    amount: number;
    status: 'success' | 'failed';
    transactionId?: string;
    correlationId?: string;
  }) {
    super({
      type: 'PaymentProcessed',
      aggregateId: data.aggregateId,
      aggregateType: 'Payment',
      version: 1,
      metadata: {
        paymentMethod: data.paymentMethod,
        amount: data.amount,
        status: data.status,
        transactionId: data.transactionId
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}

/**
 * Workflow Module Events
 */
export class WorkflowStepStartedEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    workflowId: string;
    stepId: string;
    stepName: string;
    correlationId?: string;
  }) {
    super({
      type: 'WorkflowStepStarted',
      aggregateId: data.aggregateId,
      aggregateType: 'WorkflowStep',
      version: 1,
      metadata: {
        workflowId: data.workflowId,
        stepId: data.stepId,
        stepName: data.stepName
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}

export class WorkflowStepCompletedEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    workflowId: string;
    stepId: string;
    stepName: string;
    result?: any;
    correlationId?: string;
  }) {
    super({
      type: 'WorkflowStepCompleted',
      aggregateId: data.aggregateId,
      aggregateType: 'WorkflowStep',
      version: 1,
      metadata: {
        workflowId: data.workflowId,
        stepId: data.stepId,
        stepName: data.stepName,
        result: data.result
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}

export class WorkflowStepFailedEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    workflowId: string;
    stepId: string;
    stepName: string;
    error: string;
    retryable: boolean;
    correlationId?: string;
  }) {
    super({
      type: 'WorkflowStepFailed',
      aggregateId: data.aggregateId,
      aggregateType: 'WorkflowStep',
      version: 1,
      metadata: {
        workflowId: data.workflowId,
        stepId: data.stepId,
        stepName: data.stepName,
        error: data.error,
        retryable: data.retryable
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}

/**
 * System Events
 */
export class SystemErrorEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    error: string;
    stack: string;
    context: Record<string, any>;
    correlationId?: string;
  }) {
    super({
      type: 'SystemError',
      aggregateId: data.aggregateId,
      aggregateType: 'System',
      version: 1,
      metadata: {
        error: data.error,
        stack: data.stack,
        context: data.context
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}

export class PerformanceAlertEvent extends DomainEvent {
  constructor(data: {
    aggregateId: string;
    metric: string;
    value: number;
    threshold: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    correlationId?: string;
  }) {
    super({
      type: 'PerformanceAlert',
      aggregateId: data.aggregateId,
      aggregateType: 'System',
      version: 1,
      metadata: {
        metric: data.metric,
        value: data.value,
        threshold: data.threshold,
        severity: data.severity
      },
      correlationId: data.correlationId,
      schemaVersion: '1.0.0'
    });
  }
}