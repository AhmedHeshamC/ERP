import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { WorkflowModule } from '../workflow/workflow.module';

// Event Services
import { EventBusService } from './services/event-bus.service';
import { EventStoreService } from './services/event-store.service';
import { EventMiddlewareService } from './services/event-middleware.service';
import { AsyncEventProcessorService } from './services/async-event-processor.service';
import { EventRouterService } from './services/event-router.service';
import { DeadLetterQueueService } from './services/dead-letter-queue.service';
import { EventMonitoringService } from './services/event-monitoring.service';

// Event Handlers
import { UserEventHandlersService } from './handlers/user-event-handlers.service';
import { ProductEventHandlersService } from './handlers/product-event-handlers.service';
import { SalesEventHandlersService } from './handlers/sales-event-handlers.service';
import { WorkflowEventHandlersService } from './handlers/workflow-event-handlers.service';

// Interfaces
import { IEventBus } from './interfaces/event-bus.interface';
import { IEventStore } from './interfaces/event-store.interface';
import { IEventMiddleware } from './interfaces/event-handler.interface';

/**
 * Event System Module Configuration
 * Provides enterprise-grade event-driven architecture with SOLID principles
 *
 * Features:
 * - Event sourcing with persistence
 * - Async event processing with queues
 * - Event routing and filtering
 * - Dead letter queue for failed events
 * - Comprehensive monitoring and metrics
 * - Workflow integration
 * - Domain event handlers for business modules
 */
export interface EventModuleOptions {
  /** Enable event persistence to database */
  enablePersistence?: boolean;
  /** Enable async event processing */
  enableAsyncProcessing?: boolean;
  /** Enable event monitoring and metrics */
  enableMonitoring?: boolean;
  /** Enable dead letter queue */
  enableDeadLetterQueue?: boolean;
  /** Enable event routing */
  enableRouting?: boolean;
  /** Custom event store provider */
  eventStoreProvider?: Provider;
  /** Custom event bus provider */
  eventBusProvider?: Provider;
  /** Custom middleware provider */
  middlewareProvider?: Provider;
  /** Register domain event handlers */
  registerHandlers?: {
    users?: boolean;
    products?: boolean;
    sales?: boolean;
    workflows?: boolean;
  };
}

@Module({})
export class EventModule {
  /**
   * Register the Event Module dynamically with configuration
   */
  static register(options: EventModuleOptions = {}): DynamicModule {
    const {
      enablePersistence = true,
      enableAsyncProcessing = true,
      enableMonitoring = true,
      enableDeadLetterQueue = true,
      enableRouting = true,
      eventStoreProvider,
      eventBusProvider,
      middlewareProvider,
      registerHandlers = {
        users: true,
        products: true,
        sales: true,
        workflows: true
      }
    } = options;

    const providers: Provider[] = [];

    // Core Event Services
    if (eventStoreProvider) {
      providers.push(eventStoreProvider);
    } else if (enablePersistence) {
      providers.push({
        provide: IEventStore,
        useClass: EventStoreService
      });
    }

    if (middlewareProvider) {
      providers.push(middlewareProvider);
    } else {
      providers.push({
        provide: IEventMiddleware,
        useClass: EventMiddlewareService
      });
    }

    if (eventBusProvider) {
      providers.push(eventBusProvider);
    } else {
      providers.push({
        provide: IEventBus,
        useClass: EventBusService
      });
    }

    // Optional Services
    if (enableAsyncProcessing) {
      providers.push(AsyncEventProcessorService);
    }

    if (enableRouting) {
      providers.push(EventRouterService);
    }

    if (enableDeadLetterQueue) {
      providers.push(DeadLetterQueueService);
    }

    if (enableMonitoring) {
      providers.push(EventMonitoringService);
    }

    // Domain Event Handlers
    if (registerHandlers.users) {
      providers.push(UserEventHandlersService);
    }

    if (registerHandlers.products) {
      providers.push(ProductEventHandlersService);
    }

    if (registerHandlers.sales) {
      providers.push(SalesEventHandlersService);
    }

    if (registerHandlers.workflows) {
      providers.push(WorkflowEventHandlersService);
    }

    const imports = [];

    if (enablePersistence) {
      imports.push(PrismaModule);
    }

    if (enableAsyncProcessing) {
      imports.push(QueueModule);
    }

    if (enableMonitoring) {
      imports.push(MonitoringModule);
    }

    if (registerHandlers.workflows) {
      imports.push(WorkflowModule);
    }

    const exports = [
      IEventBus,
      IEventStore,
      IEventMiddleware,
      EventBusService,
      EventStoreService,
      EventMiddlewareService
    ];

    if (enableAsyncProcessing) {
      exports.push(AsyncEventProcessorService);
    }

    if (enableRouting) {
      exports.push(EventRouterService);
    }

    if (enableDeadLetterQueue) {
      exports.push(DeadLetterQueueService);
    }

    if (enableMonitoring) {
      exports.push(EventMonitoringService);
    }

    return {
      module: EventModule,
      imports,
      providers,
      exports,
      global: true // Make event system available globally
    };
  }

  /**
   * Register Event Module for production with all features enabled
   */
  static forRoot(): DynamicModule {
    return this.register({
      enablePersistence: true,
      enableAsyncProcessing: true,
      enableMonitoring: true,
      enableDeadLetterQueue: true,
      enableRouting: true,
      registerHandlers: {
        users: true,
        products: true,
        sales: true,
        workflows: true
      }
    });
  }

  /**
   * Register Event Module for development/testing with minimal features
   */
  static forRootAsync(): DynamicModule {
    return this.register({
      enablePersistence: false, // Use in-memory for testing
      enableAsyncProcessing: false, // Synchronous for easier testing
      enableMonitoring: true,
      enableDeadLetterQueue: true,
      enableRouting: true,
      registerHandlers: {
        users: true,
        products: true,
        sales: false, // Disable for simpler testing
        workflows: false // Disable for simpler testing
      }
    });
  }

  /**
   * Register Event Module with custom configuration
   */
  static forFeature(options: EventModuleOptions): DynamicModule {
    return this.register(options);
  }
}