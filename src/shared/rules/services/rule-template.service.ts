import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  IRuleTemplateService,
  RuleTemplate,
  RuleCategory,
  RuleDefinition,
  RuleValidationResult,
  RuleValidationError,
  TemplateParameter
} from '../interfaces/rule-definition.interface';
import { RuleDefinitionService } from './rule-definition.service';

@Injectable()
export class RuleTemplateService implements IRuleTemplateService {
  private templates: Map<string, RuleTemplate> = new Map();

  constructor(private ruleDefinitionService: RuleDefinitionService) {}

  async createTemplate(templateData: Omit<RuleTemplate, 'id'>): Promise<RuleTemplate> {
    const validation = await this.validateTemplate(templateData as RuleTemplate);
    if (!validation.isValid) {
      throw new Error(`Invalid template: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const template: RuleTemplate = {
      ...templateData,
      id: uuidv4()
    };

    this.templates.set(template.id, template);
    return template;
  }

  async getTemplate(id: string): Promise<RuleTemplate | null> {
    return this.templates.get(id) || null;
  }

  async getTemplates(category?: RuleCategory): Promise<RuleTemplate[]> {
    const allTemplates = Array.from(this.templates.values());

    if (!category) {
      return allTemplates;
    }

    return allTemplates.filter(template => template.category === category);
  }

  async updateTemplate(id: string, updates: Partial<RuleTemplate>): Promise<RuleTemplate> {
    const existingTemplate = this.templates.get(id);
    if (!existingTemplate) {
      throw new Error(`Template with id ${id} not found`);
    }

    const updatedTemplate: RuleTemplate = {
      ...existingTemplate,
      ...updates,
      id: existingTemplate.id // Preserve ID
    };

    const validation = await this.validateTemplate(updatedTemplate);
    if (!validation.isValid) {
      throw new Error(`Invalid template: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.templates.set(id, updatedTemplate);
    return updatedTemplate;
  }

  async deleteTemplate(id: string): Promise<void> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template with id ${id} not found`);
    }
    this.templates.delete(id);
  }

  async createRuleFromTemplate(templateId: string, parameters: Record<string, any>): Promise<RuleDefinition> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template with id ${templateId} not found`);
    }

    // Validate required parameters
    const missingParams = template.parameters
      .filter(param => param.required && !(param.name in parameters))
      .map(param => param.name);

    if (missingParams.length > 0) {
      throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
    }

    // Process conditions
    const conditions = template.conditions.map(condition => {
      return {
        id: `condition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        field: condition.field,
        operator: condition.operator,
        value: this.resolveTemplateValue(condition.valueTemplate, parameters),
        dataType: condition.dataType,
        negate: false,
        parameters: {}
      };
    });

    // Process actions
    const actions = template.actions.map((action, index) => {
      const processedParameters: Record<string, any> = {};

      for (const [paramName, paramTemplate] of Object.entries(action.parameterTemplates)) {
        const param = paramTemplate as TemplateParameter;
        processedParameters[paramName] = parameters[paramName] || param.defaultValue;
      }

      return {
        id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: action.type,
        parameters: processedParameters,
        order: index + 1
      };
    });

    const rule: Omit<RuleDefinition, 'id' | 'createdAt' | 'updatedAt'> = {
      name: `${template.name} - Generated`,
      description: `Generated from template: ${template.description || template.name}`,
      version: '1.0.0',
      category: template.category,
      priority: 1,
      enabled: true,
      conditions,
      actions,
      createdBy: 'template-generator',
      tags: ['generated-from-template'],
      metadata: {
        templateId: template.id,
        templateName: template.name,
        generatedAt: new Date(),
        parameters
      }
    };

    return this.ruleDefinitionService.createRule(rule);
  }

  async validateTemplate(template: RuleTemplate): Promise<RuleValidationResult> {
    const errors: RuleValidationError[] = [];
    const warnings: RuleValidationError[] = [];

    // Basic validation
    if (!template.name || template.name.trim().length === 0) {
      errors.push({
        code: 'MISSING_NAME',
        message: 'Template name is required',
        field: 'name',
        severity: 'error'
      });
    }

    if (!template.category) {
      errors.push({
        code: 'MISSING_CATEGORY',
        message: 'Template category is required',
        field: 'category',
        severity: 'error'
      });
    }

    // Conditions validation
    if (!template.conditions || template.conditions.length === 0) {
      errors.push({
        code: 'MISSING_CONDITIONS',
        message: 'Template must have at least one condition',
        field: 'conditions',
        severity: 'error'
      });
    } else {
      template.conditions.forEach((condition, index) => {
        if (!condition.field || condition.field.trim().length === 0) {
          errors.push({
            code: 'MISSING_CONDITION_FIELD',
            message: `Condition ${index + 1} must have a field`,
            field: `conditions[${index}].field`,
            severity: 'error'
          });
        }

        if (!condition.operator) {
          errors.push({
            code: 'MISSING_CONDITION_OPERATOR',
            message: `Condition ${index + 1} must have an operator`,
            field: `conditions[${index}].operator`,
            severity: 'error'
          });
        }

        if (!condition.valueTemplate || condition.valueTemplate.trim().length === 0) {
          errors.push({
            code: 'MISSING_CONDITION_VALUE_TEMPLATE',
            message: `Condition ${index + 1} must have a value template`,
            field: `conditions[${index}].valueTemplate`,
            severity: 'error'
          });
        }

        // Validate value template syntax
        if (condition.valueTemplate) {
          const templateErrors = this.validateValueTemplate(condition.valueTemplate);
          errors.push(...templateErrors);
        }
      });
    }

    // Actions validation
    if (!template.actions || template.actions.length === 0) {
      errors.push({
        code: 'MISSING_ACTIONS',
        message: 'Template must have at least one action',
        field: 'actions',
        severity: 'error'
      });
    } else {
      template.actions.forEach((action, index) => {
        if (!action.type) {
          errors.push({
            code: 'MISSING_ACTION_TYPE',
            message: `Action ${index + 1} must have a type`,
            field: `actions[${index}].type`,
            severity: 'error'
          });
        }

        if (!action.parameterTemplates || Object.keys(action.parameterTemplates).length === 0) {
          errors.push({
            code: 'MISSING_ACTION_PARAMETER_TEMPLATES',
            message: `Action ${index + 1} must have parameter templates`,
            field: `actions[${index}].parameterTemplates`,
            severity: 'error'
          });
        }
      });
    }

    // Parameters validation
    if (template.parameters) {
      template.parameters.forEach((param, index) => {
        if (!param.name || param.name.trim().length === 0) {
          errors.push({
            code: 'MISSING_PARAMETER_NAME',
            message: `Parameter ${index + 1} must have a name`,
            field: `parameters[${index}].name`,
            severity: 'error'
          });
        }

        if (!param.type) {
          errors.push({
            code: 'MISSING_PARAMETER_TYPE',
            message: `Parameter ${index + 1} must have a type`,
            field: `parameters[${index}].type`,
            severity: 'error'
          });
        }
      });
    }

    // Check for duplicate parameter names
    const paramNames = template.parameters?.map(p => p.name) || [];
    const duplicateParams = paramNames.filter((name, index) => paramNames.indexOf(name) !== index);
    if (duplicateParams.length > 0) {
      errors.push({
        code: 'DUPLICATE_PARAMETER_NAMES',
        message: `Duplicate parameter names: ${duplicateParams.join(', ')}`,
        field: 'parameters',
        severity: 'error'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private resolveTemplateValue(template: string, parameters: Record<string, any>): any {
    // Simple template resolution
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = path.trim();
      return parameters[trimmedPath] !== undefined ? parameters[trimmedPath] : match;
    });
  }

  private validateValueTemplate(template: string): RuleValidationError[] {
    const errors: RuleValidationError[] = [];

    // Check for valid template syntax
    const templateRegex = /\{\{([^}]+)\}\}/g;
    let match;
    const usedVariables = [];

    while ((match = templateRegex.exec(template)) !== null) {
      usedVariables.push(match[1].trim());
    }

    // Check for empty template variables
    const emptyVariables = usedVariables.filter(variable => variable.length === 0);
    if (emptyVariables.length > 0) {
      errors.push({
        code: 'EMPTY_TEMPLATE_VARIABLES',
        message: 'Template contains empty variables',
        field: 'valueTemplate',
        severity: 'error'
      });
    }

    return errors;
  }
}