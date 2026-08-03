import { useState, useMemo } from "react";
import "./App.css";
import PortfolioSummary from "./components/PortfolioSummary";
import CloudSyncControls from "./components/CloudSyncControls";
import NewTradeForm from "./components/NewTradeForm";
import ScreenerPage from "./components/ScreenerPage";
import StrikesPage from "./components/StrikesPage";
import MobileTrackerShell from "./components/mobile/MobileTrackerShell";
import { EMPTY_NEW_TRADE, SAMPLE_TICKERS, USD_CAD } from "./data/trackerData";
import useTrackerData from "./hooks/useTrackerData";
import { generateStrikes } from "./utils/calculations";
import { fmt } from "./utils/formatters";
import { annualizedReturn, daysColor, daysLabel, daysUntil, getCollectedPremium } from "./utils/trades";

export default function App() {
  const [tab, setTab] = useState("tracker");
  const {
    trades,
    target,
    setTrades,
    uploadLocalToCloud,
    downloadCloudToThisDevice,
  } = useTrackerData();
  const [selectedTicker, setSelectedTicker] = useState(SAMPLE_TICKERS[4]);
  const [newTrade, setNewTrade] = useState(EMPTY_NEW_TRADE);
  const [closeModal, setCloseModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [rollModal, setRollModal] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const targetUSD = target / USD_CAD;

  const realized = useMemo(() => trades.filter(t=>t.status==="closed").reduce((s,t)=>s+(t.pnl??0),0), [trades]);
  const openPremium = useMemo(() => trades.filter(t=>t.status==="open").reduce((s,t)=>s+getCollectedPremium(t),0), [trades]);
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
    setNewTrade(EMPTY_NEW_TRADE);
  };

  const confirmClose = () => {
    if (!closeModal) return;
    const cost = parseFloat(closeModal.costToClose) || 0;
    setTrades(trades.map(t => {
      if (t.id !== closeModal.id) return t;
      const col = getCollectedPremium(t);
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
      <div className="app-content" style={{maxWidth:780,margin:"0 auto",padding:"24px 16px"}}>
        <div className="desktop-interface">
        <PortfolioSummary
          realized={realized}
          openPremium={openPremium}
          winRate={winRate}
          winningTrades={winningTrades}
          closedTradeCount={closedTrades.length}
        />
        <CloudSyncControls
          onUpload={uploadLocalToCloud}
          onDownload={downloadCloudToThisDevice}
        />
        

        {tab==="tracker" && (
          <div>
            <NewTradeForm value={newTrade} onChange={setNewTrade} onSubmit={addTrade} />

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
                          <button className="csp-btn-sm" onClick={()=>openRollModal(t)} style={{borderColor:"#7a4a1a",color:"#f59e0b"}}>ROLL</button>
                          <button className="csp-btn-sm" onClick={()=>openAssignModal(t)} style={{borderColor:"#5a3a7a",color:"#c084fc"}}>ASSIGN</button>
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
          <ScreenerPage
            tickers={SAMPLE_TICKERS}
            target={target}
            targetUSD={targetUSD}
            onSelectTicker={(ticker) => {
              setSelectedTicker(ticker);
              setTab("strikes");
            }}
          />
        )}

        {tab==="strikes" && (
          <StrikesPage
            tickers={SAMPLE_TICKERS}
            selectedTicker={selectedTicker}
            target={target}
            targetUSD={targetUSD}
            strikes={strikes}
            onSelectTicker={setSelectedTicker}
          />
        )}
        </div>

        <div className="mobile-interface">
          <MobileTrackerShell
            tab={tab}
            onTabChange={setTab}
            realized={realized}
            openPremium={openPremium}
            winRate={winRate}
            winningTrades={winningTrades}
            closedTrades={closedTrades}
            assignedTrades={assignedTrades}
            sortedOpenTrades={sortedOpenTrades}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={toggleSort}
            newTrade={newTrade}
            onNewTradeChange={setNewTrade}
            onAddTrade={addTrade}
            onEdit={openEditModal}
            onRoll={openRollModal}
            onAssign={openAssignModal}
            onClose={(trade) => setCloseModal({id:trade.id,costToClose:""})}
            onReopen={reopenTrade}
            onDelete={deleteTrade}
          />
        </div>

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
