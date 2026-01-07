import { logger } from './logger';

// Bootstrap global proxy agent if HTTP_PROXY is set
export function initGlobalProxy() {
  const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  
  if (proxyUrl) {
    try {
      // Only import and setup if proxy is configured
      const globalAgent = require('global-agent');
      globalAgent.bootstrap();
      logger.info(`Global proxy initialized: ${proxyUrl}`);
    } catch (error) {
      logger.warn('Could not initialize global-agent:', error);
    }
  }
}
