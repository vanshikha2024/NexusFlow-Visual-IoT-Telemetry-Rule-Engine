import mongoose from 'mongoose';

const executionLogSchema = new mongoose.Schema(
  {
    nodeId: {
      type: String,
      required: true,
    },
    nodeName: {
      type: String,
      default: 'Unknown Node',
    },
    output: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
    },
    error: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const executionHistorySchema = new mongoose.Schema(
  {
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
      index: true,
    },
    workflowName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['completed', 'failed'],
      required: true,
    },
    mode: {
      type: String,
      enum: ['simulation', 'live', 'mixed'],
      default: 'simulation',
    },
    results: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    executionLog: {
      type: [executionLogSchema],
      default: [],
    },
    error: {
      type: String,
      default: '',
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'execution_history',
  }
);

executionHistorySchema.virtual('id').get(function () {
  return this._id.toString();
});

executionHistorySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

export const ExecutionHistory =
  mongoose.models.ExecutionHistory ||
  mongoose.model('ExecutionHistory', executionHistorySchema);

export default ExecutionHistory;
