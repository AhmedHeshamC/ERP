import { Injectable, Logger } from '@nestjs/common';
import { IDomainEvent, IEventFilter } from '../types/event.types';

/**
 * Event Router Service
 * Implements advanced event filtering, routing, and distribution with SOLID principles
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Handles event routing and filtering only
 * - Open/Closed: Extensible through routing strategies
 * - Interface Segregation: Focused on routing operations only
 * - Dependency Inversion: Depends on abstractions for event processing
 */
@Injectable()
export class EventRouterService {
  private readonly logger = new Logger(EventRouterService.name);
  private readonly routes = new Map<string, EventRoute[]>();
  private readonly globalFilters: IEventFilter[] = [];
  private readonly routingStrategies = new Map<string, RoutingStrategy>();

  constructor() {
    // Initialize default routing strategies
    this.initializeDefaultStrategies();
  }

  /**
   * Register a route for an event type
   * @param eventType The event type to route
   * @param route The routing configuration
   */
  registerRoute(eventType: string, route: EventRoute): void {
    if (!this.routes.has(eventType)) {
      this.routes.set(eventType, []);
    }

    this.routes.get(eventType)!.push(route);
    this.logger.debug(`Registered route for ${eventType}: ${route.name}`);
  }

  /**
   * Remove a route for an event type
   * @param eventType The event type
   * @param routeName The route name to remove
   */
  removeRoute(eventType: string, routeName: string): boolean {
    const routes = this.routes.get(eventType);
    if (!routes) {
      return false;
    }

    const index = routes.findIndex(route => route.name === routeName);
    if (index === -1) {
      return false;
    }

    routes.splice(index, 1);
    this.logger.debug(`Removed route ${routeName} for ${eventType}`);
    return true;
  }

  /**
   * Add a global filter that applies to all events
   * @param filter The global filter
   */
  addGlobalFilter(filter: IEventFilter): void {
    this.globalFilters.push(filter);
    this.logger.debug('Added global filter');
  }

  /**
   * Remove a global filter
   * @param filter The filter to remove
   */
  removeGlobalFilter(filter: IEventFilter): boolean {
    const index = this.globalFilters.indexOf(filter);
    if (index === -1) {
      return false;
    }

    this.globalFilters.splice(index, 1);
    this.logger.debug('Removed global filter');
    return true;
  }

  /**
   * Register a custom routing strategy
   * @param name The strategy name
   * @param strategy The routing strategy implementation
   */
  registerRoutingStrategy(name: string, strategy: RoutingStrategy): void {
    this.routingStrategies.set(name, strategy);
    this.logger.debug(`Registered routing strategy: ${name}`);
  }

  /**
   * Route an event to matching handlers
   * @param event The domain event to route
   * @returns Array of routing results
   */
  async routeEvent(event: IDomainEvent): Promise<RoutingResult[]> {
    this.logger.debug(`Routing event: ${event.type} with ID: ${event.id}`);

    const results: RoutingResult[] = [];

    // Apply global filters first
    if (!this.passesGlobalFilters(event)) {
      this.logger.debug(`Event ${event.type} filtered out by global filters`);
      return [{
        routeName: 'global-filter',
        matched: false,
        reason: 'Filtered by global filters',
        handlers: []
      }];
    }

    // Get routes for this event type
    const routes = this.routes.get(event.type) || [];

    for (const route of routes) {
      try {
        const result = await this.processRoute(event, route);
        results.push(result);
      } catch (error) {
        this.logger.error(`Error processing route ${route.name} for event ${event.type}:`, error);
        results.push({
          routeName: route.name,
          matched: false,
          reason: `Route processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          handlers: []
        });
      }
    }

    this.logger.debug(`Event ${event.type} routed to ${results.filter(r => r.matched).length} routes`);
    return results;
  }

  /**
   * Get routes for an event type
   * @param eventType The event type
   * @returns Array of routes
   */
  getRoutes(eventType: string): EventRoute[] {
    return this.routes.get(eventType) || [];
  }

  /**
   * Get all registered routes
   * @returns Map of event types to routes
   */
  getAllRoutes(): Map<string, EventRoute[]> {
    return new Map(this.routes);
  }

  /**
   * Check if an event matches any routes
   * @param event The domain event
   * @returns True if event has matching routes
   */
  hasMatchingRoutes(event: IDomainEvent): boolean {
    const routes = this.routes.get(event.type) || [];
    return routes.some(route => this.matchesRoute(event, route));
  }

  /**
   * Create a composite filter from multiple filters
   * @param filters Array of filters
   * @param operator Logical operator ('AND' | 'OR')
   * @returns Composite filter
   */
  createCompositeFilter(filters: IEventFilter[], operator: 'AND' | 'OR' = 'AND'): IEventFilter {
    return {
      customFilter: (event: IDomainEvent) => {
        if (operator === 'AND') {
          return filters.every(filter => this.matchesFilter(event, filter));
        } else {
          return filters.some(filter => this.matchesFilter(event, filter));
        }
      }
    };
  }

  /**
   * Create a time-based filter
   * @param startTime Start time (inclusive)
   * @param endTime End time (inclusive)
   * @returns Time-based filter
   */
  createTimeFilter(startTime: Date, endTime: Date): IEventFilter {
    return {
      customFilter: (event: IDomainEvent) => {
        return event.occurredAt >= startTime && event.occurredAt <= endTime;
      }
    };
  }

  /**
   * Create a correlation-based filter
   * @param correlationId The correlation ID to match
   * @returns Correlation filter
   */
  createCorrelationFilter(correlationId: string): IEventFilter {
    return {
      customFilter: (event: IDomainEvent) => {
        return event.correlationId === correlationId;
      }
    };
  }

  /**
   * Process a single route
   * @param event The domain event
   * @param route The route configuration
   * @returns Routing result
   */
  private async processRoute(event: IDomainEvent, route: EventRoute): Promise<RoutingResult> {
    // Check if event matches route filter
    if (!this.matchesRoute(event, route)) {
      return {
        routeName: route.name,
        matched: false,
        reason: 'Event does not match route filter',
        handlers: []
      };
    }

    // Get handlers based on routing strategy
    const strategy = this.routingStrategies.get(route.strategy);
    if (!strategy) {
      return {
        routeName: route.name,
        matched: false,
        reason: `Unknown routing strategy: ${route.strategy}`,
        handlers: []
      };
    }

    try {
      const handlers = await strategy.selectHandlers(event, route);
      return {
        routeName: route.name,
        matched: true,
        handlers,
        metadata: route.metadata
      };
    } catch (error) {
      return {
        routeName: route.name,
        matched: false,
        reason: `Strategy execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        handlers: []
      };
    }
  }

  /**
   * Check if event matches a route
   * @param event The domain event
   * @param route The route configuration
   * @returns True if event matches route
   */
  private matchesRoute(event: IDomainEvent, route: EventRoute): boolean {
    if (!route.filter) {
      return true;
    }

    return this.matchesFilter(event, route.filter);
  }

  /**
   * Check if event matches a filter
   * @param event The domain event
   * @param filter The filter to apply
   * @returns True if event matches filter
   */
  private matchesFilter(event: IDomainEvent, filter: IEventFilter): boolean {
    // Check aggregate type filter
    if (filter.aggregateType && event.aggregateType !== filter.aggregateType) {
      return false;
    }

    // Check version filter
    if (filter.version) {
      if (Array.isArray(filter.version)) {
        if (!filter.version.includes(event.version)) {
          return false;
        }
      } else if (event.version !== filter.version) {
        return false;
      }
    }

    // Check metadata filter
    if (filter.metadata) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (event.metadata[key] !== value) {
          return false;
        }
      }
    }

    // Check custom filter
    if (filter.customFilter && !filter.customFilter(event)) {
      return false;
    }

    return true;
  }

  /**
   * Check if event passes global filters
   * @param event The domain event
   * @returns True if event passes all global filters
   */
  private passesGlobalFilters(event: IDomainEvent): boolean {
    return this.globalFilters.every(filter => this.matchesFilter(event, filter));
  }

  /**
   * Initialize default routing strategies
   */
  private initializeDefaultStrategies(): void {
    // Broadcast strategy - send to all handlers
    this.registerRoutingStrategy('broadcast', new BroadcastRoutingStrategy());

    // Round-robin strategy - distribute load evenly
    this.registerRoutingStrategy('round-robin', new RoundRobinRoutingStrategy());

    // Priority-based strategy - send to highest priority handlers first
    this.registerRoutingStrategy('priority', new PriorityRoutingStrategy());

    // Load-balanced strategy - send to least loaded handler
    this.registerRoutingStrategy('load-balanced', new LoadBalancedRoutingStrategy());

    this.logger.debug('Initialized default routing strategies');
  }
}

/**
 * Event route configuration
 */
export interface EventRoute {
  /** Unique route name */
  name: string;
  /** Event filter for this route */
  filter?: IEventFilter;
  /** Routing strategy name */
  strategy: string;
  /** Handler configuration */
  handlers: HandlerConfiguration[];
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Route priority (higher = more priority) */
  priority?: number;
  /** Whether route is active */
  active?: boolean;
}

/**
 * Handler configuration
 */
export interface HandlerConfiguration {
  /** Handler identifier */
  id: string;
  /** Handler name/type */
  name: string;
  /** Handler priority */
  priority?: number;
  /** Maximum concurrent executions */
  maxConcurrency?: number;
  /** Handler metadata */
  metadata?: Record<string, any>;
  /** Whether handler is active */
  active?: boolean;
}

/**
 * Routing result
 */
export interface RoutingResult {
  /** Route name */
  routeName: string;
  /** Whether event matched the route */
  matched: boolean;
  /** Reason for not matching (if applicable) */
  reason?: string;
  /** Selected handlers */
  handlers: HandlerConfiguration[];
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Routing strategy interface
 */
export interface RoutingStrategy {
  /**
   * Select handlers for an event based on strategy
   * @param event The domain event
   * @param route The route configuration
   * @returns Array of selected handlers
   */
  selectHandlers(event: IDomainEvent, route: EventRoute): Promise<HandlerConfiguration[]>;
}

/**
 * Broadcast routing strategy - sends to all active handlers
 */
class BroadcastRoutingStrategy implements RoutingStrategy {
  async selectHandlers(_event: IDomainEvent, route: EventRoute): Promise<HandlerConfiguration[]> {
    return route.handlers.filter(handler => handler.active !== false);
  }
}

/**
 * Round-robin routing strategy - distributes events evenly
 */
class RoundRobinRoutingStrategy implements RoutingStrategy {
  private counters = new Map<string, number>();

  async selectHandlers(_event: IDomainEvent, route: EventRoute): Promise<HandlerConfiguration[]> {
    const activeHandlers = route.handlers.filter(handler => handler.active !== false);
    if (activeHandlers.length === 0) {
      return [];
    }

    const counterKey = route.name;
    const currentCount = this.counters.get(counterKey) || 0;
    const selectedHandler = activeHandlers[currentCount % activeHandlers.length];

    this.counters.set(counterKey, currentCount + 1);

    return [selectedHandler];
  }
}

/**
 * Priority routing strategy - sends to highest priority handlers
 */
class PriorityRoutingStrategy implements RoutingStrategy {
  async selectHandlers(_event: IDomainEvent, route: EventRoute): Promise<HandlerConfiguration[]> {
    return route.handlers
      .filter(handler => handler.active !== false)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
}

/**
 * Load-balanced routing strategy - sends to least loaded handler
 */
class LoadBalancedRoutingStrategy implements RoutingStrategy {
  private handlerLoads = new Map<string, number>();

  async selectHandlers(_event: IDomainEvent, route: EventRoute): Promise<HandlerConfiguration[]> {
    const activeHandlers = route.handlers.filter(handler => handler.active !== false);
    if (activeHandlers.length === 0) {
      return [];
    }

    // Find handler with minimum load
    let selectedHandler = activeHandlers[0];
    let minLoad = this.handlerLoads.get(selectedHandler.id) || 0;

    for (const handler of activeHandlers) {
      const load = this.handlerLoads.get(handler.id) || 0;
      if (load < minLoad) {
        selectedHandler = handler;
        minLoad = load;
      }
    }

    // Increment load for selected handler
    this.handlerLoads.set(selectedHandler.id, minLoad + 1);

    // Decrement load after processing (simulated)
    setTimeout(() => {
      const currentLoad = this.handlerLoads.get(selectedHandler.id) || 0;
      this.handlerLoads.set(selectedHandler.id, Math.max(0, currentLoad - 1));
    }, 1000);

    return [selectedHandler];
  }
}