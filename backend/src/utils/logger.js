const levels = {
  info: '\x1b[32m[INFO]\x1b[0m',
  warn: '\x1b[33m[WARN]\x1b[0m',
  error: '\x1b[31m[ERROR]\x1b[0m',
  debug: '\x1b[36m[DEBUG]\x1b[0m',
};

const levelWeights = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const shouldLog = (targetLevel) => {
  const currentLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
  const currentWeight = levelWeights[currentLevel] !== undefined ? levelWeights[currentLevel] : 3;
  const targetWeight = levelWeights[targetLevel] || 0;
  return currentWeight >= targetWeight;
};

const formatTime = () => new Date().toISOString();

export const logger = {
  info: (message, ...args) => {
    if (!shouldLog('info')) return;
    console.log(`${formatTime()} ${levels.info} ${message}`, ...args);
  },
  warn: (message, ...args) => {
    if (!shouldLog('warn')) return;
    console.warn(`${formatTime()} ${levels.warn} ${message}`, ...args);
  },
  error: (message, ...args) => {
    if (!shouldLog('error')) return;
    console.error(`${formatTime()} ${levels.error} ${message}`, ...args);
  },
  debug: (message, ...args) => {
    if (!shouldLog('debug')) return;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${formatTime()} ${levels.debug} ${message}`, ...args);
    }
  },
};


