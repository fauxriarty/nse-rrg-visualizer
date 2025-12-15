// Define the mapping of Sector Index Symbols to their Constituent Stocks
export const SECTOR_CONSTITUENTS: Record<string, { name: string; stocks: string[] }> = {
  '^NSEBANK': {
    name: 'Bank',
    stocks: ['HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', 'KOTAKBANK.NS', 'AXISBANK.NS', 'INDUSINDBK.NS', 'BANKBARODA.NS', 'PNB.NS', 'IDFCFIRSTB.NS', 'AUBANK.NS']
  },
  '^CNXIT': {
    name: 'IT',
    stocks: ['TCS.NS', 'INFY.NS', 'HCLTECH.NS', 'WIPRO.NS', 'LTIM.NS', 'TECHM.NS', 'PERSISTENT.NS', 'MPHASIS.NS', 'LTTS.NS', 'COFORGE.NS']
  },
  '^CNXAUTO': {
    name: 'Auto',
    stocks: ['MARUTI.NS', 'TATAMOTORS.NS', 'M&M.NS', 'BAJAJ-AUTO.NS', 'EICHERMOT.NS', 'TVSMOTOR.NS', 'HEROMOTOCO.NS', 'MOTHERSON.NS', 'BOSCHLTD.NS', 'ASHOKLEY.NS']
  },
  '^CNXMETAL': {
    name: 'Metal',
    stocks: ['TATASTEEL.NS', 'HINDALCO.NS', 'JINDALSTEL.NS', 'JSWSTEEL.NS', 'VEDL.NS', 'SAIL.NS', 'NMDC.NS', 'NATIONALUM.NS', 'COALINDIA.NS', 'ADANIENT.NS']
  },
  '^CNXFMCG': {
    name: 'FMCG',
    stocks: ['ITC.NS', 'HINDUNILVR.NS', 'NESTLEIND.NS', 'BRITANNIA.NS', 'TATACONSUM.NS', 'GODREJCP.NS', 'DABUR.NS', 'MARICO.NS', 'COLPAL.NS', 'VBL.NS']
  },
  '^CNXREALTY': {
    name: 'Realty',
    stocks: [
      'DLF.NS', 'LODHA.NS', 'OBEROIRLTY.NS', 'PHOENIXLTD.NS', 'BRIGADE.NS',
      'GODREJPROP.NS', 'PRESTIGE.NS', 'SOBHA.NS', 'IBREALEST.NS', 'SUNTECK.NS'
    ]
  },
  '^CNXPSUBANK': {
    name: 'PSU Bank',
    stocks: [
      'SBIN.NS', 'BANKBARODA.NS', 'PNB.NS', 'CANBK.NS', 'UNIONBANK.NS',
      'INDIANB.NS', 'IOB.NS', 'UCOBANK.NS', 'MAHABANK.NS', 'CENTRALBK.NS'
    ]
  },
  '^CNXENERGY': {
    name: 'Energy',
    stocks: [
      'RELIANCE.NS', 'ONGC.NS', 'POWERGRID.NS', 'NTPC.NS', 'IOC.NS',
      'GAIL.NS', 'BPCL.NS', 'HPCL.NS', 'TATAPOWER.NS', 'ADANIGREEN.NS'
    ]
  },
  '^CNXINFRA': {
    name: 'Infra',
    stocks: [
      'LT.NS', 'SIEMENS.NS', 'ABB.NS', 'BEL.NS', 'IRCON.NS',
      'NBCC.NS', 'IRB.NS', 'ASHOKLEY.NS', 'ADANIPORTS.NS', 'KALPATPOWR.NS'
    ]
  },
  '^CNXPHARMA': {
    name: 'Pharma',
    stocks: [
      'SUNPHARMA.NS', 'DRREDDY.NS', 'CIPLA.NS', 'DIVISLAB.NS', 'AUROPHARMA.NS',
      'LUPIN.NS', 'ZYDUSLIFE.NS', 'ALKEM.NS', 'IPCA.NS', 'BIOCON.NS'
    ]
  },
  
  'NIFTY_FIN_SERVICE.NS': {
    name: 'Fin Serv',
    stocks: [
      'BAJFINANCE.NS', 'BAJAJFINSV.NS', 'HDFCLIFE.NS', 'HDFCAMC.NS', 'ICICIPRULI.NS',
      'SBILIFE.NS', 'LICI.NS', 'MUTHOOTFIN.NS', 'CHOLAFIN.NS', 'PFC.NS'
    ]
  }
};

// This matches the list in your main route.ts
export const SECTOR_INDICES = [
  { symbol: '^NSEBANK', name: 'Bank' },
  { symbol: '^CNXIT', name: 'IT' },
  { symbol: '^CNXAUTO', name: 'Auto' },
  { symbol: '^CNXMETAL', name: 'Metal' },
  { symbol: '^CNXFMCG', name: 'FMCG' },
  { symbol: '^CNXREALTY', name: 'Realty' },
  { symbol: '^CNXPSUBANK', name: 'PSU Bank' },
  { symbol: '^CNXENERGY', name: 'Energy' },
  { symbol: '^CNXINFRA', name: 'Infra' }, 
  { symbol: '^CNXPHARMA', name: 'Pharma' },
  { symbol: 'NIFTY_FIN_SERVICE.NS', name: 'Fin Serv' },
];
