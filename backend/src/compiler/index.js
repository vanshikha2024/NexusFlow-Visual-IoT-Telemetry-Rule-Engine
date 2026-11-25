/**
 * NexusFlow Logic Compiler Module Facade (Day 9)
 */

export { NexusFlowLogicCompiler, defaultCompiler, compileWorkflow, executeWorkflow } from './logicCompiler.js';
export { ExecutionContext } from './executionContext.js';
export {
  createDataSourceObservable,
  normalizeTelemetry,
  createMovingAverageOperator,
  createThresholdOperator,
  evaluateComparison,
  createSmsAlertSink,
  resetAlertCounter,
  createMathOperator,
  evaluateMathOperation,
  createGenericSink,
  resolveHandlerFactory,
  HANDLER_FACTORIES,
} from './handlers/index.js';
