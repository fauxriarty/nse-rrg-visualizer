// Define the mapping of Sector Index Symbols to their Constituent Stocks
export const SECTOR_CONSTITUENTS: Record<string, { name: string; stocks: string[] }> = {
  '^NSEI': {
    name: 'NIFTY 50',
    stocks: [
      'ADANIENT.NS','ADANIPORTS.NS','APOLLOHOSP.NS','ASIANPAINT.NS','AXISBANK.NS',
      'BAJAJ-AUTO.NS','BAJAJFINSV.NS','BAJFINANCE.NS','BHARTIARTL.NS','BPCL.NS',
      'BRITANNIA.NS','CIPLA.NS','COALINDIA.NS','DIVISLAB.NS','DRREDDY.NS',
      'EICHERMOT.NS','GRASIM.NS','HCLTECH.NS','HDFCBANK.NS','HDFCLIFE.NS',
      'HEROMOTOCO.NS','HINDALCO.NS','HINDUNILVR.NS','ICICIBANK.NS','INDUSINDBK.NS',
      'INFY.NS','ITC.NS','JSWSTEEL.NS','KOTAKBANK.NS','LT.NS',
      'LTIM.NS','M&M.NS','MARUTI.NS','NESTLEIND.NS','NTPC.NS',
      'ONGC.NS','POWERGRID.NS','RELIANCE.NS','SBILIFE.NS','SBIN.NS',
      'SHRIRAMFIN.NS','SUNPHARMA.NS','TATACONSUM.NS','TATAMOTORS.NS','TATASTEEL.NS',
      'TCS.NS','TECHM.NS','TITAN.NS','ULTRACEMCO.NS','WIPRO.NS'
    ]
  },
  '^NSMIDCP': {
    name: 'Next 50',
    stocks: [
      'ABB.NS','ACC.NS','ADANIGREEN.NS','ADANIPOWER.NS','AMBUJACEM.NS',
      'AUROPHARMA.NS','BANKBARODA.NS','BEL.NS','BERGEPAINT.NS','BOSCHLTD.NS',
      'CANBK.NS','CHOLAFIN.NS','COLPAL.NS','DABUR.NS','DLF.NS',
      'GAIL.NS','GODREJCP.NS','HAL.NS','HAVELLS.NS','HINDPETRO.NS',
      'ICICIGI.NS','ICICIPRULI.NS','IGL.NS','INDIGO.NS','IRCTC.NS',
      'LUPIN.NS','MARICO.NS','UNITDSPR.NS','MUTHOOTFIN.NS','NAUKRI.NS',
      'PAGEIND.NS','PIDILITIND.NS','PFC.NS','RECLTD.NS','SBICARD.NS',
      'SHREECEM.NS','SIEMENS.NS','SRF.NS','TATAELXSI.NS','TATACOMM.NS',
      'TATAPOWER.NS','TVSMOTOR.NS','UBL.NS','VOLTAS.NS','ZYDUSLIFE.NS',
      'ADANIENSOL.NS','DMART.NS','HDFCAMC.NS','APOLLOTYRE.NS','ABBOTINDIA.NS'
    ]
  },
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
  { symbol: '^NSEI', name: 'NIFTY 50' },
  { symbol: '^NSMIDCP', name: 'Next 50' },
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
