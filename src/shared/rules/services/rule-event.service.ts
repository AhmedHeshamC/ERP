import { Injectable } from '@nestjs/common';
import { IRuleEventService, RuleEvent, RuleEventType } from '../interfaces/rule-definition.interface';

@Injectable()
export class RuleEventService implements IRuleEventService {
  private listeners: Map<string, ((event: RuleEvent) => Promise<void>)[]> = new Map();

  async emit(event: RuleEvent): Promise<void> {
    const eventListeners = this.listeners.get(event.type) || [];

    await Promise.all(
      eventListeners.map(listener =>
        listener(event).catch(error =>
          console.error(`Error in event listener for ${event.type}:`, error)
        )
      )
    );
  }

  on(eventType: string, handler: (event: RuleEvent) => Promise<void>): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    this.listeners.get(eventType)!.push(handler);
  }

  off(eventType: string, handler: (event: RuleEvent) => Promise<void>): void {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      const index = eventListeners.indexOf(handler);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  async publishRuleCreated(rule: any, userId: string): Promise<void> {
    await this.emit({
      type: RuleEventType.RULE_CREATED,
      ruleId: rule.id,
      executionId: '',
      correlationId: '',
      userId,
      timestamp: new Date(),
      data: { rule },
      metadata: { eventType: 'rule_created' }
    });
  }

  async publishRuleUpdated(rule: any, userId: string): Promise<void> {
    await this.emit({
      type: RuleEventType.RULE_UPDATED,
      ruleId: rule.id,
      executionId: '',
      correlationId: '',
      userId,
      timestamp: new Date(),
      data: { rule },
      metadata: { eventType: 'rule_updated' }
    });
  }

  async publishRuleDeleted(ruleId: string, userId: string): Promise<void> {
    await this.emit({
      type: RuleEventType.RULE_DELETED,
      ruleId,
      executionId: '',
      correlationId: '',
      userId,
      timestamp: new Date(),
      data: { ruleId },
      metadata: { eventType: 'rule_deleted' }
    });
  }

  async publishRuleExecuted(result: any): Promise<void> {
    await this.emit({
      type: RuleEventType.RULE_EXECUTED,
      ruleId: result.ruleId,
      executionId: result.executionId,
      correlationId: result.correlationId,
      userId: result.userId,
      timestamp: new Date(),
      data: { result },
      metadata: { eventType: 'rule_executed' }
    });
  }
}