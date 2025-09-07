// Simple logger utility with a default export so service modules can safely import it.
// Expands easily later (e.g., integrate pino/winston). For now minimal and zero-dependency.

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const levels = ['error', 'warn', 'info', 'debug'];
const levelIndex = levels.indexOf(LOG_LEVEL);

function enabled(target) {
	return levels.indexOf(target) <= levelIndex;
}

const logger = {
	error: (...args) => enabled('error') && console.error('[ERROR]', ...args),
	warn: (...args) => enabled('warn') && console.warn('[WARN]', ...args),
	info: (...args) => enabled('info') && console.log('[INFO]', ...args),
	debug: (...args) => enabled('debug') && console.debug('[DEBUG]', ...args),
};

export default logger;
