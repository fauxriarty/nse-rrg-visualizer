import { logger } from './logger';

interface Proxy {
  host: string;
  port: number;
  protocol: 'http' | 'https';
}

const HARDCODED_PROXIES: Proxy[] = [
  { host: '47.88.87.129', port: 3128, protocol: 'http' },
  { host: '103.152.112.162', port: 80, protocol: 'http' },
];

async function fetchProxiesFromAPI(url: string): Promise<Proxy[]> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];
    
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    const proxies: Proxy[] = [];
    for (const line of lines) {
      const [host, port] = line.trim().split(':');
      if (host && port && !isNaN(parseInt(port))) {
        proxies.push({ host, port: parseInt(port), protocol: 'http' });
      }
    }
    return proxies;
  } catch (error) {
    logger.debug(`Proxy fetch failed from ${url}:`, error);
    return [];
  }
}

async function testProxy(proxy: Proxy, timeoutMs = 3000): Promise<boolean> {
  const proxyUrl = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/AAPL', {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    
    clearTimeout(timeout);
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function getWorkingProxies(maxProxies = 5): Promise<Proxy[]> {
  logger.info('Fetching proxies from multiple sources...');
  
  const sources = [
    'https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all',
    'https://proxylist.geonode.com/api/proxy-list?limit=50&page=1&sort_by=lastChecked&sort_type=desc',
  ];

  const proxyLists = await Promise.all(sources.map(url => fetchProxiesFromAPI(url)));
  let allProxies = [...HARDCODED_PROXIES, ...proxyLists.flat()];
  
  // Remove duplicates
  const seen = new Set<string>();
  allProxies = allProxies.filter(p => {
    const key = `${p.host}:${p.port}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  logger.info(`Found ${allProxies.length} unique proxies, testing...`);

  // Test proxies in parallel (but limit concurrency)
  const workingProxies: Proxy[] = [];
  const batchSize = 10;
  
  for (let i = 0; i < allProxies.length && workingProxies.length < maxProxies; i += batchSize) {
    const batch = allProxies.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async proxy => {
        const works = await testProxy(proxy);
        if (works) logger.debug(`✓ Working: ${proxy.host}:${proxy.port}`);
        return works ? proxy : null;
      })
    );
    
    workingProxies.push(...results.filter((p): p is Proxy => p !== null));
    
    if (workingProxies.length >= maxProxies) break;
  }

  logger.info(`Found ${workingProxies.length} working proxies`);
  return workingProxies.slice(0, maxProxies);
}
