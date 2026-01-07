import { getWorkingProxies } from './proxyFetcher';
import { logger } from './logger';
import fs from 'fs';
import path from 'path';

interface Proxy {
  host: string;
  port: number;
  protocol: 'http' | 'https';
}

let proxies: Proxy[] = [];
let currentIndex = 0;
let isInitialized = false;

const PROXY_FILE = path.join(process.cwd(), 'data', 'proxies.json');

function loadProxiesFromDisk(): Proxy[] {
  try {
    if (fs.existsSync(PROXY_FILE)) {
      const content = fs.readFileSync(PROXY_FILE, 'utf-8');
      const loaded = JSON.parse(content);
      logger.info(`Loaded ${loaded.length} proxies from disk`);
      return loaded;
    }
  } catch (error) {
    logger.debug('Could not load proxies from disk:', error);
  }
  return [];
}

function saveProxiesToDisk(proxiesToSave: Proxy[]) {
  try {
    const dir = path.dirname(PROXY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PROXY_FILE, JSON.stringify(proxiesToSave, null, 2), 'utf-8');
    logger.info(`Saved ${proxiesToSave.length} proxies to disk`);
  } catch (error) {
    logger.debug('Could not save proxies to disk:', error);
  }
}

export async function initProxyRotation() {
  if (isInitialized) return;
  
  logger.info('Initializing proxy rotation...');
  
  // Try loading from disk first
  proxies = loadProxiesFromDisk();
  
  // If no proxies on disk or very few, fetch new ones (non-blocking)
  if (proxies.length < 3) {
    // Don't await - let it run in background
    getWorkingProxies(5).then(fetched => {
      if (fetched.length > 0) {
        proxies = fetched;
        saveProxiesToDisk(proxies);
        logger.info(`Proxy rotation ready with ${proxies.length} proxies`);
      }
    }).catch(error => {
      logger.warn('Background proxy fetch failed:', error);
    });
  }
  
  isInitialized = true;
}

export function getNextProxy(): string | null {
  if (proxies.length === 0) {
    return null;
  }
  
  const proxy = proxies[currentIndex];
  currentIndex = (currentIndex + 1) % proxies.length;
  
  return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
}

export function hasProxies(): boolean {
  return proxies.length > 0;
}
