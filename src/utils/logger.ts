import pino from 'pino';
import path from 'path';
import fs from 'fs';

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  pretty?: boolean;
  filePath?: string;
}

/**
 * Creates a pino logger with JSON output.
 * Supports optional file logging for non-container mode.
 */
export function createLogger(config: LoggerConfig): pino.Logger {
  const {level, pretty = false, filePath} = config;

  // Base pino options
  const baseOptions: pino.LoggerOptions = {
    level,
    formatters: {
      level: (label) => ({level: label}),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // If file path specified, ensure directory exists and create multi-stream
  if (filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {recursive: true});
    }

    // Create write stream for file
    const fileStream = fs.createWriteStream(filePath, {flags: 'a'});

    // Multi-stream: stdout + file
    const streams: pino.StreamEntry[] = [
      {level, stream: process.stdout},
      {level, stream: fileStream},
    ];

    return pino(baseOptions, pino.multistream(streams));
  }

  // Console only with pretty printing
  if (pretty) {
    return pino(
      baseOptions,
      pino.transport({
        target: 'pino-pretty',
        options: {colorize: true},
      }),
    );
  }

  // Pure JSON to stdout
  return pino(baseOptions);
}

/** Default logger instance - reconfigured at startup */
let logger = pino({level: 'info'});

export function setLogger(newLogger: pino.Logger): void {
  logger = newLogger;
}

export function getLogger(): pino.Logger {
  return logger;
}

export default logger;
