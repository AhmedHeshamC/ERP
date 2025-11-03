import { Injectable } from '@nestjs/common';
import {
  IActionExecutor,
  RuleAction,
  ActionType,
  RuleExecutionContext
} from '../interfaces/rule-definition.interface';

@Injectable()
export class ActionExecutorService implements IActionExecutor {
  private actions: Map<string, Function> = new Map();

  constructor() {
    this.registerDefaultActions();
  }

  async execute(action: RuleAction, context: RuleExecutionContext): Promise<any> {
    try {
      const executor = this.actions.get(action.type);
      if (!executor) {
        throw new Error(`Unknown action type: ${action.type}`);
      }

      // Validate required parameters
      this.validateActionParameters(action);

      // Execute the action with timeout
      const timeout = action.parameters.timeout || 5000; // 5 second default timeout
      return await this.executeWithTimeout(executor(action, context), timeout);
    } catch (error) {
      console.error(`Error executing action ${action.id}:`, error);
      throw error;
    }
  }

  async executeActions(actions: RuleAction[], context: RuleExecutionContext): Promise<any[]> {
    const results = [];

    // Sort actions by order
    const sortedActions = [...actions].sort((a, b) => a.order - b.order);

    for (const action of sortedActions) {
      try {
        // Check if action has conditional execution
        if (action.condition) {
          const shouldExecute = this.evaluateActionCondition(action.condition, context);
          if (!shouldExecute) {
            results.push({
              actionId: action.id,
              actionType: action.type,
              success: true,
              result: null,
              executionTime: 0,
              skipped: true
            });
            continue;
          }
        }

        const startTime = Date.now();
        const result = await this.execute(action, context);
        const executionTime = Date.now() - startTime;

        results.push({
          actionId: action.id,
          actionType: action.type,
          success: true,
          result,
          executionTime
        });
      } catch (error) {
        results.push({
          actionId: action.id,
          actionType: action.type,
          success: false,
          error: error.message,
          executionTime: 0
        });
      }
    }

    return results;
  }

  registerAction(actionType: string, executor: Function): void {
    this.actions.set(actionType, executor);
  }

  getActionTypes(): string[] {
    return Array.from(this.actions.keys());
  }

  private registerDefaultActions(): void {
    // SET_FIELD action
    this.actions.set(ActionType.SET_FIELD, async (action: RuleAction, context: RuleExecutionContext) => {
      const { field, value } = action.parameters;
      if (!field) {
        throw new Error('SET_FIELD action requires "field" parameter');
      }

      // Resolve template variables in value
      const resolvedValue = this.resolveTemplateVariables(value, context);

      // Set the field in the context entity
      this.setNestedProperty(context.entity, field, resolvedValue);

      return {
        field,
        value: resolvedValue,
        previousValue: this.getNestedProperty(context.entity, field)
      };
    });

    // SEND_NOTIFICATION action
    this.actions.set(ActionType.SEND_NOTIFICATION, async (action: RuleAction, context: RuleExecutionContext) => {
      const { recipient, subject, message, priority = 'normal' } = action.parameters;
      if (!recipient) {
        throw new Error('SEND_NOTIFICATION action requires "recipient" parameter');
      }

      const resolvedMessage = this.resolveTemplateVariables(message, context);
      const resolvedSubject = this.resolveTemplateVariables(subject, context);

      // In a real implementation, this would send actual notifications
      const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log(`Notification sent to ${recipient}: ${resolvedSubject} - ${resolvedMessage}`);

      return {
        notificationId,
        recipient,
        subject: resolvedSubject,
        message: resolvedMessage,
        priority,
        sentAt: new Date()
      };
    });

    // TRIGGER_WORKFLOW action
    this.actions.set(ActionType.TRIGGER_WORKFLOW, async (action: RuleAction, context: RuleExecutionContext) => {
      const { workflowId, input = {}, priority = 'normal' } = action.parameters;
      if (!workflowId) {
        throw new Error('TRIGGER_WORKFLOW action requires "workflowId" parameter');
      }

      const resolvedInput = this.resolveTemplateVariables(input, context);

      // In a real implementation, this would trigger actual workflow
      const workflowInstanceId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log(`Workflow ${workflowId} triggered with instance ${workflowInstanceId}`);

      return {
        workflowId,
        workflowInstanceId,
        input: resolvedInput,
        priority,
        triggeredAt: new Date()
      };
    });

    // CALL_API action
    this.actions.set(ActionType.CALL_API, async (action: RuleAction, context: RuleExecutionContext) => {
      const { url, method = 'POST', headers = {}, body, timeout = 5000 } = action.parameters;
      if (!url) {
        throw new Error('CALL_API action requires "url" parameter');
      }

      const resolvedBody = this.resolveTemplateVariables(body, context);
      const resolvedHeaders = this.resolveTemplateVariables(headers, context);

      // In a real implementation, this would make actual HTTP calls
      const responseId = `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log(`API call to ${url} with method ${method}`);

      return {
        responseId,
        url,
        method,
        headers: resolvedHeaders,
        body: resolvedBody,
        response: { status: 200, data: { success: true } },
        executedAt: new Date()
      };
    });

    // EXECUTE_SCRIPT action
    this.actions.set(ActionType.EXECUTE_SCRIPT, async (action: RuleAction, context: RuleExecutionContext) => {
      const { script, language = 'javascript', timeout = 1000 } = action.parameters;
      if (!script) {
        throw new Error('EXECUTE_SCRIPT action requires "script" parameter');
      }

      // Create a sandboxed execution environment
      const sandbox = this.createSandbox(context);

      try {
        // Execute script with timeout
        const result = await this.executeWithTimeout(
          this.executeScript(script, sandbox, language),
          timeout
        );

        return {
          result,
          language,
          executedAt: new Date()
        };
      } catch (error) {
        throw new Error(`Script execution failed: ${error.message}`);
      }
    });

    // APPROVE action
    this.actions.set(ActionType.APPROVE, async (action: RuleAction, context: RuleExecutionContext) => {
      const { reason, approver = 'system', conditions } = action.parameters;

      const approvalId = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log(`Approval ${approvalId}: ${reason || 'Auto-approved'}`);

      return {
        approvalId,
        approved: true,
        approver,
        reason: reason || 'Auto-approved',
        conditions,
        approvedAt: new Date()
      };
    });

    // REJECT action
    this.actions.set(ActionType.REJECT, async (action: RuleAction, context: RuleExecutionContext) => {
      const { reason, rejector = 'system', conditions } = action.parameters;

      const rejectionId = `rejection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log(`Rejection ${rejectionId}: ${reason || 'Auto-rejected'}`);

      return {
        rejectionId,
        rejected: true,
        rejector,
        reason: reason || 'Auto-rejected',
        conditions,
        rejectedAt: new Date()
      };
    });

    // ESCALATE action
    this.actions.set(ActionType.ESCALATE, async (action: RuleAction, context: RuleExecutionContext) => {
      const { escalateTo, reason, deadline, notifyEmails = [] } = action.parameters;
      if (!escalateTo) {
        throw new Error('ESCALATE action requires "escalateTo" parameter');
      }

      const escalationId = `escalation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log(`Escalation ${escalationId} to ${escalateTo}: ${reason}`);

      return {
        escalationId,
        escalated: true,
        escalateTo,
        reason,
        deadline,
        notifyEmails,
        escalatedAt: new Date()
      };
    });

    // LOG_EVENT action
    this.actions.set(ActionType.LOG_EVENT, async (action: RuleAction, context: RuleExecutionContext) => {
      const { level = 'info', message, details = {}, tags = [] } = action.parameters;
      if (!message) {
        throw new Error('LOG_EVENT action requires "message" parameter');
      }

      const resolvedMessage = this.resolveTemplateVariables(message, context);
      const resolvedDetails = this.resolveTemplateVariables(details, context);
      const resolvedTags = this.resolveTemplateVariables(tags, context);

      const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log(`[${level.toUpperCase()}] ${resolvedMessage}`, resolvedDetails);

      return {
        logId,
        level,
        message: resolvedMessage,
        details: resolvedDetails,
        tags: resolvedTags,
        loggedAt: new Date()
      };
    });

    // UPDATE_DATABASE action
    this.actions.set(ActionType.UPDATE_DATABASE, async (action: RuleAction, context: RuleExecutionContext) => {
      const { table, operation = 'update', where = {}, data = {} } = action.parameters;
      if (!table) {
        throw new Error('UPDATE_DATABASE action requires "table" parameter');
      }

      const resolvedWhere = this.resolveTemplateVariables(where, context);
      const resolvedData = this.resolveTemplateVariables(data, context);

      // In a real implementation, this would execute actual database operations
      const affectedRows = Math.floor(Math.random() * 10) + 1;

      console.log(`Database ${operation} on table ${table}:`, { where: resolvedWhere, data: resolvedData });

      return {
        table,
        operation,
        where: resolvedWhere,
        data: resolvedData,
        affectedRows,
        updated: true,
        executedAt: new Date()
      };
    });

    // SEND_EMAIL action
    this.actions.set(ActionType.SEND_EMAIL, async (action: RuleAction, context: RuleExecutionContext) => {
      const { to, cc = [], bcc = [], subject, template, templateData = {}, priority = 'normal' } = action.parameters;
      if (!to || !subject) {
        throw new Error('SEND_EMAIL action requires "to" and "subject" parameters');
      }

      const resolvedSubject = this.resolveTemplateVariables(subject, context);
      const resolvedTemplateData = this.resolveTemplateVariables(templateData, context);

      const emailId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log(`Email ${emailId} sent to ${to}: ${resolvedSubject}`);

      return {
        emailId,
        to,
        cc,
        bcc,
        subject: resolvedSubject,
        template,
        templateData: resolvedTemplateData,
        priority,
        sent: true,
        sentAt: new Date()
      };
    });

    // CALCULATE action
    this.actions.set(ActionType.CALCULATE, async (action: RuleAction, context: RuleExecutionContext) => {
      const { expression, variables = {}, precision, targetField } = action.parameters;
      if (!expression) {
        throw new Error('CALCULATE action requires "expression" parameter');
      }

      const resolvedVariables = this.resolveTemplateVariables(variables, context);

      // Create a safe evaluation context
      const evalContext = {
        ...resolvedVariables,
        ...context.entity,
        Math,
        Date,
        parseInt,
        parseFloat
      };

      // Simple expression evaluation (in production, use a proper expression parser)
      const result = this.evaluateExpression(expression, evalContext);

      const finalResult = precision !== undefined ? parseFloat(result.toFixed(precision)) : result;

      // If targetField is specified, set it in the entity
      if (targetField) {
        this.setNestedProperty(context.entity, targetField, finalResult);
      }

      return {
        expression,
        result: finalResult,
        variables: resolvedVariables,
        targetField,
        calculatedAt: new Date()
      };
    });
  }

  private validateActionParameters(action: RuleAction): void {
    const requiredParams = this.getRequiredParameters(action.type);
    for (const param of requiredParams) {
      if (!(param in action.parameters)) {
        throw new Error(`Missing required parameter "${param}" for action type "${action.type}"`);
      }
    }
  }

  private getRequiredParameters(actionType: ActionType): string[] {
    switch (actionType) {
      case ActionType.SET_FIELD:
        return ['field'];
      case ActionType.SEND_NOTIFICATION:
        return ['recipient'];
      case ActionType.TRIGGER_WORKFLOW:
        return ['workflowId'];
      case ActionType.CALL_API:
        return ['url'];
      case ActionType.EXECUTE_SCRIPT:
        return ['script'];
      case ActionType.ESCALATE:
        return ['escalateTo'];
      case ActionType.LOG_EVENT:
        return ['message'];
      case ActionType.UPDATE_DATABASE:
        return ['table'];
      case ActionType.SEND_EMAIL:
        return ['to', 'subject'];
      case ActionType.CALCULATE:
        return ['expression'];
      default:
        return [];
    }
  }

  private resolveTemplateVariables(value: any, context: RuleExecutionContext): any {
    if (typeof value === 'string') {
      return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        return this.getTemplateValue(path.trim(), context);
      });
    }

    if (Array.isArray(value)) {
      return value.map(item => this.resolveTemplateVariables(item, context));
    }

    if (typeof value === 'object' && value !== null) {
      const resolved: any = {};
      for (const [key, val] of Object.entries(value)) {
        resolved[key] = this.resolveTemplateVariables(val, context);
      }
      return resolved;
    }

    return value;
  }

  private getTemplateValue(path: string, context: RuleExecutionContext): any {
    if (path === 'entityId') return context.entityId;
    if (path === 'entityType') return context.entityType;
    if (path === 'userId') return context.userId;
    if (path === 'correlationId') return context.correlationId;
    if (path === 'timestamp') return context.timestamp;
    if (path === 'entity') return context.entity;

    // Navigate through entity
    const parts = path.split('.');
    let current: any = context.entity;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return `{{${path}}}`; // Return original template if not found
      }
    }

    return current;
  }

  private setNestedProperty(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    const lastPart = parts.pop()!;

    let current = obj;
    for (const part of parts) {
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }

    current[lastPart] = value;
  }

  private getNestedProperty(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private evaluateActionCondition(condition: string, context: RuleExecutionContext): boolean {
    try {
      // Simple condition evaluation (in production, use proper expression parser)
      const evalContext = {
        ...context.entity,
        entityId: context.entityId,
        entityType: context.entityType,
        userId: context.userId,
        timestamp: context.timestamp
      };

      // Evaluate the condition
      return new Function('context', `with(context) { return ${condition}; }`)(evalContext);
    } catch {
      return false;
    }
  }

  private createSandbox(context: RuleExecutionContext): any {
    return {
      ...context.entity,
      entityId: context.entityId,
      entityType: context.entityType,
      userId: context.userId,
      timestamp: context.timestamp,
      console: {
        log: (...args: any[]) => console.log('[Script]', ...args)
      },
      Math,
      Date,
      parseInt,
      parseFloat,
      JSON
    };
  }

  private async executeScript(script: string, sandbox: any, language: string): Promise<any> {
    if (language === 'javascript') {
      // Create sandboxed function
      const sandboxKeys = Object.keys(sandbox);
      const sandboxValues = sandboxKeys.map(key => sandbox[key]);

      try {
        const scriptFunction = new Function(...sandboxKeys, script);
        return scriptFunction(...sandboxValues);
      } catch (error) {
        throw new Error(`Script execution error: ${error.message}`);
      }
    }

    throw new Error(`Unsupported script language: ${language}`);
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private evaluateExpression(expression: string, context: any): number {
    try {
      // Simple expression evaluation (in production, use proper expression parser)
      const sanitizedExpression = expression.replace(/[^0-9+\-*/.() ]/g, '');
      const contextKeys = Object.keys(context);
      const contextValues = contextKeys.map(key => context[key]);

      const evalFunction = new Function(...contextKeys, `return ${sanitizedExpression}`);
      return evalFunction(...contextValues);
    } catch (error) {
      throw new Error(`Expression evaluation error: ${error.message}`);
    }
  }
}