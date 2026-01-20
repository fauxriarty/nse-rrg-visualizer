import { fetchChart, fetchHistorical } from './yahooFinanceDirect';
import { logger } from './logger';
import fs from 'fs';
import path from 'path';

// Use /tmp for Vercel serverless compatibility
const CACHE_ROOT = '/tmp/.cache/yf';
const MEMORY_CACHE = new Map<string, { data: any; expiry: number }>();

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  forceRefresh?: boolean;
}

interface CacheStats {
  memorySize: number;
  diskSize: number;
  entries: number;
}

// Unified TTL: fetch fresh data at most every 30 minutes to reduce rate limits
const THIRTY_MINUTES = 30 * 60 * 1000;
function getOptimalTTL(_interval: string): number {
  return THIRTY_MINUTES;
}

// Check if NSE market is open
function isMarketHours(): boolean {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000) - now.getTimezoneOffset() * 60 * 1000);
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const day = istTime.getDay();
  
  if (day === 0 || day === 6) return false; // Weekend
  const minutesToday = hours * 60 + minutes;
  return minutesToday >= 9 * 60 + 15 && minutesToday < 15 * 60 + 30; // 9:15 AM - 3:30 PM IST
}

function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_ROOT)) {
      fs.mkdirSync(CACHE_ROOT, { recursive: true });
    }
  } catch (error) {
    logger.warn('Could not create cache directory:', error);
  }
}

function getCacheKey(symbol: string, period1: Date, period2: Date, interval: string): string {
  return `${symbol}_${period1.getTime()}_${period2.getTime()}_${interval}`;
}

function getCachePath(key: string): string {
  return path.join(CACHE_ROOT, `${key}.json`);
}

async function readFromDisk(key: string): Promise<any | null> {
  try {
    const cachePath = getCachePath(key);
    if (fs.existsSync(cachePath)) {
      const content = fs.readFileSync(cachePath, 'utf-8');
      const cached = JSON.parse(content);
      
      // Check if expired
      if (cached.expiry && Date.now() < cached.expiry) {
        logger.debug(`Disk cache HIT for ${key}`);
        return cached.data;
      } else {
        logger.debug(`Disk cache EXPIRED for ${key}`);
      }
    }
  } catch (error) {
    logger.debug(`Disk cache read error for ${key}:`, error);
  }
  return null;
}

async function writeToDisk(key: string, data: any, ttl: number) {
  try {
    ensureCacheDir();
    const cachePath = getCachePath(key);
    const cached = {
      data,
      expiry: Date.now() + ttl,
      timestamp: Date.now(),
    };
    fs.writeFileSync(cachePath, JSON.stringify(cached), 'utf-8');
    logger.debug(`Wrote to disk cache: ${key}`);
  } catch (error) {
    logger.debug(`Disk cache write error for ${key}:`, error);
  }
}

export async function getChartQuotes(
  symbol: string,
  period1: Date,
  period2: Date,
  interval: '1d' | '1wk' | '1mo' | '1h' | '5m' = '1d',
  options: CacheOptions = {}
): Promise<any[]> {
  // Use optimal TTL based on interval and market status
  const ttl = options.ttl ?? getOptimalTTL(interval);
  const cacheKey = getCacheKey(symbol, period1, period2, interval);

  // Check memory cache first (fastest)
  if (!options.forceRefresh) {
    const memCached = MEMORY_CACHE.get(cacheKey);
    if (memCached && Date.now() < memCached.expiry) {
      logger.debug(`Memory cache HIT for ${symbol} (${interval})`);
      return memCached.data;
    }

    // Check disk cache
    const diskCached = await readFromDisk(cacheKey);
    if (diskCached) {
      // Repopulate memory cache for next request
      MEMORY_CACHE.set(cacheKey, { data: diskCached, expiry: Date.now() + ttl });
      logger.debug(`Disk cache HIT for ${symbol} (${interval})`);
      return diskCached;
    }
  }

  // Fetch fresh data from Yahoo Finance
  logger.info(`Fetching fresh data for ${symbol} (${interval})`);
  const data = await fetchChart(symbol, period1, period2, interval);

  // Validate data exists
  if (!data || data.length === 0) {
    logger.warn(`No data returned for ${symbol}`);
    return [];
  }

  // Store in both caches
  MEMORY_CACHE.set(cacheKey, { data, expiry: Date.now() + ttl });
  await writeToDisk(cacheKey, data, ttl);

  return data;
}

export async function getChartQuotesWithFallback(
  symbol: string,
  period1: Date,
  period2: Date,
  interval: '1d' | '1wk' | '1mo' | '1h' | '5m' = '1d',
  options: CacheOptions = {}
): Promise<any[]> {
  const cacheKey = getCacheKey(symbol, period1, period2, interval);

  try {
    return await getChartQuotes(symbol, period1, period2, interval, options);
  } catch (error: any) {
    logger.warn(`Live fetch failed for ${symbol}, trying stale cache:`, error.message);

    // Try memory cache (even if expired)
    const memCached = MEMORY_CACHE.get(cacheKey);
    if (memCached) {
      logger.info(`Using stale memory cache for ${symbol}`);
      return memCached.data;
    }

    // Try disk cache (even if expired)
    try {
      const cachePath = getCachePath(cacheKey);
      if (fs.existsSync(cachePath)) {
        const content = fs.readFileSync(cachePath, 'utf-8');
        const cached = JSON.parse(content);
        logger.info(`Using stale disk cache for ${symbol}`);
        return cached.data;
      }
    } catch (cacheError) {
      logger.debug(`Stale disk cache read failed for ${symbol}`);
    }

    // No cache available, throw original error
    throw error;
  }
}

export async function getHistoricalWithFallback(
  symbol: string,
  startDate: Date,
  endDate: Date,
  options: CacheOptions = {}
): Promise<any[]> {
  return getChartQuotesWithFallback(symbol, startDate, endDate, '1d', options);
}

// Cache statistics and management
export function getCacheStats(): CacheStats {
  let diskSize = 0;
  try {
    if (fs.existsSync(CACHE_ROOT)) {
      const files = fs.readdirSync(CACHE_ROOT);
      files.forEach(file => {
        const stats = fs.statSync(path.join(CACHE_ROOT, file));
        diskSize += stats.size;
      });
    }
  } catch (error) {
    logger.debug('Could not calculate disk cache size');
  }

  return {
    memorySize: MEMORY_CACHE.size,
    diskSize,
    entries: MEMORY_CACHE.size,
  };
}

// Clear all caches
export function clearAllCache(): void {
  MEMORY_CACHE.clear();
  try {
    if (fs.existsSync(CACHE_ROOT)) {
      const files = fs.readdirSync(CACHE_ROOT);
      files.forEach(file => {
        fs.unlinkSync(path.join(CACHE_ROOT, file));
      });
    }
  } catch (error) {
    logger.warn('Could not clear disk cache:', error);
  }
  logger.info('All caches cleared');
}

// Clear expired entries from both caches
export function clearExpiredCache(): void {
  const now = Date.now();
  let cleared = 0;
  
  // Memory cache
  for (const [key, entry] of MEMORY_CACHE.entries()) {
    if (now >= entry.expiry) {
      MEMORY_CACHE.delete(key);
      cleared++;
    }
  }

  // Disk cache
  try {
    if (fs.existsSync(CACHE_ROOT)) {
      const files = fs.readdirSync(CACHE_ROOT);
      files.forEach(file => {
        try {
          const content = fs.readFileSync(path.join(CACHE_ROOT, file), 'utf-8');
          const cached = JSON.parse(content);
          if (cached.expiry && now >= cached.expiry) {
            fs.unlinkSync(path.join(CACHE_ROOT, file));
            cleared++;
          }
        } catch (error) {
          // Ignore read errors, will be cleaned up eventually
        }
      });
    }
  } catch (error) {
    logger.debug('Could not clear expired disk cache entries');
  }

  if (cleared > 0) {
    logger.debug(`Cleared ${cleared} expired cache entries`);
  }
}

// Run cleanup periodically
setInterval(clearExpiredCache, 60 * 60 * 1000); // Every hour
