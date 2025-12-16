import {describe, it, expect, vi} from 'vitest';
import fs from 'fs';
import path from 'path';
import {createLogger, setLogger, getLogger} from '../../src/utils/logger.js';
import pino from 'pino';

describe('createLogger', () => {
  it('should create a logger with default JSON output', () => {
    const logger = createLogger({level: 'info'});
    expect(logger).toBeDefined();
    expect(logger.level).toBe('info');
  });

  it('should create a logger with debug level', () => {
    const logger = createLogger({level: 'debug'});
    expect(logger.level).toBe('debug');
  });

  it('should create a logger with warn level', () => {
    const logger = createLogger({level: 'warn'});
    expect(logger.level).toBe('warn');
  });

  it('should create a logger with error level', () => {
    const logger = createLogger({level: 'error'});
    expect(logger.level).toBe('error');
  });

  it('should create a logger with pretty printing', () => {
    const logger = createLogger({level: 'info', pretty: true});
    expect(logger).toBeDefined();
    expect(logger.level).toBe('info');
  });

  describe('file logging', () => {
    it('should create a logger with file output', () => {
      // Mock fs functions to avoid actual file I/O
      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const createWriteStreamSpy = vi.spyOn(fs, 'createWriteStream').mockReturnValue({
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      } as unknown as fs.WriteStream);

      const logger = createLogger({level: 'info', filePath: '/tmp/test.log'});
      expect(logger).toBeDefined();
      
      existsSyncSpy.mockRestore();
      createWriteStreamSpy.mockRestore();
    });

    it('should create directory if it does not exist', () => {
      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
      const createWriteStreamSpy = vi.spyOn(fs, 'createWriteStream').mockReturnValue({
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      } as unknown as fs.WriteStream);

      const logger = createLogger({level: 'info', filePath: '/tmp/nested/dir/test.log'});
      expect(logger).toBeDefined();
      expect(mkdirSyncSpy).toHaveBeenCalledWith(path.dirname('/tmp/nested/dir/test.log'), {recursive: true});
      
      existsSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      createWriteStreamSpy.mockRestore();
    });
  });
});

describe('setLogger and getLogger', () => {
  it('should set and get a custom logger', () => {
    const customLogger = pino({level: 'debug'});
    setLogger(customLogger);
    const retrieved = getLogger();
    expect(retrieved.level).toBe('debug');
  });

  it('should return the default logger initially', () => {
    const logger = getLogger();
    expect(logger).toBeDefined();
  });
});
