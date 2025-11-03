import { Injectable } from '@nestjs/common';
import { IRuleCacheService, RuleDefinition, RuleGroup } from '../interfaces/rule-definition.interface';

@Injectable()
export class RuleCacheService implements IRuleCacheService {
  private cache: Map<string, { value: any; expiry: number }> = new Map();

  async get(key: string): Promise<any> {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: any, ttl: number = 3600000): Promise<void> {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) {
      return false;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async getRule(ruleId: string): Promise<RuleDefinition | null> {
    return this.get(`rule:${ruleId}`);
  }

  async setRule(ruleId: string, rule: RuleDefinition, ttl?: number): Promise<void> {
    await this.set(`rule:${ruleId}`, rule, ttl);
  }

  async invalidateRule(ruleId: string): Promise<void> {
    await this.delete(`rule:${ruleId}`);
  }

  async getRuleGroup(groupId: string): Promise<RuleGroup | null> {
    return this.get(`group:${groupId}`);
  }

  async setRuleGroup(groupId: string, group: RuleGroup, ttl?: number): Promise<void> {
    await this.set(`group:${groupId}`, group, ttl);
  }

  async invalidateRuleGroup(groupId: string): Promise<void> {
    await this.delete(`group:${groupId}`);
  }
}