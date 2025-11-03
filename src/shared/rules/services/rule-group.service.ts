import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  IRuleGroupService,
  RuleGroup,
  RuleGroupStorage,
  GroupExecutionMode,
  RuleValidationResult,
  RuleValidationError
} from '../interfaces/rule-definition.interface';
import { RuleDefinitionService } from './rule-definition.service';

@Injectable()
export class RuleGroupService implements IRuleGroupService {
  private groups: Map<string, RuleGroup> = new Map();

  constructor(private ruleDefinitionService: RuleDefinitionService) {}

  async createRuleGroup(groupData: Omit<RuleGroup, 'id'>): Promise<RuleGroup> {
    const validation = await this.validateGroup(groupData as RuleGroup);
    if (!validation.isValid) {
      throw new Error(`Invalid rule group: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const group: RuleGroup = {
      ...groupData,
      id: uuidv4()
    };

    this.groups.set(group.id, group);
    return group;
  }

  async updateRuleGroup(id: string, updates: Partial<RuleGroup>): Promise<RuleGroup> {
    const existingGroup = this.groups.get(id);
    if (!existingGroup) {
      throw new Error(`Rule group with id ${id} not found`);
    }

    const updatedGroup: RuleGroup = {
      ...existingGroup,
      ...updates,
      id: existingGroup.id // Preserve ID
    };

    const validation = await this.validateGroup(updatedGroup);
    if (!validation.isValid) {
      throw new Error(`Invalid rule group: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.groups.set(id, updatedGroup);
    return updatedGroup;
  }

  async deleteRuleGroup(id: string): Promise<void> {
    const group = this.groups.get(id);
    if (!group) {
      throw new Error(`Rule group with id ${id} not found`);
    }
    this.groups.delete(id);
  }

  async getRuleGroup(id: string): Promise<RuleGroup | null> {
    return this.groups.get(id) || null;
  }

  async getRuleGroups(): Promise<RuleGroup[]> {
    return Array.from(this.groups.values());
  }

  async addRuleToGroup(groupId: string, ruleId: string): Promise<void> {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Rule group with id ${groupId} not found`);
    }

    const rule = await this.ruleDefinitionService.getRule(ruleId);
    if (!rule) {
      throw new Error(`Rule with id ${ruleId} not found`);
    }

    if (!group.ruleIds.includes(ruleId)) {
      group.ruleIds.push(ruleId);
      this.groups.set(groupId, group);
    }
  }

  async removeRuleFromGroup(groupId: string, ruleId: string): Promise<void> {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Rule group with id ${groupId} not found`);
    }

    const index = group.ruleIds.indexOf(ruleId);
    if (index !== -1) {
      group.ruleIds.splice(index, 1);
      this.groups.set(groupId, group);
    }
  }

  async validateGroup(group: RuleGroup): Promise<RuleValidationResult> {
    const errors: RuleValidationError[] = [];
    const warnings: RuleValidationError[] = [];

    // Basic validation
    if (!group.name || group.name.trim().length === 0) {
      errors.push({
        code: 'MISSING_NAME',
        message: 'Group name is required',
        field: 'name',
        severity: 'error'
      });
    }

    if (!group.executionMode) {
      errors.push({
        code: 'MISSING_EXECUTION_MODE',
        message: 'Group execution mode is required',
        field: 'executionMode',
        severity: 'error'
      });
    }

    if (!Object.values(GroupExecutionMode).includes(group.executionMode)) {
      errors.push({
        code: 'INVALID_EXECUTION_MODE',
        message: 'Invalid execution mode',
        field: 'executionMode',
        severity: 'error'
      });
    }

    // Validate rule IDs
    if (group.ruleIds && group.ruleIds.length > 0) {
      for (const ruleId of group.ruleIds) {
        const rule = await this.ruleDefinitionService.getRule(ruleId);
        if (!rule) {
          errors.push({
            code: 'RULE_NOT_FOUND',
            message: `Rule with id ${ruleId} not found`,
            field: 'ruleIds',
            severity: 'error'
          });
        }
      }

      // Check for duplicate rule IDs
      const duplicateIds = group.ruleIds.filter((id, index) => group.ruleIds.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        errors.push({
          code: 'DUPLICATE_RULE_IDS',
          message: `Duplicate rule IDs: ${duplicateIds.join(', ')}`,
          field: 'ruleIds',
          severity: 'error'
        });
      }
    }

    // Warnings
    if (group.name && group.name.length > 100) {
      warnings.push({
        code: 'LONG_NAME',
        message: 'Group name is very long (> 100 characters)',
        field: 'name',
        severity: 'warning'
      });
    }

    if (group.ruleIds && group.ruleIds.length > 50) {
      warnings.push({
        code: 'MANY_RULES',
        message: 'Group has many rules (> 50), consider splitting into smaller groups',
        field: 'ruleIds',
        severity: 'warning'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}