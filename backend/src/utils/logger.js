const levels = {
  info: '\x1b[32m[INFO]\x1b[0m',
  warn: '\x1b[33m[WARN]\x1b[0m',
  error: '\x1b[31m[ERROR]\x1b[0m',
  debug: '\x1b[36m[DEBUG]\x1b[0m',
};

const formatTime = () => new Date().toISOString();

export const logger = {
  info: (message, ...args) => {
    console.log(`${formatTime()} ${levels.info} ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`${formatTime()} ${levels.warn} ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`${formatTime()} ${levels.error} ${message}`, ...args);
  },
  debug: (message, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${formatTime()} ${levels.debug} ${message}`, ...args);
    }
  },
};

