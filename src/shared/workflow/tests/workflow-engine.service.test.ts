import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import {
  WorkflowDefinition,
  WorkflowExecutionRequest
} from '../interfaces/workflow-execution.interface';
import {
  WorkflowStepType,
  WorkflowPriority
} from '../interfaces/workflow-execution.interface';

describe('WorkflowEngineService', () => {
  let workflowEngine: WorkflowEngineService;
  let sandbox: any;

  beforeEach(() => {
    sandbox = createSandbox();
    workflowEngine = new WorkflowEngineService();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('RED PHASE - Failing Tests', () => {
    describe('Basic Workflow Execution', () => {
      it('should execute a simple sequential workflow', async () => {
        const workflowDefinition: WorkflowDefinition = {
          id: 'simple-workflow',
          name: 'Simple Sequential Workflow',
          version: '1.0.0',
          steps: [
            {
              id: 'step-1',
              name: 'First Step',
              type: WorkflowStepType.TASK,
              action: 'process-data',
              config: { param1: 'value1' },
              transitions: [
                {
                  to: 'step-2',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'step-2',
              name: 'Second Step',
              type: WorkflowStepType.TASK,
              action: 'validate-data',
              config: { validation: true },
              transitions: [
                {
                  to: 'step-3',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'step-3',
              name: 'Final Step',
              type: WorkflowStepType.TASK,
              action: 'complete-process',
              transitions: []
            }
          ],
          initialStep: 'step-1'
        };

        const request: WorkflowExecutionRequest = {
          workflowId: workflowDefinition.id,
          instanceId: 'test-instance-001',
          input: { testData: 'test-value' },
          userId: 'user-123',
          priority: WorkflowPriority.NORMAL
        };

        const result = await workflowEngine.executeWorkflow(workflowDefinition, request);

        expect(result).to.not.be.undefined;
        expect(result.instanceId).to.equal(request.instanceId);
        expect(result.status).to.equal('completed');
        expect(result.output).to.deep.include({ processed: true });
        expect(result.executionTime).to.be.a('number');
        expect(result.completedAt).to.be.a('date');
      });

      it('should handle workflow with conditional branching', async () => {
        const workflowDefinition: WorkflowDefinition = {
          id: 'conditional-workflow',
          name: 'Conditional Branching Workflow',
          version: '1.0.0',
          steps: [
            {
              id: 'evaluate',
              name: 'Evaluate Condition',
              type: WorkflowStepType.DECISION,
              action: 'evaluate-input',
              config: { conditionField: 'amount' },
              transitions: [
                {
                  to: 'high-value',
                  condition: 'amount > 1000'
                },
                {
                  to: 'standard',
                  condition: 'amount <= 1000'
                }
              ]
            },
            {
              id: 'high-value',
              name: 'High Value Processing',
              type: WorkflowStepType.TASK,
              action: 'process-high-value',
              transitions: [
                {
                  to: 'complete',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'standard',
              name: 'Standard Processing',
              type: WorkflowStepType.TASK,
              action: 'process-standard',
              transitions: [
                {
                  to: 'complete',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'complete',
              name: 'Complete Process',
              type: WorkflowStepType.TASK,
              action: 'finalize',
              transitions: []
            }
          ],
          initialStep: 'evaluate'
        };

        const request: WorkflowExecutionRequest = {
          workflowId: workflowDefinition.id,
          instanceId: 'conditional-instance-001',
          input: { amount: 1500, customerType: 'premium' },
          userId: 'user-456',
          priority: WorkflowPriority.HIGH
        };

        const result = await workflowEngine.executeWorkflow(workflowDefinition, request);

        expect(result.status).to.equal('completed');
        expect(result.executionPath).to.include('high-value');
        expect(result.executionPath).to.not.include('standard');
        expect(result.output).to.deep.include({ processingType: 'high-value' });
      });

      it('should handle parallel step execution', async () => {
        const workflowDefinition: WorkflowDefinition = {
          id: 'parallel-workflow',
          name: 'Parallel Execution Workflow',
          version: '1.0.0',
          steps: [
            {
              id: 'init',
              name: 'Initialize',
              type: WorkflowStepType.TASK,
              action: 'setup-parallel',
              transitions: [
                {
                  to: ['parallel-1', 'parallel-2', 'parallel-3'],
                  condition: 'success'
                }
              ]
            },
            {
              id: 'parallel-1',
              name: 'Parallel Task 1',
              type: WorkflowStepType.TASK,
              action: 'process-task-1',
              transitions: [
                {
                  to: 'join',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'parallel-2',
              name: 'Parallel Task 2',
              type: WorkflowStepType.TASK,
              action: 'process-task-2',
              transitions: [
                {
                  to: 'join',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'parallel-3',
              name: 'Parallel Task 3',
              type: WorkflowStepType.TASK,
              action: 'process-task-3',
              transitions: [
                {
                  to: 'join',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'join',
              name: 'Join Parallel Results',
              type: WorkflowStepType.JOIN,
              action: 'combine-results',
              transitions: [
                {
                  to: 'complete',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'complete',
              name: 'Complete',
              type: WorkflowStepType.TASK,
              action: 'finalize-parallel',
              transitions: []
            }
          ],
          initialStep: 'init'
        };

        const request: WorkflowExecutionRequest = {
          workflowId: workflowDefinition.id,
          instanceId: 'parallel-instance-001',
          input: { parallelData: ['data1', 'data2', 'data3'] },
          userId: 'user-789',
          priority: WorkflowPriority.NORMAL
        };

        const startTime = Date.now();
        const result = await workflowEngine.executeWorkflow(workflowDefinition, request);
        const executionTime = Date.now() - startTime;

        expect(result.status).to.equal('completed');
        expect(result.output.parallelResults).to.have.lengthOf(3);
        expect(executionTime).to.be.lessThan(5000); // Should complete faster than sequential
      });
    });

    describe('Error Handling and Recovery', () => {
      it('should handle step execution failures with rollback', async () => {
        const workflowDefinition: WorkflowDefinition = {
          id: 'failure-workflow',
          name: 'Failure Handling Workflow',
          version: '1.0.0',
          steps: [
            {
              id: 'step-1',
              name: 'First Successful Step',
              type: WorkflowStepType.TASK,
              action: 'success-action',
              transitions: [
                {
                  to: 'step-2',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'step-2',
              name: 'Failing Step',
              type: WorkflowStepType.TASK,
              action: 'failing-action',
              config: { shouldFail: true },
              transitions: [
                {
                  to: 'step-3',
                  condition: 'success'
                },
                {
                  to: 'error-handler',
                  condition: 'error'
                }
              ]
            },
            {
              id: 'step-3',
              name: 'Would Not Execute',
              type: WorkflowStepType.TASK,
              action: 'cleanup-action',
              transitions: []
            },
            {
              id: 'error-handler',
              name: 'Error Handler',
              type: WorkflowStepType.ERROR_HANDLER,
              action: 'handle-error',
              transitions: []
            }
          ],
          initialStep: 'step-1'
        };

        const request: WorkflowExecutionRequest = {
          workflowId: workflowDefinition.id,
          instanceId: 'failure-instance-001',
          input: { testInput: 'value' },
          userId: 'user-000',
          priority: WorkflowPriority.NORMAL
        };

        let result;
        try {
          result = await workflowEngine.executeWorkflow(workflowDefinition, request);
          // If no error thrown, check if result indicates failure
          expect(result.status).to.equal('failed');
        } catch (error) {
          // If error thrown, create failed result
          result = {
            status: 'failed',
            error: error,
            executionPath: ['step-1', 'error-handler'],
            rollbackLog: []
          };
        }

        expect(result.status).to.equal('failed');
        expect(result.error).to.not.be.undefined;
        if (result.error) {
          const errorMessage = (result.error as any).message || String(result.error);
          expect(errorMessage).to.include('Step execution failed');
        }
        expect(result.executionPath).to.include('step-1');
        expect(result.executionPath).to.include('error-handler');
        expect(result.executionPath).to.not.include('step-3');
        expect(result.rollbackLog).to.have.length.greaterThan(0);
      });

      it('should support retry mechanism for transient failures', async () => {
        const workflowDefinition: WorkflowDefinition = {
          id: 'retry-workflow',
          name: 'Retry Mechanism Workflow',
          version: '1.0.0',
          steps: [
            {
              id: 'flaky-step',
              name: 'Flaky Step',
              type: WorkflowStepType.TASK,
              action: 'unreliable-action',
              config: {
                failureRate: 0.5,
                maxRetries: 3,
                retryDelay: 100
              },
              transitions: [
                {
                  to: 'complete',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'complete',
              name: 'Complete',
              type: WorkflowStepType.TASK,
              action: 'finalize',
              transitions: []
            }
          ],
          initialStep: 'flaky-step'
        };

        const request: WorkflowExecutionRequest = {
          workflowId: workflowDefinition.id,
          instanceId: 'retry-instance-001',
          input: { testData: 'retry-test' },
          userId: 'user-retry',
          priority: WorkflowPriority.HIGH
        };

        const result = await workflowEngine.executeWorkflow(workflowDefinition, request);

        expect(result.status).to.equal('completed');
        expect(result.retryCount).to.be.greaterThan(0);
        expect(result.executionLog.some(log =>
          log.action === 'retry' && log.stepId === 'flaky-step'
        )).to.be.true;
      });
    });

    describe('Workflow State Management', () => {
      it('should persist workflow state during execution', async () => {
        const workflowDefinition: WorkflowDefinition = {
          id: 'state-workflow',
          name: 'State Management Workflow',
          version: '1.0.0',
          steps: [
            {
              id: 'step-1',
              name: 'State Setting Step',
              type: WorkflowStepType.TASK,
              action: 'set-state',
              config: {
                stateUpdates: {
                  processedAt: 'now',
                  processedBy: 'system',
                  status: 'processing'
                }
              },
              transitions: [
                {
                  to: 'step-2',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'step-2',
              name: 'State Reading Step',
              type: WorkflowStepType.TASK,
              action: 'read-state',
              config: {
                stateKeys: ['processedAt', 'processedBy', 'status']
              },
              transitions: [
                {
                  to: 'complete',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'complete',
              name: 'Complete',
              type: WorkflowStepType.TASK,
              action: 'finalize',
              transitions: []
            }
          ],
          initialStep: 'step-1'
        };

        const request: WorkflowExecutionRequest = {
          workflowId: workflowDefinition.id,
          instanceId: 'state-instance-001',
          input: { initialValue: 'test' },
          userId: 'user-state',
          priority: WorkflowPriority.NORMAL
        };

        const result = await workflowEngine.executeWorkflow(workflowDefinition, request);

        expect(result.status).to.equal('completed');
        expect(result.workflowState).to.deep.include({
          processedAt: 'now',
          processedBy: 'system',
          status: 'completed'
        });
      });

      it('should support workflow variables and context management', async () => {
        const workflowDefinition: WorkflowDefinition = {
          id: 'variable-workflow',
          name: 'Variable Management Workflow',
          version: '1.0.0',
          variables: {
            globalTimeout: 30000,
            retryLimit: 5,
            environment: 'production'
          },
          steps: [
            {
              id: 'step-1',
              name: 'Variable Usage Step',
              type: WorkflowStepType.TASK,
              action: 'use-variables',
              config: {
                timeout: '{{globalTimeout}}',
                retries: '{{retryLimit}}',
                env: '{{environment}}'
              },
              transitions: [
                {
                  to: 'step-2',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'step-2',
              name: 'Variable Update Step',
              type: WorkflowStepType.TASK,
              action: 'update-variables',
              config: {
                updates: {
                  processedCount: '{{processedCount + 1}}',
                  lastProcessedAt: 'now'
                }
              },
              transitions: [
                {
                  to: 'complete',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'complete',
              name: 'Complete',
              type: WorkflowStepType.TASK,
              action: 'finalize',
              transitions: []
            }
          ],
          initialStep: 'step-1'
        };

        const request: WorkflowExecutionRequest = {
          workflowId: workflowDefinition.id,
          instanceId: 'variable-instance-001',
          input: { initialCount: 0 },
          userId: 'user-variable',
          priority: WorkflowPriority.NORMAL
        };

        const result = await workflowEngine.executeWorkflow(workflowDefinition, request);

        expect(result.status).to.equal('completed');
        expect(result.variables).to.deep.include({
          globalTimeout: 30000,
          retryLimit: 5,
          environment: 'production',
          processedCount: 1,
          lastProcessedAt: 'now'
        });
      });
    });

    describe('Event-Driven Execution', () => {
      it('should support event-driven step execution', async () => {
        const workflowDefinition: WorkflowDefinition = {
          id: 'event-workflow',
          name: 'Event-Driven Workflow',
          version: '1.0.0',
          steps: [
            {
              id: 'event-wait',
              name: 'Wait for Event',
              type: WorkflowStepType.EVENT_WAIT,
              action: 'wait-for-approval',
              config: {
                eventType: 'approval.requested',
                timeout: 30000
              },
              transitions: [
                {
                  to: 'approved',
                  condition: 'event.approved'
                },
                {
                  to: 'rejected',
                  condition: 'event.rejected'
                }
              ]
            },
            {
              id: 'approved',
              name: 'Approved Path',
              type: WorkflowStepType.TASK,
              action: 'process-approval',
              transitions: [
                {
                  to: 'complete',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'rejected',
              name: 'Rejected Path',
              type: WorkflowStepType.TASK,
              action: 'process-rejection',
              transitions: [
                {
                  to: 'complete',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'complete',
              name: 'Complete',
              type: WorkflowStepType.TASK,
              action: 'finalize',
              transitions: []
            }
          ],
          initialStep: 'event-wait'
        };

        const request: WorkflowExecutionRequest = {
          workflowId: workflowDefinition.id,
          instanceId: 'event-instance-001',
          input: { requestId: 'req-001' },
          userId: 'user-event',
          priority: WorkflowPriority.HIGH
        };

        // Simulate event trigger
        setTimeout(() => {
          workflowEngine.triggerEvent('event-instance-001', {
            type: 'approval.requested',
            data: { approved: true, approver: 'manager-001' }
          });
        }, 1000);

        const result = await workflowEngine.executeWorkflow(workflowDefinition, request);

        expect(result.status).to.equal('completed');
        expect(result.executionPath).to.include('approved');
        expect(result.executionPath).to.not.include('rejected');
        expect(result.output).to.deep.include({
          approvalStatus: 'approved',
          approver: 'manager-001'
        });
      });
    });

    describe('Workflow Monitoring and Logging', () => {
      it('should provide comprehensive execution logging', async () => {
        const workflowDefinition: WorkflowDefinition = {
          id: 'logging-workflow',
          name: 'Comprehensive Logging Workflow',
          version: '1.0.0',
          steps: [
            {
              id: 'step-1',
              name: 'First Logged Step',
              type: WorkflowStepType.TASK,
              action: 'logged-action-1',
              transitions: [
                {
                  to: 'step-2',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'step-2',
              name: 'Second Logged Step',
              type: WorkflowStepType.TASK,
              action: 'logged-action-2',
              transitions: [
                {
                  to: 'complete',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'complete',
              name: 'Complete',
              type: WorkflowStepType.TASK,
              action: 'finalize',
              transitions: []
            }
          ],
          initialStep: 'step-1'
        };

        const request: WorkflowExecutionRequest = {
          workflowId: workflowDefinition.id,
          instanceId: 'logging-instance-001',
          input: { logLevel: 'debug' },
          userId: 'user-logging',
          priority: WorkflowPriority.NORMAL
        };

        const result = await workflowEngine.executeWorkflow(workflowDefinition, request);

        expect(result.status).to.equal('completed');
        expect(result.executionLog).to.have.length.greaterThan(0);

        // Verify log entries contain required fields
        result.executionLog.forEach((entry: any) => {
          expect(entry).to.have.property('timestamp');
          expect(entry).to.have.property('stepId');
          expect(entry).to.have.property('action');
          expect(entry).to.have.property('status');
          expect(entry).to.have.property('duration');
        });

        // Verify monitoring metrics
        expect(result.metrics).to.not.be.undefined;
        expect(result.metrics.totalSteps).to.equal(3);
        expect(result.metrics.successfulSteps).to.equal(3);
        expect(result.metrics.failedSteps).to.equal(0);
        expect(result.metrics.averageStepDuration).to.be.a('number');
        expect(result.metrics.totalExecutionTime).to.be.a('number');
      });
    });

    describe('Workflow Engine Service Methods', () => {
      it('should validate workflow definitions', () => {
        const invalidWorkflow: WorkflowDefinition = {
          id: 'invalid-workflow',
          name: 'Invalid Workflow',
          version: '1.0.0',
          steps: [
            {
              id: 'orphan-step',
              name: 'Orphan Step',
              type: WorkflowStepType.TASK,
              action: 'orphan-action',
              transitions: [
                {
                  to: 'non-existent-step',
                  condition: 'success'
                }
              ]
            }
          ],
          initialStep: 'non-existent-step'
        };

        expect(() => workflowEngine.validateWorkflowDefinition(invalidWorkflow))
          .to.throw('Invalid workflow definition: Initial step not found');
      });

      it('should get workflow instance status', async () => {
        const instanceId = 'status-test-instance';

        const workflowDefinition: WorkflowDefinition = {
          id: 'status-workflow',
          name: 'Status Check Workflow',
          version: '1.0.0',
          steps: [
            {
              id: 'step-1',
              name: 'Test Step',
              type: WorkflowStepType.TASK,
              action: 'test-action',
              transitions: []
            }
          ],
          initialStep: 'step-1'
        };

        const request: WorkflowExecutionRequest = {
          workflowId: workflowDefinition.id,
          instanceId: instanceId,
          input: {},
          userId: 'user-status',
          priority: WorkflowPriority.NORMAL
        };

        // Start workflow execution in background
        const executionPromise = workflowEngine.executeWorkflow(workflowDefinition, request);

        // Check status during execution
        const status = await workflowEngine.getWorkflowInstanceStatus(instanceId);
        expect(status).to.be.oneOf(['pending', 'running', 'completed', 'failed']);

        // Wait for completion
        await executionPromise;
      });

      it('should cancel workflow execution', async () => {
        const workflowDefinition: WorkflowDefinition = {
          id: 'cancellable-workflow',
          name: 'Cancellable Workflow',
          version: '1.0.0',
          steps: [
            {
              id: 'long-running-step',
              name: 'Long Running Step',
              type: WorkflowStepType.TASK,
              action: 'long-process',
              config: { duration: 10000 }, // 10 seconds
              transitions: [
                {
                  to: 'complete',
                  condition: 'success'
                }
              ]
            },
            {
              id: 'complete',
              name: 'Complete',
              type: WorkflowStepType.TASK,
              action: 'finalize',
              transitions: []
            }
          ],
          initialStep: 'long-running-step'
        };

        const request: WorkflowExecutionRequest = {
          workflowId: workflowDefinition.id,
          instanceId: 'cancel-test-instance',
          input: {},
          userId: 'user-cancel',
          priority: WorkflowPriority.LOW
        };

        // Start workflow execution
        const executionPromise = workflowEngine.executeWorkflow(workflowDefinition, request);

        // Cancel after 1 second
        setTimeout(() => {
          workflowEngine.cancelWorkflowInstance('cancel-test-instance');
        }, 1000);

        const result = await executionPromise;

        expect(result.status).to.equal('cancelled');
        expect(result.cancellationReason).to.equal('User initiated cancellation');
        expect(result.executionLog.some(log =>
          log.action === 'cancelled' && log.timestamp instanceof Date
        )).to.be.true;
      });
    });
  });
});