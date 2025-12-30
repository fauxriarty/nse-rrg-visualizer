import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });

async function checkDates() {
  const symbol = 'RELIANCE.NS';
  
  // Test Dec 29-31 range
  const result = await yf.chart(symbol, {
    period1: '2025-12-29',
    period2: '2025-12-31',
    interval: '1d'
  });
  
  console.log('Daily quotes for Dec 29-31:');
  result.quotes.forEach(q => console.log(`  ${q.date}: Close=${q.close}`));
}

checkDates().catch(console.error);
