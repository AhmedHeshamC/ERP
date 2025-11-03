import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  IRuleDefinitionService,
  RuleDefinition,
  RuleCategory,
  RuleValidationResult,
  RuleValidationError
} from '../interfaces/rule-definition.interface';

@Injectable()
export class RuleDefinitionService implements IRuleDefinitionService {
  private rules: Map<string, RuleDefinition> = new Map();

  async createRule(ruleData: Omit<RuleDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<RuleDefinition> {
    const validation = await this.validateRule(ruleData as RuleDefinition);
    if (!validation.isValid) {
      throw new Error(`Invalid rule definition: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const rule: RuleDefinition = {
      ...ruleData,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rules.set(rule.id, rule);
    return rule;
  }

  async updateRule(id: string, updates: Partial<RuleDefinition>): Promise<RuleDefinition> {
    const existingRule = this.rules.get(id);
    if (!existingRule) {
      throw new Error(`Rule with id ${id} not found`);
    }

    const updatedRule: RuleDefinition = {
      ...existingRule,
      ...updates,
      id: existingRule.id, // Preserve ID
      createdAt: existingRule.createdAt, // Preserve creation date
      updatedAt: new Date(),
    };

    const validation = await this.validateRule(updatedRule);
    if (!validation.isValid) {
      throw new Error(`Invalid rule definition: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.rules.set(id, updatedRule);
    return updatedRule;
  }

  async deleteRule(id: string): Promise<void> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule with id ${id} not found`);
    }
    this.rules.delete(id);
  }

  async getRule(id: string): Promise<RuleDefinition | null> {
    return this.rules.get(id) || null;
  }

  async getRules(filter?: Partial<RuleDefinition>): Promise<RuleDefinition[]> {
    const allRules = Array.from(this.rules.values());

    if (!filter) {
      return allRules;
    }

    return allRules.filter(rule => {
      return Object.entries(filter).every(([key, value]) => {
        const ruleValue = (rule as any)[key];
        if (Array.isArray(value)) {
          return value.includes(ruleValue);
        }
        return ruleValue === value;
      });
    });
  }

  async getRulesByGroup(groupId: string): Promise<RuleDefinition[]> {
    const allRules = Array.from(this.rules.values());
    return allRules.filter(rule => rule.groupId === groupId);
  }

  async getRulesByCategory(category: RuleCategory): Promise<RuleDefinition[]> {
    const allRules = Array.from(this.rules.values());
    return allRules.filter(rule => rule.category === category);
  }

  async searchRules(query: string): Promise<RuleDefinition[]> {
    const allRules = Array.from(this.rules.values());
    const lowerQuery = query.toLowerCase();

    return allRules.filter(rule =>
      rule.name.toLowerCase().includes(lowerQuery) ||
      rule.description?.toLowerCase().includes(lowerQuery) ||
      rule.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  async validateRule(rule: RuleDefinition): Promise<RuleValidationResult> {
    const errors: RuleValidationError[] = [];
    const warnings: RuleValidationError[] = [];

    // Basic validation
    if (!rule.name || rule.name.trim().length === 0) {
      errors.push({
        code: 'MISSING_NAME',
        message: 'Rule name is required',
        field: 'name',
        severity: 'error',
        ruleId: rule.id
      });
    }

    if (!rule.version || rule.version.trim().length === 0) {
      errors.push({
        code: 'MISSING_VERSION',
        message: 'Rule version is required',
        field: 'version',
        severity: 'error',
        ruleId: rule.id
      });
    }

    if (!rule.category) {
      errors.push({
        code: 'MISSING_CATEGORY',
        message: 'Rule category is required',
        field: 'category',
        severity: 'error',
        ruleId: rule.id
      });
    }

    if (!rule.createdBy || rule.createdBy.trim().length === 0) {
      errors.push({
        code: 'MISSING_CREATOR',
        message: 'Rule creator is required',
        field: 'createdBy',
        severity: 'error',
        ruleId: rule.id
      });
    }

    // Conditions validation
    if (!rule.conditions || rule.conditions.length === 0) {
      errors.push({
        code: 'MISSING_CONDITIONS',
        message: 'Rule must have at least one condition',
        field: 'conditions',
        severity: 'error',
        ruleId: rule.id
      });
    } else {
      rule.conditions.forEach((condition, index) => {
        if (!condition.field || condition.field.trim().length === 0) {
          errors.push({
            code: 'MISSING_CONDITION_FIELD',
            message: `Condition ${index + 1} must have a field`,
            field: `conditions[${index}].field`,
            severity: 'error',
            ruleId: rule.id
          });
        }

        if (!condition.operator) {
          errors.push({
            code: 'MISSING_CONDITION_OPERATOR',
            message: `Condition ${index + 1} must have an operator`,
            field: `conditions[${index}].operator`,
            severity: 'error',
            ruleId: rule.id
          });
        }

        if (condition.value === undefined && condition.operator !== 'is_null' && condition.operator !== 'is_not_null') {
          errors.push({
            code: 'MISSING_CONDITION_VALUE',
            message: `Condition ${index + 1} must have a value`,
            field: `conditions[${index}].value`,
            severity: 'error',
            ruleId: rule.id
          });
        }
      });
    }

    // Actions validation
    if (!rule.actions || rule.actions.length === 0) {
      errors.push({
        code: 'MISSING_ACTIONS',
        message: 'Rule must have at least one action',
        field: 'actions',
        severity: 'error',
        ruleId: rule.id
      });
    } else {
      rule.actions.forEach((action, index) => {
        if (!action.type) {
          errors.push({
            code: 'MISSING_ACTION_TYPE',
            message: `Action ${index + 1} must have a type`,
            field: `actions[${index}].type`,
            severity: 'error',
            ruleId: rule.id
          });
        }

        if (!action.parameters || typeof action.parameters !== 'object') {
          errors.push({
            code: 'MISSING_ACTION_PARAMETERS',
            message: `Action ${index + 1} must have parameters`,
            field: `actions[${index}].parameters`,
            severity: 'error',
            ruleId: rule.id
          });
        }

        if (typeof action.order !== 'number' || action.order < 0) {
          errors.push({
            code: 'INVALID_ACTION_ORDER',
            message: `Action ${index + 1} must have a valid order (>= 0)`,
            field: `actions[${index}].order`,
            severity: 'error',
            ruleId: rule.id
          });
        }
      });
    }

    // Priority validation
    if (typeof rule.priority !== 'number' || rule.priority < 0) {
      errors.push({
        code: 'INVALID_PRIORITY',
        message: 'Rule priority must be a non-negative number',
        field: 'priority',
        severity: 'error',
        ruleId: rule.id
      });
    }

    // Check for duplicate condition IDs
    const conditionIds = rule.conditions?.map(c => c.id).filter(Boolean) || [];
    const duplicateConditionIds = conditionIds.filter((id, index) => conditionIds.indexOf(id) !== index);
    if (duplicateConditionIds.length > 0) {
      errors.push({
        code: 'DUPLICATE_CONDITION_IDS',
        message: `Duplicate condition IDs: ${duplicateConditionIds.join(', ')}`,
        field: 'conditions',
        severity: 'error',
        ruleId: rule.id
      });
    }

    // Check for duplicate action IDs
    const actionIds = rule.actions?.map(a => a.id).filter(Boolean) || [];
    const duplicateActionIds = actionIds.filter((id, index) => actionIds.indexOf(id) !== index);
    if (duplicateActionIds.length > 0) {
      errors.push({
        code: 'DUPLICATE_ACTION_IDS',
        message: `Duplicate action IDs: ${duplicateActionIds.join(', ')}`,
        field: 'actions',
        severity: 'error',
        ruleId: rule.id
      });
    }

    // Warnings
    if (rule.name && rule.name.length > 100) {
      warnings.push({
        code: 'LONG_NAME',
        message: 'Rule name is very long (> 100 characters)',
        field: 'name',
        severity: 'warning',
        ruleId: rule.id
      });
    }

    if (rule.conditions && rule.conditions.length > 10) {
      warnings.push({
        code: 'MANY_CONDITIONS',
        message: 'Rule has many conditions (> 10), consider simplifying',
        field: 'conditions',
        severity: 'warning',
        ruleId: rule.id
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async enableRule(id: string): Promise<void> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule with id ${id} not found`);
    }

    rule.enabled = true;
    rule.updatedAt = new Date();
    this.rules.set(id, rule);
  }

  async disableRule(id: string): Promise<void> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule with id ${id} not found`);
    }

    rule.enabled = false;
    rule.updatedAt = new Date();
    this.rules.set(id, rule);
  }

  async duplicateRule(id: string, newName: string): Promise<RuleDefinition> {
    const originalRule = this.rules.get(id);
    if (!originalRule) {
      throw new Error(`Rule with id ${id} not found`);
    }

    const duplicatedRule: Omit<RuleDefinition, 'id' | 'createdAt' | 'updatedAt'> = {
      ...originalRule,
      name: newName,
      version: this.incrementVersion(originalRule.version),
    };

    return this.createRule(duplicatedRule);
  }

  async exportRules(ruleIds: string[]): Promise<string> {
    const rulesToExport = ruleIds.map(id => this.rules.get(id)).filter(Boolean) as RuleDefinition[];

    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      rules: rulesToExport
    }, null, 2);
  }

  async importRules(data: string): Promise<RuleDefinition[]> {
    try {
      const parsedData = JSON.parse(data);

      if (!parsedData.rules || !Array.isArray(parsedData.rules)) {
        throw new Error('Invalid import data format');
      }

      const importedRules: RuleDefinition[] = [];

      for (const ruleData of parsedData.rules) {
        // Remove id, createdAt, updatedAt to create new instances
        const { id, createdAt, updatedAt, ...cleanRuleData } = ruleData;

        const rule = await this.createRule(cleanRuleData);
        importedRules.push(rule);
      }

      return importedRules;
    } catch (error) {
      throw new Error(`Failed to import rules: ${error.message}`);
    }
  }

  private incrementVersion(version: string): string {
    const versionRegex = /^(\d+)\.(\d+)\.(\d+)$/;
    const match = version.match(versionRegex);

    if (!match) {
      return '1.0.1'; // Default if version format is unexpected
    }

    const [, major, minor, patch] = match.map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }
}