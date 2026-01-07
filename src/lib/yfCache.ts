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
  const { ttl = 5 * 60 * 1000, forceRefresh = false } = options; // Default 5 min TTL
  const cacheKey = getCacheKey(symbol, period1, period2, interval);

  // Check memory cache first
  if (!forceRefresh) {
    const memCached = MEMORY_CACHE.get(cacheKey);
    if (memCached && Date.now() < memCached.expiry) {
      logger.debug(`Memory cache HIT for ${symbol}`);
      return memCached.data;
    }

    // Check disk cache
    const diskCached = await readFromDisk(cacheKey);
    if (diskCached) {
      // Populate memory cache
      MEMORY_CACHE.set(cacheKey, { data: diskCached, expiry: Date.now() + ttl });
      return diskCached;
    }
  }

  // Fetch fresh data
  logger.debug(`Fetching fresh data for ${symbol}`);
  const data = await fetchChart(symbol, period1, period2, interval);

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

export async function getHistorical(
  symbol: string,
  startDate: Date,
  endDate: Date,
  options: CacheOptions = {}
): Promise<any[]> {
  return getChartQuotes(symbol, startDate, endDate, '1d', options);
}

export async function getHistoricalWithFallback(
  symbol: string,
  startDate: Date,
  endDate: Date,
  options: CacheOptions = {}
): Promise<any[]> {
  return getChartQuotesWithFallback(symbol, startDate, endDate, '1d', options);
}
