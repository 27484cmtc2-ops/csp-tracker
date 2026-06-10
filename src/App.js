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

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  const exp = new Date(dateStr + "T00:00:00");
  return Math.round((exp - today) / 86400000);
}

function daysColor(d) {
  if (d == null) return "#4a6a4a";
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

  const openEditModal = (t) => setEditModal({
    id: t.id, ticker: t.ticker, strike: String(t.strike),
    longStrike: t.longStrike != null ? String(t.longStrike) : "",
    premium: String(t.premium), contracts: String(t.contracts), expiry: t.expiry || "",
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
        .tab-btn{cursor:pointer;padding:7px 16px;font-size:10px;letter-spacing:.15em;text-transform:uppercase;border:1px solid #1a2a1a;border-radius:2px;background:transparent;color:#4a5e4a;transition:all .15s;}
        .tab-btn:hover{color:#8aaa8a;border-color:#2a4a2a;}
        .tab-btn.active{background:#1a2e1a;border-color:#3a6e3a;color:#7aff7a;}
        .row-hover:hover{background:#0f1a0f!important;}
        .strike-row:hover{background:#0f1a0f!important;cursor:pointer;}
        .csp-input{background:#080c10;border:1px solid #1a2a1a;border-radius:2px;padding:7px 10px;color:#c8d8c0;font-size:11px;outline:none;width:100%;}
        .csp-input:focus{border-color:#3a6e3a;}
        .csp-panel{background:#0d1117;border:1px solid #1a2e1a;border-radius:4px;}
        .csp-btn{padding:7px 18px;background:#1a2e1a;border:1px solid #3a6e3a;border-radius:2px;color:#7aff7a;font-size:10px;letter-spacing:.1em;cursor:pointer;}
        .csp-btn:hover{background:#223e22;}
        .csp-btn-sm{padding:2px 8px;background:transparent;border:1px solid #2a4a2a;border-radius:2px;color:#7aff7a;font-size:9px;cursor:pointer;}
        .csp-btn-sm:hover{background:#0a1a0a;}
        .csp-btn-danger{border-color:#2a1a1a!important;color:#6a3a3a!important;}
        .csp-btn-danger:hover{background:#1a0a0a!important;color:#ff6a6a!important;}
        .csp-btn-blue{border-color:#1a2a4a!important;color:#60a5fa!important;}
        .csp-table-wrap{display:block;}
        .csp-cards{display:none;}
        .csp-card{background:#0a0f0a;border:1px solid #142214;border-radius:4px;padding:10px 12px;margin-bottom:8px;}
        .csp-card-row{display:flex;justify-content:space-between;align-items:center;font-size:11px;padding:2px 0;}
        .csp-card-label{color:#3a6a3a;font-size:9px;letter-spacing:.08em;}
        @media (max-width:640px){
          .csp-table-wrap{display:none;}
          .csp-cards{display:block;}
        }
      `}</style>

      <div style={{maxWidth:780,margin:"0 auto",padding:"24px 16px"}}>

        <div style={{marginBottom:20}}>
          <div style={{fontSize:9,letterSpacing:".3em",color:"#3a6e3a",marginBottom:5}}>{"// CASH SECURED PUTS"}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div style={{fontSize:18,fontWeight:600,color:"#7aff7a",letterSpacing:".04em"}}>CASH SECURED PUT TRACKER</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:9,color:"#4a6a4a",letterSpacing:".1em"}}>TARGET CA$</span>
              <input className="csp-input" type="number" value={target} onChange={e=>setTarget(parseFloat(e.target.value)||500)} style={{width:80,fontSize:13,color:"#7aff7a",borderColor:"#2a4a2a"}} />
            </div>
          </div>
        </div>

        <div className="csp-panel" style={{padding:"14px 18px",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <div>
              <span style={{fontSize:9,color:"#4a6a4a",letterSpacing:".12em"}}>COLLECTED USD </span>
              <span style={{fontSize:20,color:"#7aff7a",fontWeight:600}}>{fmtShort(total)}</span>
              <div style={{fontSize:9,color:"#3a6a3a",marginTop:3}}>
                ≈ <span style={{color:"#5aaa5a"}}>CA${Math.round(total*USD_CAD).toLocaleString()}</span>
                <span style={{color:"#2a4a2a"}}> @ {USD_CAD} USD/CAD</span>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:9,color:"#4a6a4a",letterSpacing:".1em"}}>TO TARGET</div>
              <div style={{fontSize:13,color:progress>=100?"#7aff7a":"#f59e0b",fontWeight:600}}>
                {progress>=100 ? "✓ TARGET MET" : `${fmtShort(targetUSD-total)} remaining`}
              </div>
            </div>
          </div>
          <div style={{height:5,background:"#1a2a1a",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${progress}%`,background:progress>=100?"#7aff7a":"#3a8a3a",borderRadius:3,transition:"width .4s"}} />
          </div>
          <div style={{display:"flex",gap:18,marginTop:8}}>
            <span style={{fontSize:9,color:"#4a6a4a"}}><span style={{color:"#7aff7a"}}>{fmtShort(realized)}</span> realized</span>
            <span style={{fontSize:9,color:"#4a6a4a"}}><span style={{color:"#a0c8a0"}}>{fmtShort(openPremium)}</span> open</span>
          </div>
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
              <div style={{fontSize:9,color:"#4a6a4a",letterSpacing:".12em",marginBottom:10}}>LOG NEW TRADE</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:7}}>
                <input className="csp-input" placeholder="TICKER" value={newTrade.ticker} onChange={e=>setNewTrade({...newTrade,ticker:e.target.value})} />
                <input className="csp-input" placeholder="SHORT STRIKE" value={newTrade.strike} onChange={e=>setNewTrade({...newTrade,strike:e.target.value})} />
                <input className="csp-input" placeholder="LONG STRIKE (opt)" value={newTrade.longStrike} onChange={e=>setNewTrade({...newTrade,longStrike:e.target.value})} />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:10}}>
                <input className="csp-input" placeholder="PREMIUM" value={newTrade.premium} onChange={e=>setNewTrade({...newTrade,premium:e.target.value})} />
                <input className="csp-input" placeholder="CONTRACTS" value={newTrade.contracts} onChange={e=>setNewTrade({...newTrade,contracts:e.target.value})} />
                <input className="csp-input" type="date" value={newTrade.expiry} onChange={e=>setNewTrade({...newTrade,expiry:e.target.value})} />
              </div>
              <button className="csp-btn" onClick={addTrade}>+ ADD TRADE</button>
            </div>

            <div className="csp-panel" style={{marginBottom:12}}>
              <div style={{padding:"10px 14px",borderBottom:"1px solid #1a2e1a",fontSize:9,color:"#4a6a4a",letterSpacing:".12em"}}>
                OPEN POSITIONS <span style={{color:"#2a5a2a"}}>({openTrades.length})</span>
              </div>
              {openTrades.length===0 && <div style={{padding:20,textAlign:"center",color:"#3a5a3a",fontSize:11}}>No open positions.</div>}
              {openTrades.length>0 && (
                <div className="csp-table-wrap" style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
                    <thead><tr>
                      {["TICKER","STRIKE","EXPIRY","DAYS","COLLECTED","CNTS",""].map(h=>(
                        <th key={h} style={{padding:"9px 12px",textAlign:"right",color:"#3a6a3a",fontWeight:400,fontSize:9,letterSpacing:".08em",borderBottom:"1px solid #1a2e1a"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {openTrades.map(t=>{
                        const col = t.creditTotal??(t.premium*t.contracts*100);
                        const isSpread = t.type?.includes("Spread");
                        const d = daysUntil(t.expiry);
                        return (
                          <tr key={t.id} className="row-hover" style={{borderBottom:"1px solid #0f1a0f"}}>
                            <td style={{padding:"9px 12px",textAlign:"right"}}>
                              <span style={{color:isSpread?"#60efff":"#7aff7a",fontWeight:600}}>{t.ticker}</span>
                              {isSpread && <span style={{fontSize:8,color:"#60efff",marginLeft:4,padding:"1px 4px",border:"1px solid #1a3a4a",borderRadius:2}}>SPREAD</span>}
                              {isSpread && <div style={{fontSize:8,color:"#3a7a8a",marginTop:1}}>{t.type}</div>}
                            </td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#c8d8c0"}}>
                              ${t.strike}{t.longStrike&&<span style={{color:"#3a6a7a"}}>/{t.longStrike}</span>}
                            </td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#8aaa8a"}}>{t.expiry}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:daysColor(d),fontWeight:600}}>{daysLabel(d)}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#c8d8c0"}}>{fmt(col)}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#c8d8c0"}}>{t.contracts}×</td>
                            <td style={{padding:"9px 12px",textAlign:"right"}}>
                              <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
                                <button className="csp-btn-sm csp-btn-blue" onClick={()=>openEditModal(t)}>EDIT</button>
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
                  {openTrades.map(t=>{
                    const col = t.creditTotal??(t.premium*t.contracts*100);
                    const isSpread = t.type?.includes("Spread");
                    const d = daysUntil(t.expiry);
                    return (
                      <div key={t.id} className="csp-card">
                        <div className="csp-card-row" style={{marginBottom:4}}>
                          <div>
                            <span style={{color:isSpread?"#60efff":"#7aff7a",fontWeight:600,fontSize:13}}>{t.ticker}</span>
                            {isSpread && <span style={{fontSize:8,color:"#60efff",marginLeft:4,padding:"1px 4px",border:"1px solid #1a3a4a",borderRadius:2}}>SPREAD</span>}
                          </div>
                          <span style={{color:daysColor(d),fontWeight:600,fontSize:11}}>{daysLabel(d)}</span>
                        </div>
                        <div className="csp-card-row">
                          <span className="csp-card-label">STRIKE</span>
                          <span style={{color:"#c8d8c0"}}>${t.strike}{t.longStrike&&<span style={{color:"#3a6a7a"}}>/{t.longStrike}</span>}</span>
                        </div>
                        <div className="csp-card-row">
                          <span className="csp-card-label">EXPIRY</span>
                          <span style={{color:"#8aaa8a"}}>{t.expiry}</span>
                        </div>
                        <div className="csp-card-row">
                          <span className="csp-card-label">COLLECTED</span>
                          <span style={{color:"#c8d8c0"}}>{fmt(col)} ({t.contracts}×)</span>
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

            {closedTrades.length>0 && (
              <div className="csp-panel">
                <div style={{padding:"10px 14px",borderBottom:"1px solid #1a2e1a",fontSize:9,color:"#4a6a4a",letterSpacing:".12em"}}>
                  CLOSED POSITIONS <span style={{color:"#4a4a1a"}}>({closedTrades.length})</span>
                </div>
                <div className="csp-table-wrap" style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
                    <thead><tr>
                      {["TICKER","STRIKE","EXPIRY","COLLECTED","COST TO CLOSE","NET P&L",""].map(h=>(
                        <th key={h} style={{padding:"9px 12px",textAlign:"right",color:"#3a6a3a",fontWeight:400,fontSize:9,letterSpacing:".08em",borderBottom:"1px solid #1a2e1a"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {closedTrades.map(t=>{
                        const col = t.creditTotal??(t.premium*t.contracts*100);
                        return (
                          <tr key={t.id} className="row-hover" style={{borderBottom:"1px solid #0f1a0f",background:"#0a0f0a"}}>
                            <td style={{padding:"9px 12px",textAlign:"right"}}>
                              <span style={{color:"#4a7a4a",fontWeight:600}}>{t.ticker}</span>
                            </td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#6a8a6a"}}>${t.strike}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#5a7a5a"}}>{t.expiry}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#6a8a6a"}}>{fmt(col)}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:"#a07820"}}>{t.costToClose!=null?fmt(t.costToClose):"—"}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:(t.pnl??0)>=0?"#7aff7a":"#ff6a6a",fontWeight:600}}>{t.pnl!=null?fmt(t.pnl):"—"}</td>
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
                          <span style={{color:(t.pnl??0)>=0?"#7aff7a":"#ff6a6a",fontWeight:600}}>{t.pnl!=null?fmt(t.pnl):"—"}</span>
                        </div>
                        <div className="csp-card-row">
                          <span className="csp-card-label">STRIKE</span>
                          <span style={{color:"#6a8a6a"}}>${t.strike}</span>
                        </div>
                        <div className="csp-card-row">
                          <span className="csp-card-label">EXPIRY</span>
                          <span style={{color:"#5a7a5a"}}>{t.expiry}</span>
                        </div>
                        <div className="csp-card-row">
                          <span className="csp-card-label">COLLECTED / COST</span>
                          <span style={{color:"#6a8a6a"}}>{fmt(col)} / {t.costToClose!=null?fmt(t.costToClose):"—"}</span>
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
            <div style={{padding:"10px 14px",borderBottom:"1px solid #1a2e1a",fontSize:9,color:"#4a6a4a",letterSpacing:".12em"}}>
              30 DTE CANDIDATES — PREMIUM TO HIT CA${Math.round(target).toLocaleString()}/mo
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:440}}>
                <thead><tr>
                  {["TICKER","PRICE","IV%","CONTRACTS","COLLATERAL","RETURN%"].map(h=>(
                    <th key={h} style={{padding:"9px 14px",textAlign:"right",color:"#3a6a3a",fontWeight:400,fontSize:9,letterSpacing:".1em",borderBottom:"1px solid #1a2e1a"}}>{h}</th>
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
                      <tr key={tk.ticker} className="row-hover" style={{borderBottom:"1px solid #0f1a0f",cursor:"pointer"}}
                        onClick={()=>{setSelectedTicker(tk);setTab("strikes");}}>
                        <td style={{padding:"9px 14px",color:"#7aff7a",fontWeight:600,textAlign:"right"}}>{tk.ticker}</td>
                        <td style={{padding:"9px 14px",textAlign:"right",color:"#c8d8c0"}}>${tk.price}</td>
                        <td style={{padding:"9px 14px",textAlign:"right",color:tk.iv>50?"#f59e0b":tk.iv>30?"#a0d8a0":"#6a8a6a"}}>{tk.iv}%</td>
                        <td style={{padding:"9px 14px",textAlign:"right",color:"#c8d8c0"}}>{cts?cts+"×":"—"}</td>
                        <td style={{padding:"9px 14px",textAlign:"right",color:"#8aaa8a"}}>{coll>0?"$"+Math.round(coll).toLocaleString():"—"}</td>
                        <td style={{padding:"9px 14px",textAlign:"right",color:"#7aff7a"}}>{ret}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{padding:"8px 14px",fontSize:9,color:"#2a4a2a"}}>Click a ticker to explore strikes.</div>
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
              <div style={{padding:"10px 14px",borderBottom:"1px solid #1a2e1a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:9,color:"#4a6a4a",letterSpacing:".1em"}}>{selectedTicker.ticker} · ${selectedTicker.price} · IV {selectedTicker.iv}% · 30 DTE</span>
                <span style={{fontSize:9,color:"#3a5a3a"}}>target CA${Math.round(target).toLocaleString()}/mo</span>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:480}}>
                  <thead><tr>
                    {["STRIKE","OTM%","PREMIUM","DELTA","CONTRACTS","COLLATERAL","TOTAL"].map(h=>(
                      <th key={h} style={{padding:"9px 12px",textAlign:"right",color:"#3a6a3a",fontWeight:400,fontSize:9,letterSpacing:".08em",borderBottom:"1px solid #1a2e1a"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {strikes.map((s,i)=>(
                      <tr key={i} className="strike-row" style={{borderBottom:"1px solid #0f1a0f",background:i===1?"#0a1a0a":"transparent"}}>
                        <td style={{padding:"9px 12px",textAlign:"right",color:"#7aff7a",fontWeight:600}}>${s.strike}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:"#6a8a6a"}}>{s.otmPct}%</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:"#c8d8c0"}}>{fmt(s.premium)}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:s.delta>.3?"#f59e0b":"#6a9a6a"}}>{s.delta.toFixed(2)}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:"#a0c8a0"}}>{s.contracts?s.contracts+"×":"—"}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:"#6a8a6a"}}>{s.collateral?"$"+Math.round(s.collateral).toLocaleString():"—"}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:s.premiumTotal>=targetUSD?"#7aff7a":"#c8d8c0",fontWeight:s.premiumTotal>=targetUSD?600:400}}>
                          {fmt(s.premiumTotal)}{s.premiumTotal>=targetUSD?" ✓":""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{padding:"8px 14px",fontSize:9,color:"#2a4a2a"}}>Row 2 = 5% OTM sweet spot · ✓ meets target · Δ&gt;0.30 = higher assignment risk</div>
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
              <div style={{background:"#0d1117",border:"1px solid #3a6e3a",borderRadius:6,padding:24,width:300,fontFamily:"'IBM Plex Mono',monospace"}}>
                <div style={{fontSize:9,color:"#3a6e3a",letterSpacing:".2em",marginBottom:10}}>{"// CLOSE POSITION"}</div>
                <div style={{fontSize:15,color:"#7aff7a",fontWeight:600,marginBottom:3}}>{t?.ticker}</div>
                <div style={{fontSize:10,color:"#4a6a4a",marginBottom:16}}>Collected: <span style={{color:"#c8d8c0"}}>{fmt(col)}</span></div>
                <div style={{fontSize:9,color:"#4a6a4a",letterSpacing:".1em",marginBottom:5}}>COST TO CLOSE (USD)</div>
                <input className="csp-input" type="number" placeholder="e.g. 27.00" value={closeModal.costToClose}
                  onChange={e=>setCloseModal({...closeModal,costToClose:e.target.value})}
                  style={{marginBottom:12}} autoFocus />
                {cost>0 && (
                  <div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:3,padding:"9px 12px",marginBottom:14,fontSize:10}}>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{color:"#4a6a4a"}}>Net P&L</span>
                      <span style={{color:net>=0?"#7aff7a":"#ff6a6a",fontWeight:600}}>{fmt(net)}</span>
                    </div>
                  </div>
                )}
                <div style={{display:"flex",gap:7}}>
                  <button className="csp-btn" onClick={confirmClose} style={{flex:1}}>CONFIRM CLOSE</button>
                  <button className="csp-btn-sm" onClick={()=>setCloseModal(null)} style={{padding:"7px 14px",borderColor:"#2a2a2a",color:"#4a6a4a"}}>CANCEL</button>
                </div>
              </div>
            </div>
          );
        })()}

        {editModal && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
            <div style={{background:"#0d1117",border:"1px solid #3a6e3a",borderRadius:6,padding:24,width:320,fontFamily:"'IBM Plex Mono',monospace"}}>
              <div style={{fontSize:9,color:"#3a6e3a",letterSpacing:".2em",marginBottom:12}}>{"// EDIT TRADE"}</div>
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
                <button className="csp-btn-sm" onClick={()=>setEditModal(null)} style={{padding:"7px 14px",borderColor:"#2a2a2a",color:"#4a6a4a"}}>CANCEL</button>
              </div>
            </div>
          </div>
        )}

        <div style={{marginTop:16,fontSize:9,color:"#1a2a1a",textAlign:"center"}}>
          Black-Scholes estimates only · not financial advice
        </div>
      </div>
    </div>
  );
}
