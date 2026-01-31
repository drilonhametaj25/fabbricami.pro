import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { config } from './environment';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  
  if (stack) {
    msg += `\n${stack}`;
  }
  
  return msg;
});

// Transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      logFormat
    ),
  }),
  
  // File transport per errori
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: combine(
      timestamp(),
      errors({ stack: true }),
      winston.format.json()
    ),
  }),
  
  // File transport per tutti i log
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: combine(
      timestamp(),
      winston.format.json()
    ),
  }),
];

// Elasticsearch transport (solo in production)
if (config.isProduction && config.logging.elasticsearchNode) {
  transports.push(
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: config.logging.elasticsearchNode,
      },
      index: 'ecommerceerp-logs',
    })
  );
}

// Logger
export const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    timestamp(),
    errors({ stack: true }),
    winston.format.json()
  ),
  transports,
  exitOnError: false,
});

// Stream per Fastify
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
