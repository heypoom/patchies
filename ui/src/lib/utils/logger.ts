export type LogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

/** Log entry structure for UI integration. */
export interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: Date;
	data?: unknown;
	nodeId?: string; // Associate logs with specific nodes
	args?: unknown[]; // Support multiple arguments for rich rendering
}

/**
 * Logger singleton for application-wide logging.
 *
 * ```typescript
 * logger.log('Starting process');
 * logger.warn('Potential issue detected');
 * logger.error('Operation failed', error);
 *
 * // Node-scoped logging
 * logger.nodeLog('node-123', 'P5 sketch loaded');
 * logger.nodeError('node-456', 'GLSL compilation failed');
 * ```
 */
export class Logger {
	private static instance: Logger | null = null;
	private logs: LogEntry[] = [];
	private maxLogs = 1000; // Keep last 1000 logs in memory
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private eventBus: any = null; // Lazy-loaded to avoid circular dependencies

	private constructor() {
		// Private constructor for singleton
	}

	private async getEventBus() {
		if (!this.eventBus) {
			// Lazy-load event bus to avoid circular dependency
			const { PatchiesEventBus } = await import('$lib/eventbus/PatchiesEventBus');
			this.eventBus = PatchiesEventBus.getInstance();
		}
		return this.eventBus;
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

	/**
	 * Log a message associated with a specific node.
	 */
	nodeLog(nodeId: string, ...args: unknown[]): void {
		this.addNodeLog(nodeId, 'log', args);
	}

	/**
	 * Log a warning associated with a specific node.
	 */
	nodeWarn(nodeId: string, ...args: unknown[]): void {
		this.addNodeLog(nodeId, 'warn', args);
	}

	/**
	 * Log an error associated with a specific node.
	 */
	nodeError(nodeId: string, ...args: unknown[]): void {
		this.addNodeLog(nodeId, 'error', args);
	}

	/**
	 * Log a debug message associated with a specific node.
	 */
	nodeDebug(nodeId: string, ...args: unknown[]): void {
		this.addNodeLog(nodeId, 'debug', args);
	}

	/**
	 * Log an info message associated with a specific node.
	 */
	nodeInfo(nodeId: string, ...args: unknown[]): void {
		this.addNodeLog(nodeId, 'info', args);
	}

	/**
	 * Add a node-scoped log entry and emit event for reactive UI.
	 */
	private addNodeLog(nodeId: string, level: LogLevel, args: unknown[]): void {
		const entry: LogEntry = {
			level,
			message: args.map((arg) => String(arg)).join(' '), // For backward compat
			timestamp: new Date(),
			nodeId,
			args // Keep raw args for rich rendering
		};

		this.logs.push(entry);

		if (this.logs.length > this.maxLogs) {
			this.logs.shift();
		}

		// Emit event for reactive UI (async, non-blocking)
		this.getEventBus().then((eventBus) => {
			if (eventBus) {
				eventBus.dispatch({
					type: 'consoleOutput',
					nodeId,
					messageType: level,
					timestamp: entry.timestamp.getTime(),
					args
				});
			}
		});

		// Still log to DevTools for debugging
		console[level](`[${nodeId}]`, ...args);
	}

	/**
	 * Get logs for a specific node.
	 */
	getNodeLogs(nodeId: string): LogEntry[] {
		return this.logs.filter((log) => log.nodeId === nodeId);
	}

	/**
	 * Clear logs for a specific node.
	 */
	clearNodeLogs(nodeId: string): void {
		this.logs = this.logs.filter((log) => log.nodeId !== nodeId);
	}

	/**
	 * Get a node-scoped logger instance.
	 * Usage: logger.ofNode(nodeId).log('message')
	 */
	ofNode(nodeId: string): NodeLogger {
		return new NodeLogger(nodeId, this);
	}
}

/**
 * Node-scoped logger that automatically includes nodeId in all log calls.
 */
class NodeLogger {
	constructor(
		private nodeId: string,
		private logger: Logger
	) {}

	log(...args: unknown[]): void {
		this.logger.nodeLog(this.nodeId, ...args);
	}

	warn(...args: unknown[]): void {
		this.logger.nodeWarn(this.nodeId, ...args);
	}

	error(...args: unknown[]): void {
		this.logger.nodeError(this.nodeId, ...args);
	}

	debug(...args: unknown[]): void {
		this.logger.nodeDebug(this.nodeId, ...args);
	}

	info(...args: unknown[]): void {
		this.logger.nodeInfo(this.nodeId, ...args);
	}
}

export const logger = Logger.getInstance();
