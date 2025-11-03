import { DynamicModule, Module } from '@nestjs/common';
import { WorkflowEngineService } from './services/workflow-engine.service';

@Module({})
export class WorkflowModule {
  static forRoot(): DynamicModule {
    return {
      module: WorkflowModule,
      providers: [WorkflowEngineService],
      exports: [WorkflowEngineService],
      global: true
    };
  }
}