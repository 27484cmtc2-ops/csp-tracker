import { useState } from "react";
import { loadCloudData, saveCloudData } from "../cloudStorage";
import { DEFAULT_TRADES } from "../data/trackerData";

function loadLocalData() {
  try {
    const savedTrades = localStorage.getItem("csp_trades");
    const savedTarget = localStorage.getItem("csp_target");
    return {
      trades: savedTrades ? JSON.parse(savedTrades) : DEFAULT_TRADES,
      target: savedTarget ? parseFloat(savedTarget) : 500,
    };
  } catch {
    return { trades: DEFAULT_TRADES, target: 500 };
  }
}

function saveLocalData(trades, target) {
  try {
    localStorage.setItem("csp_trades", JSON.stringify(trades));
    localStorage.setItem("csp_target", String(target));
  } catch {}
}

export default function useTrackerData() {
  const [initialData] = useState(loadLocalData);
  const [trades, setTradesRaw] = useState(initialData.trades);
  const [target, setTargetRaw] = useState(initialData.target);

  const setTrades = (nextTrades) => {
    setTradesRaw(nextTrades);
    saveLocalData(nextTrades, target);
  };

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
      saveLocalData(cloudData.trades, cloudData.target);
      window.alert("Cloud data downloaded successfully.");
    } catch (error) {
      window.alert(`Cloud download failed: ${error.message}`);
    }
  };

  return {
    trades,
    target,
    setTrades,
    uploadLocalToCloud,
    downloadCloudToThisDevice,
  };
}
