export type LogLevel = 'debug' | 'log' | 'warn' | 'error';

/** Log entry structure for UI integration. */
export interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: Date;
	data?: unknown;
}

/**
 * Logger singleton for application-wide logging.
 *
 * ```typescript
 * logger.log('Starting process');
 * logger.warn('Potential issue detected');
 * logger.error('Operation failed', error);
 * ```
 */
export class Logger {
	private static instance: Logger | null = null;
	private logs: LogEntry[] = [];
	private maxLogs = 1000; // Keep last 1000 logs in memory

	private constructor() {
		// Private constructor for singleton
	}

	/**
	 * Get the singleton logger instance.
	 */
	static getInstance(): Logger {
		if (Logger.instance === null) {
			Logger.instance = new Logger();
		}

		return Logger.instance;
	}

	/**
	 * Log a general informational message.
	 */
	log(message: string, data?: unknown): void {
		this.addLog('log', message, data);
		console.log(message, data !== undefined ? data : '');
	}

	/**
	 * Log a warning message.
	 */
	warn(message: string, data?: unknown): void {
		this.addLog('warn', message, data);
		console.warn(message, data !== undefined ? data : '');
	}

	/**
	 * Log an error message.
	 */
	error(message: string, data?: unknown): void {
		this.addLog('error', message, data);
		console.error(message, data !== undefined ? data : '');
	}

	/**
	 * Log a debug message (only in development).
	 */
	debug(message: string, data?: unknown): void {
		this.addLog('debug', message, data);
		console.debug(message, data !== undefined ? data : '');
	}

	/**
	 * Add a log entry to the internal log history.
	 * Keeps only the most recent maxLogs entries.
	 */
	private addLog(level: LogLevel, message: string, data?: unknown): void {
		const entry: LogEntry = {
			level,
			message,
			timestamp: new Date(),
			data
		};

		this.logs.push(entry);

		// Keep only the most recent logs
		if (this.logs.length > this.maxLogs) {
			this.logs.shift();
		}
	}

	/** Get all log entries. */
	getLogs(): LogEntry[] {
		return [...this.logs];
	}

	/** Get logs filtered by level. */
	getLogsByLevel(level: LogLevel): LogEntry[] {
		return this.logs.filter((log) => log.level === level);
	}

	/** Clear all logs. */
	clearLogs(): void {
		this.logs = [];
	}

	/**
	 * Set the maximum number of logs to keep in memory.
	 */
	setMaxLogs(max: number): void {
		this.maxLogs = max;

		if (this.logs.length > this.maxLogs) {
			this.logs = this.logs.slice(-this.maxLogs);
		}
	}
}

export const logger = Logger.getInstance();
