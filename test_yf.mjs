import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });

async function testIntervals() {
  const symbol = 'RELIANCE.NS';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const period1 = yesterday.toISOString().split('T')[0];
  const period2 = today.toISOString().split('T')[0];
  
  console.log(`Testing ${symbol}\nPeriod: ${period1} to ${period2}\n`);
  
  const intervals = ['1d', '1wk', '1mo', '1m', '5m', '15m', '30m', '1h'];
  
  for (const interval of intervals) {
    try {
      const result = await yf.chart(symbol, {
        period1: period1,
        period2: period2,
        interval: interval
      });
      
      const quotes = result.quotes || [];
      console.log(`${interval.padEnd(5)} - ${quotes.length} quotes`);
      if (quotes.length > 0) {
        const first = quotes[0];
        const latest = quotes[quotes.length - 1];
        console.log(`         First: ${first.date}, Latest: ${latest.date}`);
      }
    } catch (e) {
      console.log(`${interval.padEnd(5)} - ERROR: ${e.message}`);
    }
  }
}

testIntervals().catch(console.error);
