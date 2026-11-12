/**
 * NexusFlow Repositories
 *
 * This layer encapsulates data access and persistence logic.
 * Model schemas and concrete repository implementations will be registered
 * here in coordination with Rishi's database design.
 */

export class BaseRepository {
  /**
   * @param {import('mongoose').Model} [model] - Mongoose model
   */
  constructor(model = null) {
    this.model = model;
  }

  async findById(id) {
    if (!this.model) {
      throw new Error('Model is not initialized on this repository.');
    }
    return this.model.findById(id).lean();
  }

  async find(filter = {}) {
    if (!this.model) {
      throw new Error('Model is not initialized on this repository.');
    }
    return this.model.find(filter).lean();
  }

  async create(data) {
    if (!this.model) {
      throw new Error('Model is not initialized on this repository.');
    }
    return this.model.create(data);
  }

  async updateById(id, data) {
    if (!this.model) {
      throw new Error('Model is not initialized on this repository.');
    }
    return this.model.findByIdAndUpdate(id, data, { new: true }).lean();
  }

  async deleteById(id) {
    if (!this.model) {
      throw new Error('Model is not initialized on this repository.');
    }
    return this.model.findByIdAndDelete(id).lean();
  }
}

export default {
  BaseRepository,
};
