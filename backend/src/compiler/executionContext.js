import { Subject } from 'rxjs';

/**
 * NexusFlow Logic Compiler - Runtime Execution Context
 *
 * Manages reactive stream state, in-memory sensor ingestion Subjects,
 * dispatched mock alerts, emissions history, errors, and subscription lifecycles.
 */
export class ExecutionContext {
  constructor(options = {}) {
    this.contextId = options.contextId || `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.sensorSubjects = new Map();
    this.dispatchedAlerts = [];
    this.emissions = new Map(); // nodeId -> Array<any>
    this.errors = new Map(); // nodeId -> Array<Error>
    this.subscriptions = [];
    this.isDisposed = false;
  }

  /**
   * Retrieves or creates an RxJS Subject for a given sensor ID.
   *
   * @param {string} sensorId
   * @returns {import('rxjs').Subject}
   */
  getOrCreateSensorSubject(sensorId) {
    const id = sensorId || 'default-sensor';
    if (!this.sensorSubjects.has(id)) {
      this.sensorSubjects.set(id, new Subject());
    }
    return this.sensorSubjects.get(id);
  }

  /**
   * Ingests a new telemetry sample for a specific sensor.
   *
   * @param {string} sensorId
   * @param {number|Object} sample
   */
  feed(sensorId, sample) {
    if (this.isDisposed) {
      throw new Error(`Cannot feed sample into disposed ExecutionContext (${this.contextId}).`);
    }
    const subject = this.getOrCreateSensorSubject(sensorId);
    subject.next(sample);
  }

  /**
   * Records a mock alert triggered by an action/sink node.
   *
   * @param {Object} alert
   */
  recordAlert(alert) {
    this.dispatchedAlerts.push(alert);
  }

  /**
   * Returns a copy of all dispatched mock alerts.
   *
   * @returns {Array<Object>}
   */
  getAlerts() {
    return [...this.dispatchedAlerts];
  }

  /**
   * Clears dispatched alerts.
   */
  clearAlerts() {
    this.dispatchedAlerts = [];
  }

  /**
   * Records an emission produced by a node in the pipeline.
   *
   * @param {string} nodeId
   * @param {any} item
   */
  recordEmission(nodeId, item) {
    if (!nodeId) return;
    if (!this.emissions.has(nodeId)) {
      this.emissions.set(nodeId, []);
    }
    this.emissions.get(nodeId).push(item);
  }

  /**
   * Retrieves all emissions recorded for a given node.
   *
   * @param {string} nodeId
   * @returns {Array<any>}
   */
  getEmissions(nodeId) {
    return this.emissions.has(nodeId) ? [...this.emissions.get(nodeId)] : [];
  }

  /**
   * Retrieves all emissions for all nodes as an object map.
   *
   * @returns {Record<string, Array<any>>}
   */
  getAllEmissions() {
    const result = {};
    for (const [nodeId, items] of this.emissions.entries()) {
      result[nodeId] = [...items];
    }
    return result;
  }

  /**
   * Records an execution error caught in a pipeline error boundary.
   *
   * @param {string} nodeId
   * @param {Error|string} error
   */
  recordError(nodeId, error) {
    const id = nodeId || 'unknown';
    if (!this.errors.has(id)) {
      this.errors.set(id, []);
    }
    const errObj =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { message: String(error) };
    this.errors.get(id).push(errObj);
  }

  /**
   * Returns all recorded errors.
   *
   * @returns {Record<string, Array<Object>>}
   */
  getErrors() {
    const result = {};
    for (const [nodeId, errs] of this.errors.entries()) {
      result[nodeId] = [...errs];
    }
    return result;
  }

  /**
   * Checks whether any execution errors have occurred.
   *
   * @returns {boolean}
   */
  hasErrors() {
    return this.errors.size > 0;
  }

  /**
   * Registers an active subscription for lifecycle teardown.
   *
   * @param {import('rxjs').Subscription} subscription
   */
  addSubscription(subscription) {
    if (subscription && typeof subscription.unsubscribe === 'function') {
      this.subscriptions.push(subscription);
    }
  }

  /**
   * Gracefully tears down all active subscriptions and completes sensor Subjects.
   */
  dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;

    // Unsubscribe all active subscriptions
    for (const sub of this.subscriptions) {
      try {
        sub.unsubscribe();
      } catch (err) {
        // Safe disposal
      }
    }
    this.subscriptions = [];

    // Complete all Subjects
    for (const subject of this.sensorSubjects.values()) {
      try {
        subject.complete();
      } catch (err) {
        // Safe completion
      }
    }
    this.sensorSubjects.clear();
  }
}
