/**
 * Splits an array into chunks of a specified size.
 *
 * @param {Array<any>} array - Source array
 * @param {number} size - Chunk size (must be >= 1)
 * @returns {Array<Array<any>>}
 */
export const chunkArray = (array, size) => {
  if (!Array.isArray(array) || size <= 0) return [array || []];
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Yields execution back to the Node.js event loop.
 * Prevents synchronous batch processing from starving other asynchronous I/O tasks.
 *
 * @returns {Promise<void>}
 */
export const yieldToEventLoop = () => {
  return new Promise((resolve) => setImmediate(resolve));
};

export default {
  chunkArray,
  yieldToEventLoop,
};

