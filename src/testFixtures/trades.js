export const DEFAULT_TRADES = [
  { id:1, ticker:"BAC",  strike:48,  longStrike:null, expiry:"2026-06-26", premium:0.50, contracts:2, status:"closed", opened:"2026-05-27", type:"CSP",            costToClose:27,  pnl:73,  creditTotal:null },
  { id:2, ticker:"MCD",  strike:270, longStrike:null, expiry:"2026-06-26", premium:3.35, contracts:1, status:"closed", opened:"2026-05-28", type:"CSP",            costToClose:174, pnl:161, creditTotal:null },
  { id:3, ticker:"NVDA", strike:200, longStrike:null, expiry:"2026-07-17", premium:5.75, contracts:1, status:"open",   opened:"2026-05-29", type:"CSP",            costToClose:null,pnl:null,creditTotal:null },
  { id:4, ticker:"TSLA", strike:385, longStrike:375,  expiry:"2026-06-26", premium:1.77, contracts:1, status:"open",   opened:"2026-06-01", type:"385/375 Spread", costToClose:null,pnl:null,creditTotal:null },
  { id:5, ticker:"MU",   strike:880, longStrike:850,  expiry:"2026-07-02", premium:8.05, contracts:1, status:"open",   opened:"2026-06-03", type:"880/850 Spread", costToClose:null,pnl:null,creditTotal:805  },
  { id:6, ticker:"IGV",  strike:95,  longStrike:null, expiry:"2026-07-17", premium:2.65, contracts:1, status:"open",   opened:"2026-06-03", type:"CSP",            costToClose:null,pnl:null,creditTotal:null },
  { id:7, ticker:"GDX",  strike:80,  longStrike:null, expiry:"2026-07-02", premium:2.10, contracts:1, status:"open",   opened:"2026-06-03", type:"CSP",            costToClose:null,pnl:null,creditTotal:null },
  { id:8, ticker:"RDDT", strike:140, longStrike:null, expiry:"2026-07-17", premium:3.80, contracts:1, status:"open",   opened:"2026-06-08", type:"CSP",            costToClose:null,pnl:null,creditTotal:null },
];
