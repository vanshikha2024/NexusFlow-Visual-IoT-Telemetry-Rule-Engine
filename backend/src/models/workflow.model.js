import mongoose from 'mongoose';

/**
 * Node Sub-schema
 * Represents a single node on the React Flow canvas.
 */
const nodeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Node ID is required.'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Node type identifier is required.'],
      trim: true,
    },
    label: {
      type: String,
      trim: true,
    },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { _id: false }
);

/**
 * Edge Sub-schema
 * Represents a directed connection between two nodes on the canvas.
 */
const edgeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      required: [true, 'Edge source node ID is required.'],
      trim: true,
    },
    target: {
      type: String,
      required: [true, 'Edge target node ID is required.'],
      trim: true,
    },
    sourceHandle: {
      type: String,
      trim: true,
      default: null,
    },
    targetHandle: {
      type: String,
      trim: true,
      default: null,
    },
    animated: {
      type: Boolean,
      default: false,
    },
    style: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { _id: false }
);

/**
 * Workflow Root Schema
 *
 * Persisted in the dedicated 'workflows' MongoDB collection.
 * Strictly separate from the Time-Series telemetry storage.
 */
const workflowSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Workflow name is required.'],
      trim: true,
      minlength: [1, 'Workflow name cannot be empty.'],
      maxlength: [120, 'Workflow name cannot exceed 120 characters.'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Workflow description cannot exceed 500 characters.'],
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'active', 'paused', 'completed', 'archived'],
        message: 'Status must be one of: draft, active, paused, completed, archived.',
      },
      default: 'draft',
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    nodes: {
      type: [nodeSchema],
      required: [true, 'Workflow must contain at least one node.'],
      default: [],
    },
    edges: {
      type: [edgeSchema],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    collection: 'workflows', // Stored in dedicated collection, independent of telemetry time-series
  }
);

// Virtual for clean JSON id mapping
workflowSchema.virtual('id').get(function () {
  return this._id.toHexString ? this._id.toHexString() : this._id.toString();
});

workflowSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

export const Workflow =
  mongoose.models.Workflow || mongoose.model('Workflow', workflowSchema);

export default Workflow;
