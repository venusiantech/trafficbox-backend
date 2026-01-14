const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class Logger {
  constructor() {
    this.logFile = path.join(logsDir, 'app.log');
    this.errorFile = path.join(logsDir, 'error.log');
    this.campaignFile = path.join(logsDir, 'campaigns.log');
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    // Normalize meta: ensure it's an object; preserve non-object by wrapping
    const safeMeta = meta && typeof meta === 'object' ? meta : (meta === undefined ? {} : { value: meta });
    const metaStr = Object.keys(safeMeta).length > 0 ? ` | Meta: ${JSON.stringify(safeMeta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
  }

  writeToFile(file, message) {
    try {
      fs.appendFileSync(file, message);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  info(message, meta = {}) {
    const formatted = this.formatMessage('info', message, meta);
    this.writeToFile(this.logFile, formatted);
    console.log(`[INFO] ${message}`, meta);
  }

  error(message, meta = {}) {
    try {
      const formatted = this.formatMessage('error', message, meta);
      this.writeToFile(this.logFile, formatted);
      this.writeToFile(this.errorFile, formatted);
      console.error(`[ERROR] ${message}`, meta);
    } catch (e) {
      // Fallback to basic console logging if logger fails
      console.error('[ERROR] Logger failure', {
        originalMessage: message,
        meta,
        loggerError: e && typeof e === 'object' ? (e.message || e) : e,
      });
    }
  }

  warn(message, meta = {}) {
    const formatted = this.formatMessage('warn', message, meta);
    this.writeToFile(this.logFile, formatted);
    console.warn(`[WARN] ${message}`, meta);
  }

  debug(message, meta = {}) {
    const formatted = this.formatMessage('debug', message, meta);
    this.writeToFile(this.logFile, formatted);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, meta);
    }
  }

  campaign(message, meta = {}) {
    const formatted = this.formatMessage('campaign', message, meta);
    this.writeToFile(this.logFile, formatted);
    this.writeToFile(this.campaignFile, formatted);
    console.log(`[CAMPAIGN] ${message}`, meta);
  }

  sync(message, meta = {}) {
    const formatted = this.formatMessage('sync', message, meta);
    this.writeToFile(this.logFile, formatted);
    console.log(`[SYNC] ${message}`, meta);
  }

  // Professional logging methods for different operations
  auth(message, meta = {}) {
    const formatted = this.formatMessage('auth', message, meta);
    this.writeToFile(this.logFile, formatted);
    console.log(`[AUTH] ${message}`, meta);
  }

  api(message, meta = {}) {
    const formatted = this.formatMessage('api', message, meta);
    this.writeToFile(this.logFile, formatted);
    console.log(`[API] ${message}`, meta);
  }

  database(message, meta = {}) {
    const formatted = this.formatMessage('database', message, meta);
    this.writeToFile(this.logFile, formatted);
    console.log(`[DATABASE] ${message}`, meta);
  }

  vendor(message, meta = {}) {
    const formatted = this.formatMessage('vendor', message, meta);
    this.writeToFile(this.logFile, formatted);
    console.log(`[VENDOR] ${message}`, meta);
  }
}

module.exports = new Logger();

