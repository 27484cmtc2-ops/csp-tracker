import { useState, useMemo } from "react";

const USD_CAD = 1.391;

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtShort = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const SAMPLE_TICKERS = [
  { ticker: "AAPL", price: 213, iv: 28 },
  { ticker: "TSLA", price: 435, iv: 47 },
  { ticker: "SPY",  price: 600, iv: 15 },
  { ticker: "AMD",  price: 118, iv: 55 },
  { ticker: "NVDA", price: 135, iv: 38 },
  { ticker: "MSFT", price: 470, iv: 24 },
  { ticker: "QQQ",  price: 530, iv: 18 },
  { ticker: "COIN", price: 260, iv: 85 },
  { ticker: "RDDT", price: 185, iv: 52 },
  { ticker: "MU",   price: 1054, iv: 42 },
];

function normCDF(x) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return 0.5 * (1 + sign * y);
}

function bsPut(S, K, T, r, sigma) {
  const d1 = (Math.log(S/K) + (r + 0.5*sigma*sigma)*T) / (sigma*Math.sqrt(T));
  const d2 = d1 - sigma*Math.sqrt(T);
  return K*Math.exp(-r*T)*normCDF(-d2) - S*normCDF(-d1);
}

function getDelta(S, K, T, r, sigma) {
  const d1 = (Math.log(S/K) + (r + 0.5*sigma*sigma)*T) / (sigma*Math.sqrt(T));
  return Math.abs(normCDF(-d1));
}

function generateStrikes(ticker, targetUSD) {
  const S = ticker.price, sigma = ticker.iv/100, T = 30/365, r = 0.05;
  return [0.97, 0.95, 0.92, 0.90, 0.85].map(pct => {
    const K = Math.round(S * pct);
    const premium = bsPut(S, K, T, r, sigma);
    const delta = getDelta(S, K, T, r, sigma);
    const contracts = premium > 0 ? Math.ceil(targetUSD / (premium * 100)) : null;
    const collateral = contracts ? K * 100 * contracts : null;
    return {
      strike: K,
      otmPct: Math.round((1 - K/S) * 100),
      premium, delta, contracts, collateral,
      premiumTotal: contracts ? premium * 100 * contracts : 0,
    };
  });
}

const DEFAULT_TRADES = [
  { id:1, ticker:"BAC",  strike:48,  longStrike:null, expiry:"2026-06-26", premium:0.50, contracts:2, status:"closed", opened:"2026-05-27", type:"CSP",            costToClose:27,  pnl:73,  creditTotal:null },
  { id:2, ticker:"MCD",  strike:270, longStrike:null, expiry:"2026-06-26", premium:3.35, contracts:1, status:"closed", opened:"2026-05-28", type:"CSP",            costToClose:174, pnl:161, creditTotal:null },
  { id:3, ticker:"NVDA", strike:200, longStrike:null, expiry:"2026-07-17", premium:5.75, contracts:1, status:"open",   opened:"2026-05-29", type:"CSP",            costToClose:null,pnl:null,creditTotal:null },
  { id:4, ticker:"TSLA", strike:385, longStrike:375,  expiry:"2026-06-26", premium:1.77, contracts:1, status:"open",   opened:"2026-06-01", type:"385/375 Spread", costToClose:null,pnl:null,creditTotal:null },
  { id:5, ticker:"MU",   strike:880, longStrike:850,  expiry:"2026-07-02", premium:8.05, contracts:1, status:"open",   opened:"2026-06-03", type:"880/850 Spread", costToClose:null,pnl:null,creditTotal:805  },
  { id:6, ticker:"IGV",  strike:95,  longStrike:null, expiry:"2026-07-17", premium:2.65, contracts:1, status:"open",   opened:"2026-06-03", type:"CSP",            costToClose:null,pnl:null,creditTotal:null },
  { id:7, ticker:"GDX",  strike:80,  longStrike:null, expiry:"2026-07-02", premium:2.10, contracts:1, status:"open",   opened:"2026-06-03", type:"CSP",            costToClose:null,pnl:null,creditTotal:null },
  { id:8, ticker:"RDDT", strike:140, longStrike:null, expiry:"2026-07-17", premium:3.80, contracts:1, status:"open",   opened:"2026-06-08", type:"CSP",            costToClose:null,pnl:null,creditTotal:null },
];

function loadData() {
  try {
    const t = localStorage.getItem("csp_trades");
    const tgt = localStorage.getItem("csp_target");
    return {
      trades: t ? JSON.parse(t) : DEFAULT_TRADES,
      target: tgt ? parseFloat(tgt) : 500,
    };
  } catch { return { trades: DEFAULT_TRADES, target: 500 }; }
}

function saveData(trades, target) {
  try {
    localStorage.setItem("csp_trades", JSON.stringify(trades));
    localStorage.setItem("csp_target", String(target));
  } catch {}
}

export default function App() {
  const init = loadData();
  const [tab, setTab] = useState("tracker");
  const [trades, setTradesRaw] = useState(init.trades);
  const [target, setTargetRaw] = useState(init.target);
  const [selectedTicker, setSelectedTicker] = useState(SAMPLE_TICKERS[4]);
  const [newTrade, setNewTrade] = useState({ ticker:"", strike:"", longStrike:"", expiry:"", premium:"", contracts:"" });
  const [closeModal, setCloseModal] = useState(null);

  const setTrades = (t) => { setTradesRaw(t); saveData(t, target); };
  const setTarget = (v) => { setTargetRaw(v); saveData(trades, v); };

  const targetUSD = target / USD_CAD;

  const realized = useMemo(() => trades.filter(t=>t.status==="closed").reduce((s,t)=>s+(t.pnl??0),0), [trades]);
  const openPremium = useMemo(() => trades.filter(t=>t.status==="open").reduce((s,t)=>s+(t.creditTotal??(t.premium*t.contracts*100)),0), [trades]);
  const total = realized + openPremium;
  const progress = Math.min(100, (total / targetUSD) * 100);
  const strikes = useMemo(() => generateStrikes(selectedTicker, targetUSD), [selectedTicker, targetUSD]);

  const addTrade = () => {
    const { ticker, strike, longStrike, expiry, premium, contracts } = newTrade;
    if (!ticker || !strike || !premium || !contracts) return;
    const isSpread = !!longStrike;
    const ls = parseFloat(longStrike) || null;
    const ss = parseFloat(strike);
    setTrades([...trades, {
      id: Date.now(), ticker: ticker.toUpperCase(),
      strike: ss, longStrike: ls, expiry, premium: parseFloat(premium),
      contracts: parseInt(contracts), status: "open",
      opened: new Date().toISOString().split("T")[0],
      type: isSpread ? `${ss}/${ls} Spread` : "CSP",
      costToClose: null, pnl: null, creditTotal: null,
    }]);
    setNewTrade({ ticker:"", strike:"", longStrike:"", expiry:"", premium:"", contracts:"" });
  };

  const confirmClose = () => {
    if (!closeModal) return;
    const cost = parseFloat(closeModal.costToClose) || 0;
    setTrades(trades.map(t => {
      if (t.id !== closeModal.id) return t;
      const col = t.creditTotal ?? (t.premium * t.contracts * 100);
      return { ...t, status:"closed", costToClose:cost, pnl:col-cost };
    }));
    setCloseModal(null);
  };

  const reopenTrade = (id) => setTrades(trades.map(t => t.id===id ? {...t,status:"open",pnl:undefined,costToClose:undefined} : t));
  const deleteTrade = (id) => setTrades(trades.filter(t => t.id!==id));

  const openTrades  = trades.filter(t => t.status==="open");
  const closedTrades= trades.filter(t => t.status==="closed");

  return (
    <div style={{minHeight:"100vh",background:"#080c10",fontFamily:"'IBM Plex Mono','Courier New',monospace",color:"#c8d8c0"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;}
        input,button{font-family:inherit;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-track{background:#0d1117;}
        ::-webkit-scrollbar-thumb{background:#2a3a2a;border-radius:2px;}
        .tab-btn{cursor:pointer;padding:7px 16px;font-size:10px;letter-spacing:.15em;text-transform:uppercase;border:1px
