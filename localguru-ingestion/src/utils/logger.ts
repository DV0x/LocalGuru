import fs from 'fs';
import path from 'path';
import { config } from '../config';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const logLevelMap: Record<string, LogLevel> = {
  'debug': LogLevel.DEBUG,
  'info': LogLevel.INFO,
  'warn': LogLevel.WARN,
  'error': LogLevel.ERROR,
};

export class Logger {
  private module: string;
  private minLevel: LogLevel;
  private logToFile: boolean;
  private logDirectory: string;
  
  constructor(module: string) {
    this.module = module;
    this.minLevel = logLevelMap[config.logging.level] || LogLevel.INFO;
    this.logToFile = config.logging.logToFile;
    this.logDirectory = config.logging.logDirectory;
    
    if (this.logToFile && !fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }
  
  private formatLog(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    
    if (config.logging.format === 'json') {
      const logEntry = {
        timestamp,
        level,
        module: this.module,
        message,
        ...(data ? { data } : {}),
      };
      
      return JSON.stringify(logEntry);
    } else {
      return `[${timestamp}] [${level.toUpperCase()}] [${this.module}] ${message}${data ? ' ' + JSON.stringify(data) : ''}`;
    }
  }
  
  private writeToFile(entry: string, level: string): void {
    if (!this.logToFile) return;
    
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDirectory, `${today}.log`);
    
    fs.appendFileSync(logFile, entry + '\n');
    
    if (level === 'error') {
      const errorLogFile = path.join(this.logDirectory, `${today}-errors.log`);
      fs.appendFileSync(errorLogFile, entry + '\n');
    }
  }
  
  debug(message: string, data?: any): void {
    if (this.minLevel <= LogLevel.DEBUG) {
      const entry = this.formatLog('debug', message, data);
      console.debug(entry);
      this.writeToFile(entry, 'debug');
    }
  }
  
  info(message: string, data?: any): void {
    if (this.minLevel <= LogLevel.INFO) {
      const entry = this.formatLog('info', message, data);
      console.info(entry);
      this.writeToFile(entry, 'info');
    }
  }
  
  warn(message: string, data?: any): void {
    if (this.minLevel <= LogLevel.WARN) {
      const entry = this.formatLog('warn', message, data);
      console.warn(entry);
      this.writeToFile(entry, 'warn');
    }
  }
  
  error(message: string, error?: Error, data?: any): void {
    if (this.minLevel <= LogLevel.ERROR) {
      const errorData = error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...data
      } : data;
      
      const entry = this.formatLog('error', message, errorData);
      console.error(entry);
      this.writeToFile(entry, 'error');
    }
  }
} 