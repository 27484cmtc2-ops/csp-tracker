import { useState, useMemo } from "react";
import { saveCloudData, loadCloudData } from "./cloudStorage";

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

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  const exp = new Date(dateStr + "T00:00:00");
  return Math.round((exp - today) / 86400000);
}

function daysColor(d) {
  if (d == null) return "#7f8ea3";
  if (d <= 3) return "#ff6a6a";
  if (d <= 10) return "#f59e0b";
  return "#6a9a6a";
}

function daysLabel(d) {
  if (d == null) return "—";
  if (d < 0) return "EXPIRED";
  if (d === 0) return "TODAY";
  return `${d}d`;
}

function daysBetween(start, end) {
  if (!start || !end) return null;
  const a = new Date(start + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

function getCollateral(t) {
  if (t.longStrike != null) return Math.abs(t.strike - t.longStrike) * 100 * t.contracts;
  return t.strike * 100 * t.contracts;
}

function annualizedReturn(t) {
  const collateral = getCollateral(t);
  if (!collateral) return null;
  const collected = t.creditTotal ?? (t.premium * t.contracts * 100);
  const dur = daysBetween(t.opened, t.expiry);
  if (!dur || dur <= 0) return null;
  return (collected / collateral) * (365 / dur) * 100;
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
  const [editModal, setEditModal] = useState(null);
  const [rollModal, setRollModal] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const setTrades = (t) => { setTradesRaw(t); saveData(t, target); };
  const uploadLocalToCloud = async () => {
  const confirmed = window.confirm(
    `Upload this device's ${trades.length} trades to the cloud?`
  );

  if (!confirmed) return;

  try {
    await saveCloudData(trades, target);
    window.alert("Cloud upload successful.");
  } catch (error) {
    window.alert(`Cloud upload failed: ${error.message}`);
  }
};

const downloadCloudToThisDevice = async () => {
  const confirmed = window.confirm(
    "Replace this device's local data with the cloud data?"
  );

  if (!confirmed) return;

  try {
    const cloudData = await loadCloudData();

    if (!cloudData) {
      window.alert("No cloud data found.");
      return;
    }

    setTradesRaw(cloudData.trades);
    setTargetRaw(cloudData.target);
    saveData(cloudData.trades, cloudData.target);

    window.alert("Cloud data downloaded successfully.");
  } catch (error) {
    window.alert(`Cloud download failed: ${error.message}`);
  }
};
  const targetUSD = target / USD_CAD;

  const realized = useMemo(() => trades.filter(t=>t.status==="closed").reduce((s,t)=>s+(t.pnl??0),0), [trades]);
  const openPremium = useMemo(() => trades.filter(t=>t.status==="open").reduce((s,t)=>s+(t.creditTotal??(t.premium*t.contracts*100)),0), [trades]);
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
      return { ...t, status:"closed", costToClose:cost, pnl:col-cost, closedDate:new Date().toISOString().split("T")[0] };
    }));
    setCloseModal(null);
  };

  const reopenTrade = (id) => setTrades(trades.map(t => t.id===id ? {...t,status:"open",pnl:undefined,costToClose:undefined} : t));
  const deleteTrade = (id) => setTrades(trades.filter(t => t.id!==id));

  const openEditModal = (t) =>
    setEditModal({
      id: t.id,
      ticker: t.ticker,
      strike: String(t.strike),
      longStrike: t.longStrike != null ? String(t.longStrike) : "",
      premium: String(t.premium),
      contracts: String(t.contracts),
      expiry: t.expiry || "",
    });

  const openRollModal = (t) =>
    setRollModal({
      id: t.id,
      ticker: t.ticker,
      oldStrike: String(t.strike),
      oldLongStrike: t.longStrike != null ? String(t.longStrike) : "",
      oldPremium: String(t.premium),
      contracts: String(t.contracts),
      costToClose: "",
      closeFees: "",
      newStrike: String(t.strike),
      newLongStrike: t.longStrike != null ? String(t.longStrike) : "",
      newExpiry: "",
      newPremium: "",
      openFees: "",
    });

  const openAssignModal = (t) =>
  setAssignModal({
    id: t.id,
    ticker: t.ticker,
    strike: String(t.strike),
    contracts: String(t.contracts),
    assignmentDate: new Date().toISOString().split("T")[0],
  });

  const confirmEdit = () => {
    if (!editModal) return;
    const { id, ticker, strike, longStrike, premium, contracts, expiry } = editModal;
    if (!ticker || !strike || !premium || !contracts) return;
    const ls = parseFloat(longStrike) || null;
    const ss = parseFloat(strike);
    setTrades(trades.map(t => t.id===id ? {
      ...t,
      ticker: ticker.toUpperCase(),
      strike: ss,
      longStrike: ls,
      premium: parseFloat(premium),
      contracts: parseInt(contracts),
      expiry,
      type: ls ? `${ss}/${ls} Spread` : "CSP",
      creditTotal: null,
    } : t));
    setEditModal(null);
  };
  const confirmAssignment = () => {
  if (!assignModal) return;

  const trade = trades.find((t) => t.id === assignModal.id);
  if (!trade) return;

  const contracts = parseInt(assignModal.contracts) || trade.contracts;
  const shares = contracts * 100;
  const grossStockCost = trade.strike * shares;
  const premiumApplied =
    trade.creditTotal ??
    trade.premium * trade.contracts * 100;

  const adjustedCostBasis = grossStockCost - premiumApplied;
  const adjustedCostPerShare =
    shares > 0 ? adjustedCostBasis / shares : 0;

  const wheelChainId =
    trade.wheelChainId ||
    trade.rollChainId ||
    trade.id;

  setTrades(
    trades.map((t) =>
      t.id === trade.id
        ? {
            ...t,
            status: "assigned",
            assignmentDate: assignModal.assignmentDate,
            shares,
            grossStockCost,
            premiumApplied,
            adjustedCostBasis,
            adjustedCostPerShare,
            wheelChainId,
          }
        : t
    )
  );

  setAssignModal(null);
};

  const confirmRoll = () => {
  if (!rollModal) return;

  const oldTrade = trades.find((t) => t.id === rollModal.id);
  if (!oldTrade) return;

  const contracts = parseInt(rollModal.contracts);
  const closePrice = parseFloat(rollModal.costToClose) || 0;
  const costToClose = closePrice * 100 * contracts;
  const closeFees = parseFloat(rollModal.closeFees) || 0;
  const newStrike = parseFloat(rollModal.newStrike);
  const newLongStrike = parseFloat(rollModal.newLongStrike) || null;
  const newPremium = parseFloat(rollModal.newPremium);
  const openFees = parseFloat(rollModal.openFees) || 0;

  if (!contracts || !newStrike || !rollModal.newExpiry || !newPremium) {
    window.alert("Please complete the new trade details.");
    return;
  }

  const oldCredit =
    oldTrade.creditTotal ??
    oldTrade.premium * oldTrade.contracts * 100;

  const oldPnl = oldCredit - costToClose - closeFees;
  const newCredit = newPremium * contracts * 100 - openFees;

  const rollNumber = (oldTrade.rollNumber || 0) + 1;
  const rollChainId = oldTrade.rollChainId || oldTrade.id;

  const closedOldTrade = {
    ...oldTrade,
    status: "closed",
    costToClose,
    closeFees,
    pnl: oldPnl,
    closedDate: new Date().toISOString().split("T")[0],
    rolled: true,
    rollNumber,
    rollChainId,
  };

  const newTrade = {
    id: Date.now(),
    ticker: oldTrade.ticker,
    strike: newStrike,
    longStrike: newLongStrike,
    expiry: rollModal.newExpiry,
    premium: newPremium,
    contracts,
    status: "open",
    opened: new Date().toISOString().split("T")[0],
    type: newLongStrike
      ? `${newStrike}/${newLongStrike} Spread`
      : "CSP",
    costToClose: null,
    pnl: null,
    creditTotal: newCredit,
    rolledFromId: oldTrade.id,
    rollNumber,
    rollChainId,
    rollNet: newCredit - costToClose - closeFees,
  };

  setTrades(
    trades
      .map((t) => (t.id === oldTrade.id ? closedOldTrade : t))
      .concat(newTrade)
  );

  setRollModal(null);
};
  const openTrades  = trades.filter(t => t.status==="open");
  const closedTrades= trades.filter(t => t.status==="closed");
  const assignedTrades = trades.filter(t => t.status === "assigned");

  const winningTrades = closedTrades.filter(
    (t) => (t.pnl ?? 0) > 0
  ).length;

  const winRate = closedTrades.length
    ? (winningTrades / closedTrades.length) * 100
    : 0;

  const currentCollateral = openTrades.reduce(
    (sum, trade) => sum + getCollateral(trade),
    0
  );

  const [sortBy, setSortBy] = useState("expiry");
  const [sortDir, setSortDir] = useState("asc");

  const toggleSort = (key) => {
    if (sortBy===key) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortBy(key); setSortDir("asc"); }
  };

  const sortedOpenTrades = useMemo(() => {
    const arr = [...openTrades];
    arr.sort((a,b) => {
      let av, bv;
      if (sortBy==="strike") { av=a.strike; bv=b.strike; }
      else if (sortBy==="premium") { av=a.creditTotal??(a.premium*a.contracts*100); bv=b.creditTotal??(b.premium*b.contracts*100); }
      else if (sortBy==="annualized") { av=annualizedReturn(a)??-1; bv=annualizedReturn(b)??-1; }
      else if (sortBy==="ticker") { av=a.ticker; bv=b.ticker; }
      else { av=a.expiry; bv=b.expiry; }
      if (av<bv) return sortDir==="asc"?-1:1;
      if (av>bv) return sortDir==="asc"?1:-1;
      return 0;
    });
    return arr;
  }, [openTrades, sortBy, sortDir]);

  return (
    <div style={{minHeight:"100vh",background:"#0b0f14",fontFamily:"'IBM Plex Mono','Courier New',monospace",color:"#d7e0ea"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;}
        input,button{font-family:inherit;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-track{background:#111821;}
        ::-webkit-scrollbar-thumb{background:#2a3a2a;border-radius:2px;}
        .tab-btn{cursor:pointer;padding:7px 16px;font-size:10px;letter-spacing:.15em;text-transform:uppercase;border:1px solid #1c2735;border-radius:2px;background:transparent;color:#7f8ea3;transition:all .15s;}
        .tab-btn:hover{color:#a6b3c2;border-color:#30445b;}
        .tab-btn.active{background:#223044;border-color:#4d82b8;color:#5aa9ff;}
        .row-hover:hover{background:#151f2b!important;}
        .strike-row:hover{background:#151f2b!important;cursor:pointer;}
        .csp-input{background:#0b0f14;border:1px solid #1c2735;border-radius:2px;padding:7px 10px;color:#d7e0ea;font-size:11px;outline:none;width:100%;min-width:0;box-sizing:border-box;}
        .csp-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;}
        @media (max-width:640px){
          .csp-form-grid{grid-template-columns:1fr 1fr;}
        }
        .csp-input:focus{border-color:#4d82b8;}
        .csp-panel{background:#111821;border:1px solid #223044;border-radius:4px;}
        .csp-btn{padding:7px 18px;background:#223044;border:1px solid #4d82b8;border-radius:2px;color:#5aa9ff;font-size:10px;letter-spacing:.1em;cursor:pointer;}
        .csp-btn:hover{background:#223e22;}
        .csp-btn-sm{padding:2px 8px;background:transparent;border:1px solid #30445b;border-radius:2px;color:#5aa9ff;font-size:9px;cursor:pointer;}
        .csp-btn-sm:hover{background:#0a1a0a;}
        .csp-btn-danger{border-color:#2a1a1a!important;color:#6a3a3a!important;}
        .csp-btn-danger:hover{background:#1a0a0a!important;color:#ff6a6a!important;}
        .csp-btn-blue{border-color:#1a2a4a!important;color:#60a5fa!important;}
        .csp-table-wrap{display:block;}
        .csp-cards{display:none;}
        .csp-card{background:#0e141c;border:1px solid #142214;border-radius:4px;padding:10px 12px;margin-bottom:8px;}
        .csp-card-row{display:flex;justify-content:space-between;align-items:center;font-size:11px;padding:2px 0;}
        .csp-card-label{color:#71839a;font-size:9px;letter-spacing:.08em;}
        @media (max-width:640px){
          .csp-table-wrap{display:none;}
          .csp-cards{display:block;}
        }
      `}</style>

      <div style={{maxWidth:780,margin:"0 auto",padding:"24px 16px"}}>
<div className="csp-panel" style={{padding:"16px 18px",marginBottom:16}}>
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(4,1fr)",
            gap:14
          }}>
            <div>
              <div style={{fontSize:9,color:"#7f8ea3",letterSpacing:".12em",marginBottom:5}}>
                REALIZED P&L
              </div>
              <div style={{fontSize:18,color:realized>=0?"#6fdc8c":"#ff7b7b",fontWeight:600}}>
                {fmtShort(realized)}
              </div>
            </div>

            <div>
              <div style={{fontSize:9,color:"#7f8ea3",letterSpacing:".12em",marginBottom:5}}>
                OPEN PREMIUM
              </div>
              <div style={{fontSize:18,color:"#9db6ce",fontWeight:600}}>
                {fmtShort(openPremium)}
              </div>
            </div>

            <div>
              <div style={{fontSize:9,color:"#7f8ea3",letterSpacing:".12em",marginBottom:5}}>
                WIN RATE
              </div>
              <div style={{fontSize:18,color:"#5aa9ff",fontWeight:600}}>
                {winRate.toFixed(0)}%
              </div>
              <div style={{fontSize:9,color:"#71839a",marginTop:3}}>
                {winningTrades}/{closedTrades.length} profitable
              </div>
            </div>

            <div>
              <div style={{fontSize:9,color:"#7f8ea3",letterSpacing:".12em",marginBottom:5}}>
                CURRENT COLLATERAL
              </div>
              <div style={{fontSize:18,color:"#f59e0b",fontWeight:600}}>
                {fmtShort(currentCollateral)}
              </div>
            </div>
          </div>
        </div>
<div style={{marginBottom:12}}>
  <button className="csp-btn" onClick={uploadLocalToCloud}>
    UPLOAD THIS DEVICE TO CLOUD
  </button><button
  className="csp-btn"
  onClick={downloadCloudToThisDevice}
  style={{ marginLeft: 8 }}
>
  DOWNLOAD CLOUD TO THIS DEVICE
</button>
</div>
        <div style={{display:"flex",gap:7,marginBottom:16}}>
          {["tracker","screener","strikes"].map(t=>(
            <button key={t} className={`tab-btn${tab===t?" active":""}`} onClick={()=>setTab(t)}>
              {t==="tracker"?"My Trades":t==="screener"?"Screener":"Strike Finder"}
            </button>
          ))}
        </div>

        {tab==="tracker" && (
          <div>
            <div className="csp-panel" style={{padding:14,marginBottom:14}}>
              <div style={{fontSize:9,color:"#7f8ea3",letterSpacing:".12em",marginBottom:10}}>LOG NEW TRADE</div>
              <div className="csp-form-grid" style={{marginBottom:7}}>
                <input className="csp-input" placeholder="TICKER" value={newTrade.ticker} onChange={e=>setNewTrade({...newTrade,ticker:e.target.value})} />
                <input className="csp-input" placeholder="SHORT STRIKE" value={newTrade.strike} onChange={e=>setNewTrade({...newTrade,strike:e.target.value})} />
                <input className="csp-input" placeholder="LONG STRIKE (opt)" value={newTrade.longStrike} onChange={e=>setNewTrade({...newTrade,longStrike:e.target.value})} />
              </div>
              <div className="csp-form-grid" style={{marginBottom:10}}>
                <input className="csp-input" placeholder="PREMIUM" value={newTrade.premium} onChange={e=>setNewTrade({...newTrade,premium:e.target.value})} />
                <input className="csp-input" placeholder="CONTRACTS" value={newTrade.contracts} onChange={e=>setNewTrade({...newTrade,contracts:e.target.value})} />
                <input className="csp-input" type="date" value={newTrade.expiry} onChange={e=>setNewTrade({...newTrade,expiry:e.target.value})} />
              </div>
              <button className="csp-btn" onClick={addTrade}>+ ADD TRADE</button>
            </div>

            <div className="csp-panel" style={{marginBottom:12}}>
              <div style={{padding:"10px 14px",borderBottom:"1px solid #223044",fontSize:9,color:"#7f8ea3",letterSpacing:".12em"}}>
                OPEN POSITIONS <span style={{color:"#2a5a2a"}}>({openTrades.length})</span>
              </div>
              {openTrades.length===0 && <div style={{padding:20,textAlign:"center",color:"#607086",fontSize:11}}>No open positions.</div>}
              {openTrades.length>0 && (
                <div style={{display:"flex",gap:6,flexWrap:"wrap",padding:"10px 14px",borderBottom:"1px solid #223044"}}>
                  <span style={{fontSize:9,color:"#71839a",letterSpacing:".1em",alignSelf:"center"}}>SORT</span>
                  {[["expiry","EXPIRY"],["strike","STRIKE"],["premium","PREMIUM"],["annualized","ANN%"],["ticker","TICKER"]].map(([key,label])=>(
                    <button key={key} className="csp-btn-sm" onClick={()=>toggleSort(key)}
                      style={{borderColor:sortBy===key?"#4d82b8":"#30445b",color:sortBy===key?"#5aa9ff":"#8796aa"}}>
                      {label}{sortBy===key?(sortDir==="asc"?" ↑":" ↓"):""}
                    </button>
                  ))}
                </div>
              )}
              {openTrades.length>0 && (
                <div className="csp-table-wrap" style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
                    <thead><tr>
                      {["TICKER","STRIKE","EXPIRY","DAYS","COLLECTED","ANN%","CNTS",""].map(h=>(
                        <th key={h} style={{padding:"9px 12px",textAlign:"right",color:"#71839a",fontWeight:400,fontSize:9,letterSpacing:".08em",borderBottom:"1px solid #223044"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {sortedOpenTrades.map(t=>{
                        const col = t.rolledFromId && t.rollNet != null ? t.rollNet : (t.creditTotal??(t.premium*t.contracts*100));
                        const isSpread = t.type?.includes("Spread");
                        const d = daysUntil(t.expiry);
                        return (
                          <tr key={t.id} className="row-hover" style={{borderBottom:"1px solid #151f2b"}}>
                            <td style={{padding:"9px 12px",textAlign:"right"}}>
                              <span style={{color:isSpread?"#60efff":"#5aa9ff",fontWeight:600}}>{t.ticker}</span>
                              {isSpread && <span style={{fontSize:8,color:"#60efff",marginLeft:4,padding:"1px 4px",border:"1px solid #1a3a4a",borderRadius:2}}>SPREAD</span>}
                              {isSpread && <div style={{fontSize:8,color:"#3a7a8a",marginTop:1}}>{t.type}</div>}
                            </td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#d7e0ea"}}>
                              ${t.strike}{t.longStrike&&<span style={{color:"#3a6a7a"}}>/{t.longStrike}</span>}
                            </td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#a6b3c2"}}>{t.expiry}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:daysColor(d),fontWeight:600}}>{daysLabel(d)}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#d7e0ea"}}>{fmt(col)}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#9db6ce"}}>{annualizedReturn(t)!=null?annualizedReturn(t).toFixed(0)+"%":"—"}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#d7e0ea"}}>{t.contracts}×</td>
                            <td style={{padding:"9px 12px",textAlign:"right"}}>
                              <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
                                <button className="csp-btn-sm csp-btn-blue" onClick={()=>openEditModal(t)}>EDIT</button>
                                <button className="csp-btn-sm" onClick={()=>openRollModal(t)} style={{borderColor:"#7a4a1a",color:"#f59e0b"}}>ROLL</button>
                                <button className="csp-btn-sm" onClick={()=>openAssignModal(t)} style={{borderColor:"#5a3a7a",color:"#c084fc"}}>ASSIGN</button>
                                <button className="csp-btn-sm" onClick={()=>setCloseModal({id:t.id,costToClose:""})}>CLOSE</button>
                                <button className="csp-btn-sm csp-btn-danger" onClick={()=>deleteTrade(t.id)}>DEL</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {openTrades.length>0 && (
                <div className="csp-cards" style={{padding:"10px 12px"}}>
                  {sortedOpenTrades.map(t=>{
                    const col = t.rolledFromId && t.rollNet != null ? t.rollNet : (t.creditTotal??(t.premium*t.contracts*100));
                    const isSpread = t.type?.includes("Spread");
                    const d = daysUntil(t.expiry);
                    return (
                      <div key={t.id} className="csp-card">
                        <div className="csp-card-row" style={{marginBottom:4}}>
                          <div>
                            <span style={{color:isSpread?"#60efff":"#5aa9ff",fontWeight:600,fontSize:13}}>{t.ticker}</span>
                            {isSpread && <span style={{fontSize:8,color:"#60efff",marginLeft:4,padding:"1px 4px",border:"1px solid #1a3a4a",borderRadius:2}}>SPREAD</span>}
                          </div>
                          <span style={{color:daysColor(d),fontWeight:600,fontSize:11}}>{daysLabel(d)}</span>
                        </div>
                        <div className="csp-card-row">
                          <span className="csp-card-label">STRIKE</span>
                          <span style={{color:"#d7e0ea"}}>${t.strike}{t.longStrike&&<span style={{color:"#3a6a7a"}}>/{t.longStrike}</span>}</span>
                        </div>
                        <div className="csp-card-row">
                          <span className="csp-card-label">EXPIRY</span>
                          <span style={{color:"#a6b3c2"}}>{t.expiry}</span>
                        </div>
                        <div className="csp-card-row">
                          <span className="csp-card-label">COLLECTED</span>
                          <span style={{color:"#d7e0ea"}}>{fmt(col)} ({t.contracts}×)</span>
                        </div>
                        <div className="csp-card-row">
                          <span className="csp-card-label">ANNUALIZED</span>
                          <span style={{color:"#9db6ce"}}>{annualizedReturn(t)!=null?annualizedReturn(t).toFixed(0)+"%":"—"}</span>
                        </div>
                        <div style={{display:"flex",gap:5,justifyContent:"flex-end",marginTop:8}}>
                          <button className="csp-btn-sm csp-btn-blue" onClick={()=>openEditModal(t)}>EDIT</button>
                          <button className="csp-btn-sm" onClick={()=>setCloseModal({id:t.id,costToClose:""})}>CLOSE</button>
                          <button className="csp-btn-sm csp-btn-danger" onClick={()=>deleteTrade(t.id)}>DEL</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {assignedTrades.length > 0 && (
              <div className="csp-panel" style={{marginBottom:12}}>
                <div style={{
                  padding:"10px 14px",
                  borderBottom:"1px solid #223044",
                  fontSize:9,
                  color:"#c084fc",
                  letterSpacing:".12em"
                }}>
                  ASSIGNED SHARES{" "}
                  <span style={{color:"#6b4a8a"}}>
                    ({assignedTrades.length})
                  </span>
                </div>

                <div className="csp-table-wrap" style={{overflowX:"auto"}}>
                  <table style={{
                    width:"100%",
                    borderCollapse:"collapse",
                    minWidth:560
                  }}>
                    <thead>
                      <tr>
                        {[
                          "TICKER",
                          "SHARES",
                          "ASSIGNED",
                          "STRIKE",
                          "BASIS / SHARE",
                          "TOTAL BASIS"
                        ].map((heading) => (
                          <th
                            key={heading}
                            style={{
                              padding:"9px 12px",
                              textAlign:"right",
                              color:"#5a4a6a",
                              fontWeight:400,
                              fontSize:9,
                              letterSpacing:".08em",
                              borderBottom:"1px solid #223044"
                            }}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {assignedTrades.map((trade) => (
                        <tr
                          key={trade.id}
                          className="row-hover"
                          style={{borderBottom:"1px solid #151f2b"}}
                        >
                          <td style={{
                            padding:"10px 12px",
                            textAlign:"right",
                            color:"#c084fc",
                            fontWeight:600
                          }}>
                            {trade.ticker}
                          </td>

                          <td style={{
                            padding:"10px 12px",
                            textAlign:"right",
                            color:"#d7e0ea"
                          }}>
                            {trade.shares}
                          </td>

                          <td style={{
                            padding:"10px 12px",
                            textAlign:"right",
                            color:"#8a7a9a"
                          }}>
                            {trade.assignmentDate}
                          </td>

                          <td style={{
                            padding:"10px 12px",
                            textAlign:"right",
                            color:"#d7e0ea"
                          }}>
                            {fmt(trade.strike)}
                          </td>

                          <td style={{
                            padding:"10px 12px",
                            textAlign:"right",
                            color:"#c084fc",
                            fontWeight:600
                          }}>
                            {fmt(trade.adjustedCostPerShare)}
                          </td>

                          <td style={{
                            padding:"10px 12px",
                            textAlign:"right",
                            color:"#d7e0ea"
                          }}>
                            {fmt(trade.adjustedCostBasis)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="csp-cards" style={{padding:"10px 12px"}}>
                  {assignedTrades.map((trade) => (
                    <div key={trade.id} className="csp-card">
                      <div
                        className="csp-card-row"
                        style={{marginBottom:5}}
                      >
                        <span style={{
                          color:"#c084fc",
                          fontWeight:600,
                          fontSize:14
                        }}>
                          {trade.ticker}
                        </span>

                        <span style={{
                          color:"#d7e0ea",
                          fontWeight:600
                        }}>
                          {trade.shares} shares
                        </span>
                      </div>

                      <div className="csp-card-row">
                        <span className="csp-card-label">
                          ASSIGNED
                        </span>
                        <span style={{color:"#8a7a9a"}}>
                          {trade.assignmentDate}
                        </span>
                      </div>

                      <div className="csp-card-row">
                        <span className="csp-card-label">
                          STRIKE
                        </span>
                        <span style={{color:"#d7e0ea"}}>
                          {fmt(trade.strike)}
                        </span>
                      </div>

                      <div className="csp-card-row">
                        <span className="csp-card-label">
                          BASIS / SHARE
                        </span>
                        <span style={{
                          color:"#c084fc",
                          fontWeight:600
                        }}>
                          {fmt(trade.adjustedCostPerShare)}
                        </span>
                      </div>

                      <div className="csp-card-row">
                        <span className="csp-card-label">
                          TOTAL BASIS
                        </span>
                        <span style={{color:"#d7e0ea"}}>
                          {fmt(trade.adjustedCostBasis)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {closedTrades.length>0 && (
              <div className="csp-panel">
                <div style={{padding:"10px 14px",borderBottom:"1px solid #223044",fontSize:9,color:"#7f8ea3",letterSpacing:".12em"}}>
                  CLOSED POSITIONS <span style={{color:"#4a4a1a"}}>({closedTrades.length})</span>
                </div>
                <div className="csp-table-wrap" style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
                    <thead><tr>
                      {["TICKER","STRIKE","EXPIRY","COLLECTED","COST TO CLOSE","NET P&L",""].map(h=>(
                        <th key={h} style={{padding:"9px 12px",textAlign:"right",color:"#71839a",fontWeight:400,fontSize:9,letterSpacing:".08em",borderBottom:"1px solid #223044"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {closedTrades.map(t=>{
                        const col = t.creditTotal??(t.premium*t.contracts*100);
                        return (
                          <tr key={t.id} className="row-hover" style={{borderBottom:"1px solid #151f2b",background:"#0e141c"}}>
                            <td style={{padding:"9px 12px",textAlign:"right"}}>
                              <span style={{color:"#4a7a4a",fontWeight:600}}>{t.ticker}</span>
                            </td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#9aa8b8"}}>${t.strike}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#8796aa"}}>{t.expiry}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#9aa8b8"}}>{fmt(col)}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#a07820"}}>{t.costToClose!=null?fmt(t.costToClose):"—"}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:(t.pnl??0)>=0?"#6fdc8c":"#ff7b7b",fontWeight:600}}>{t.pnl!=null?fmt(t.pnl):"—"}</td>
                            <td style={{padding:"9px 12px",textAlign:"right"}}>
                              <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
                                <button className="csp-btn-sm csp-btn-blue" onClick={()=>reopenTrade(t.id)}>REOPEN</button>
                                <button className="csp-btn-sm csp-btn-danger" onClick={()=>deleteTrade(t.id)}>DEL</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="csp-cards" style={{padding:"10px 12px"}}>
                  {closedTrades.map(t=>{
                    const col = t.creditTotal??(t.premium*t.contracts*100);
                    return (
                      <div key={t.id} className="csp-card">
                        <div className="csp-card-row" style={{marginBottom:4}}>
                          <span style={{color:"#4a7a4a",fontWeight:600,fontSize:13}}>{t.ticker}</span>
                          <span style={{color:(t.pnl??0)>=0?"#6fdc8c":"#ff7b7b",fontWeight:600}}>{t.pnl!=null?fmt(t.pnl):"—"}</span>
                        </div>
                        <div className="csp-card-row">
                          <span className="csp-card-label">STRIKE</span>
                          <span style={{color:"#9aa8b8"}}>${t.strike}</span>
                        </div>
                        <div className="csp-card-row">
                          <span className="csp-card-label">EXPIRY</span>
                          <span style={{color:"#8796aa"}}>{t.expiry}</span>
                        </div>
                        <div className="csp-card-row">
                          <span className="csp-card-label">COLLECTED / COST</span>
                          <span style={{color:"#9aa8b8"}}>{fmt(col)} / {t.costToClose!=null?fmt(t.costToClose):"—"}</span>
                        </div>
                        <div style={{display:"flex",gap:5,justifyContent:"flex-end",marginTop:8}}>
                          <button className="csp-btn-sm csp-btn-blue" onClick={()=>reopenTrade(t.id)}>REOPEN</button>
                          <button className="csp-btn-sm csp-btn-danger" onClick={()=>deleteTrade(t.id)}>DEL</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="screener" && (
          <div className="csp-panel">
            <div style={{padding:"10px 14px",borderBottom:"1px solid #223044",fontSize:9,color:"#7f8ea3",letterSpacing:".12em"}}>
              30 DTE CANDIDATES — PREMIUM TO HIT CA${Math.round(target).toLocaleString()}/mo
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:440}}>
                <thead><tr>
                  {["TICKER","PRICE","IV%","CONTRACTS","COLLATERAL","RETURN%"].map(h=>(
                    <th key={h} style={{padding:"9px 14px",textAlign:"right",color:"#71839a",fontWeight:400,fontSize:9,letterSpacing:".1em",borderBottom:"1px solid #223044"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {SAMPLE_TICKERS.map(tk=>{
                    const S=tk.price,K=Math.round(S*.95),T=30/365;
                    const prem=bsPut(S,K,T,.05,tk.iv/100);
                    const cts=prem>0?Math.ceil(targetUSD/(prem*100)):null;
                    const coll=cts?K*100*cts:0;
                    const ret=coll>0?((prem*100*cts)/coll*100).toFixed(2):"—";
                    return (
                      <tr key={tk.ticker} className="row-hover" style={{borderBottom:"1px solid #151f2b",cursor:"pointer"}}
                        onClick={()=>{setSelectedTicker(tk);setTab("strikes");}}>
                        <td style={{padding:"9px 14px",color:"#5aa9ff",fontWeight:600,textAlign:"right"}}>{tk.ticker}</td>
                        <td style={{padding:"9px 14px",textAlign:"right",color:"#d7e0ea"}}>${tk.price}</td>
                        <td style={{padding:"9px 14px",textAlign:"right",color:tk.iv>50?"#f59e0b":tk.iv>30?"#a0d8a0":"#9aa8b8"}}>{tk.iv}%</td>
                        <td style={{padding:"9px 14px",textAlign:"right",color:"#d7e0ea"}}>{cts?cts+"×":"—"}</td>
                        <td style={{padding:"9px 14px",textAlign:"right",color:"#a6b3c2"}}>{coll>0?"$"+Math.round(coll).toLocaleString():"—"}</td>
                        <td style={{padding:"9px 14px",textAlign:"right",color:"#5aa9ff"}}>{ret}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{padding:"8px 14px",fontSize:9,color:"#30445b"}}>Click a ticker to explore strikes.</div>
          </div>
        )}

        {tab==="strikes" && (
          <div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
              {SAMPLE_TICKERS.map(tk=>(
                <button key={tk.ticker} className={`tab-btn${selectedTicker.ticker===tk.ticker?" active":""}`}
                  onClick={()=>setSelectedTicker(tk)} style={{padding:"5px 12px",fontSize:9}}>
                  {tk.ticker}
                </button>
              ))}
            </div>
            <div className="csp-panel">
              <div style={{padding:"10px 14px",borderBottom:"1px solid #223044",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:9,color:"#7f8ea3",letterSpacing:".1em"}}>{selectedTicker.ticker} · ${selectedTicker.price} · IV {selectedTicker.iv}% · 30 DTE</span>
                <span style={{fontSize:9,color:"#607086"}}>target CA${Math.round(target).toLocaleString()}/mo</span>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:480}}>
                  <thead><tr>
                    {["STRIKE","OTM%","PREMIUM","DELTA","CONTRACTS","COLLATERAL","TOTAL"].map(h=>(
                      <th key={h} style={{padding:"9px 12px",textAlign:"right",color:"#71839a",fontWeight:400,fontSize:9,letterSpacing:".08em",borderBottom:"1px solid #223044"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {strikes.map((s,i)=>(
                      <tr key={i} className="strike-row" style={{borderBottom:"1px solid #151f2b",background:i===1?"#0a1a0a":"transparent"}}>
                        <td style={{padding:"9px 12px",textAlign:"right",color:"#5aa9ff",fontWeight:600}}>${s.strike}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:"#9aa8b8"}}>{s.otmPct}%</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:"#d7e0ea"}}>{fmt(s.premium)}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:s.delta>.3?"#f59e0b":"#6a9a6a"}}>{s.delta.toFixed(2)}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:"#9db6ce"}}>{s.contracts?s.contracts+"×":"—"}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:"#9aa8b8"}}>{s.collateral?"$"+Math.round(s.collateral).toLocaleString():"—"}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:s.premiumTotal>=targetUSD?"#5aa9ff":"#d7e0ea",fontWeight:s.premiumTotal>=targetUSD?600:400}}>
                          {fmt(s.premiumTotal)}{s.premiumTotal>=targetUSD?" ✓":""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{padding:"8px 14px",fontSize:9,color:"#30445b"}}>Row 2 = 5% OTM sweet spot · ✓ meets target · Δ&gt;0.30 = higher assignment risk</div>
            </div>
          </div>
        )}

        {closeModal && (()=>{
          const t = trades.find(x=>x.id===closeModal.id);
          const col = t?(t.creditTotal??(t.premium*t.contracts*100)):0;
          const cost = parseFloat(closeModal.costToClose)||0;
          const net = col-cost;
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
              <div style={{background:"#111821",border:"1px solid #4d82b8",borderRadius:6,padding:24,width:300,fontFamily:"'IBM Plex Mono',monospace"}}>
                <div style={{fontSize:9,color:"#4d82b8",letterSpacing:".2em",marginBottom:10}}>{"// CLOSE POSITION"}</div>
                <div style={{fontSize:15,color:"#5aa9ff",fontWeight:600,marginBottom:3}}>{t?.ticker}</div>
                <div style={{fontSize:10,color:"#7f8ea3",marginBottom:16}}>Collected: <span style={{color:"#d7e0ea"}}>{fmt(col)}</span></div>
                <div style={{fontSize:9,color:"#7f8ea3",letterSpacing:".1em",marginBottom:5}}>COST TO CLOSE (USD)</div>
                <input className="csp-input" type="number" placeholder="e.g. 27.00" value={closeModal.costToClose}
                  onChange={e=>setCloseModal({...closeModal,costToClose:e.target.value})}
                  style={{marginBottom:12}} autoFocus />
                {cost>0 && (
                  <div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:3,padding:"9px 12px",marginBottom:14,fontSize:12}}>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{color:"#7f8ea3"}}>Net P&L</span>
                      <span style={{color:net>=0?"#5aa9ff":"#ff6a6a",fontWeight:600}}>{fmt(net)}</span>
                    </div>
                  </div>
                )}
                <div style={{display:"flex",gap:7}}>
                  <button className="csp-btn" onClick={confirmClose} style={{flex:1}}>CONFIRM CLOSE</button>
                  <button className="csp-btn-sm" onClick={()=>setCloseModal(null)} style={{padding:"7px 14px",borderColor:"#2a2a2a",color:"#7f8ea3"}}>CANCEL</button>
                </div>
              </div>
            </div>
          );
        })()}

        {editModal && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
            <div style={{background:"#111821",border:"1px solid #4d82b8",borderRadius:6,padding:24,width:320,fontFamily:"'IBM Plex Mono',monospace"}}>
              <div style={{fontSize:9,color:"#4d82b8",letterSpacing:".2em",marginBottom:12}}>{"// EDIT TRADE"}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
                <input className="csp-input" placeholder="TICKER" value={editModal.ticker} onChange={e=>setEditModal({...editModal,ticker:e.target.value})} />
                <input className="csp-input" type="date" value={editModal.expiry} onChange={e=>setEditModal({...editModal,expiry:e.target.value})} />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
                <input className="csp-input" placeholder="SHORT STRIKE" value={editModal.strike} onChange={e=>setEditModal({...editModal,strike:e.target.value})} />
                <input className="csp-input" placeholder="LONG STRIKE (opt)" value={editModal.longStrike} onChange={e=>setEditModal({...editModal,longStrike:e.target.value})} />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:16}}>
                <input className="csp-input" placeholder="PREMIUM" value={editModal.premium} onChange={e=>setEditModal({...editModal,premium:e.target.value})} />
                <input className="csp-input" placeholder="CONTRACTS" value={editModal.contracts} onChange={e=>setEditModal({...editModal,contracts:e.target.value})} />
              </div>
              <div style={{display:"flex",gap:7}}>
                <button className="csp-btn" onClick={confirmEdit} style={{flex:1}}>SAVE CHANGES</button>
                <button className="csp-btn-sm" onClick={()=>setEditModal(null)} style={{padding:"7px 14px",borderColor:"#2a2a2a",color:"#7f8ea3"}}>CANCEL</button>
              </div>
            </div>
          </div>
        )}

        {assignModal && (() => {
          const trade = trades.find((t) => t.id === assignModal.id);
          const contracts = parseInt(assignModal.contracts) || 0;
          const shares = contracts * 100;
          const grossStockCost = trade ? trade.strike * shares : 0;
          const premiumApplied = trade
            ? trade.creditTotal ?? trade.premium * trade.contracts * 100
            : 0;
          const adjustedCostBasis = grossStockCost - premiumApplied;
          const adjustedCostPerShare =
            shares > 0 ? adjustedCostBasis / shares : 0;

          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:115,padding:16}}>
              <div style={{background:"#111821",border:"1px solid #5a3a7a",borderRadius:6,padding:20,width:360,maxWidth:"100%",fontFamily:"'IBM Plex Mono',monospace"}}>
                <div style={{fontSize:10,color:"#c084fc",letterSpacing:".2em",marginBottom:8}}>{"// ASSIGN POSITION"}</div>
                <div style={{fontSize:17,color:"#c084fc",fontWeight:600,marginBottom:12}}>{assignModal.ticker}</div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:12}}>
                  <input className="csp-input" type="date" value={assignModal.assignmentDate} onChange={e=>setAssignModal({...assignModal,assignmentDate:e.target.value})} />
                  <input className="csp-input" type="number" placeholder="CONTRACTS" value={assignModal.contracts} onChange={e=>setAssignModal({...assignModal,contracts:e.target.value})} />
                </div>

                <div style={{background:"#0e141c",border:"1px solid #223044",borderRadius:3,padding:"10px 12px",marginBottom:14,fontSize:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:"#7f8ea3"}}>Shares received</span>
                    <span style={{color:"#d7e0ea"}}>{shares}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:"#7f8ea3"}}>Gross stock cost</span>
                    <span style={{color:"#d7e0ea"}}>{fmt(grossStockCost)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:"#7f8ea3"}}>Premium applied</span>
                    <span style={{color:"#5aa9ff"}}>{fmt(premiumApplied)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:"#7f8ea3"}}>Adjusted basis</span>
                    <span style={{color:"#d7e0ea"}}>{fmt(adjustedCostBasis)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:"#7f8ea3"}}>Basis per share</span>
                    <span style={{color:"#c084fc",fontWeight:600}}>{fmt(adjustedCostPerShare)}</span>
                  </div>
                </div>

                <div style={{display:"flex",gap:7}}>
                  <button className="csp-btn" onClick={confirmAssignment} style={{flex:1,borderColor:"#5a3a7a",color:"#c084fc"}}>CONFIRM ASSIGNMENT</button>
                  <button className="csp-btn-sm" onClick={()=>setAssignModal(null)} style={{padding:"7px 14px",borderColor:"#2a2a2a",color:"#7f8ea3"}}>CANCEL</button>
                </div>
              </div>
            </div>
          );
        })()}

        {rollModal && (() => {
          const oldTrade = trades.find((t) => t.id === rollModal.id);
          const contracts = parseInt(rollModal.contracts) || 0;
          const closePrice = parseFloat(rollModal.costToClose) || 0;
  const costToClose = closePrice * 100 * contracts;
          const closeFees = parseFloat(rollModal.closeFees) || 0;
          const newPremium = parseFloat(rollModal.newPremium) || 0;
          const openFees = parseFloat(rollModal.openFees) || 0;
          const oldCredit = oldTrade
            ? oldTrade.creditTotal ?? oldTrade.premium * oldTrade.contracts * 100
            : 0;
          const oldPnl = oldCredit - costToClose - closeFees;
          const newCredit = newPremium * contracts * 100 - openFees;
          const rollNet = newCredit - costToClose - closeFees;

          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:110,padding:16}}>
              <div style={{background:"#111821",border:"1px solid #7a4a1a",borderRadius:6,padding:20,width:380,maxWidth:"100%",maxHeight:"92vh",overflowY:"auto",fontFamily:"'IBM Plex Mono',monospace"}}>
                <div style={{fontSize:9,color:"#f59e0b",letterSpacing:".2em",marginBottom:8}}>{"// ROLL POSITION"}</div>
                <div style={{fontSize:15,color:"#f59e0b",fontWeight:600,marginBottom:12}}>{rollModal.ticker}</div>

                <div style={{fontSize:9,color:"#6a7a6a",letterSpacing:".1em",marginBottom:6}}>CLOSE CURRENT LEG</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:12}}>
                  <input className="csp-input" type="number" placeholder="CLOSE PRICE / SHARE" value={rollModal.costToClose} onChange={e=>setRollModal({...rollModal,costToClose:e.target.value})} />
                  <input className="csp-input" type="number" placeholder="CLOSE FEES" value={rollModal.closeFees} onChange={e=>setRollModal({...rollModal,closeFees:e.target.value})} />
                </div>

                <div style={{fontSize:9,color:"#6a7a6a",letterSpacing:".1em",marginBottom:6}}>OPEN NEW LEG</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
                  <input className="csp-input" type="number" placeholder="NEW SHORT STRIKE" value={rollModal.newStrike} onChange={e=>setRollModal({...rollModal,newStrike:e.target.value})} />
                  <input className="csp-input" type="number" placeholder="NEW LONG STRIKE (opt)" value={rollModal.newLongStrike} onChange={e=>setRollModal({...rollModal,newLongStrike:e.target.value})} />
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
                  <input className="csp-input" type="date" value={rollModal.newExpiry} onChange={e=>setRollModal({...rollModal,newExpiry:e.target.value})} />
                  <input className="csp-input" type="number" placeholder="NEW PREMIUM" value={rollModal.newPremium} onChange={e=>setRollModal({...rollModal,newPremium:e.target.value})} />
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:12}}>
                  <input className="csp-input" type="number" placeholder="CONTRACTS" value={rollModal.contracts} onChange={e=>setRollModal({...rollModal,contracts:e.target.value})} />
                  <input className="csp-input" type="number" placeholder="OPEN FEES" value={rollModal.openFees} onChange={e=>setRollModal({...rollModal,openFees:e.target.value})} />
                </div>

                <div style={{background:"#0e141c",border:"1px solid #223044",borderRadius:3,padding:"10px 12px",marginBottom:14,fontSize:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:"#7f8ea3"}}>Old leg P&L</span>
                    <span style={{color:oldPnl>=0?"#6fdc8c":"#ff7b7b",fontWeight:600}}>{fmt(oldPnl)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:"#7f8ea3"}}>New credit</span>
                    <span style={{color:"#d7e0ea"}}>{fmt(newCredit)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:"#7f8ea3"}}>Roll net</span>
                    <span style={{color:rollNet>=0?"#6fdc8c":"#ff7b7b",fontWeight:600}}>{rollNet>=0?"CREDIT ":"DEBIT "}{fmt(Math.abs(rollNet))}</span>
                  </div>
                </div>

                <div style={{display:"flex",gap:7}}>
                  <button className="csp-btn" onClick={confirmRoll} style={{flex:1,borderColor:"#7a4a1a",color:"#f59e0b"}}>CONFIRM ROLL</button>
                  <button className="csp-btn-sm" onClick={()=>setRollModal(null)} style={{padding:"7px 14px",borderColor:"#2a2a2a",color:"#7f8ea3"}}>CANCEL</button>
                </div>
              </div>
            </div>
          );
        })()}

        <div style={{marginTop:16,fontSize:9,color:"#1c2735",textAlign:"center"}}>
          Black-Scholes estimates only · not financial advice
        </div>
      </div>
    </div>
  );
}
