import { useCallback, useEffect, useRef, useState } from "react";

export const UNDO_TIMEOUT_MS = 30000;

function clonePortfolio(trades) {
  return JSON.parse(JSON.stringify(trades));
}

export default function usePortfolioUndo({ userId, trades, setTrades }) {
  const [undoEntry, setUndoEntry] = useState(null);
  const [undoError, setUndoError] = useState("");
  const timerRef = useRef(null);
  const undoingRef = useRef(false);

  const clearUndo = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    undoingRef.current = false;
    setUndoEntry(null);
  }, []);

  useEffect(() => {
    clearUndo();
  }, [clearUndo, userId]);

  useEffect(() => () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    undoingRef.current = false;
  }, []);

  const commitTrades = useCallback((nextTrades, message) => {
    const previousTrades = clonePortfolio(trades);
    setTrades(nextTrades);
    clearTimeout(timerRef.current);
    undoingRef.current = false;
    setUndoError("");
    setUndoEntry({ userId, previousTrades, message });
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setUndoEntry(null);
    }, UNDO_TIMEOUT_MS);
  }, [setTrades, trades, userId]);

  const undo = useCallback(() => {
    if (!undoEntry || undoingRef.current || undoEntry.userId !== userId) return;
    undoingRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    const currentEntry = undoEntry;
    setUndoEntry(null);
    try {
      setTrades(clonePortfolio(currentEntry.previousTrades));
      setUndoError("");
    } catch {
      setUndoError("Undo failed. Your current portfolio was not changed.");
    } finally {
      undoingRef.current = false;
    }
  }, [setTrades, undoEntry, userId]);

  return { undoEntry, undoError, commitTrades, undo, clearUndo };
}
