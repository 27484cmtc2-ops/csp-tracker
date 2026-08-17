import { useEffect, useMemo, useState } from "react";
import { DIVIDEND_FREQUENCIES } from "../../utils/dividends";
import { parseCsvFile } from "../../imports/csv/parseCsv";
import {
  createDividendImportRows,
  getDividendImportSummary,
  reviewDividendImportRows,
  DIVIDEND_IMPORT_ADAPTERS,
} from "../../imports/dividends/dividendImport";
import { WHEEL_APP_DIVIDEND_TEMPLATE } from "../../imports/dividends/wheelAppAdapter";

const FREQUENCY_LABELS = {
  weekly: "Weekly",
  semi_monthly: "Semi-monthly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  annual: "Annual",
};

const STATUS_LABELS = {
  ready: "Ready",
  needs_review: "Needs Review",
  duplicate: "Duplicate",
  unsupported: "Unsupported",
  excluded: "Excluded",
};

export default function DividendImportDialog({ holdings, onConfirm, onClose }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [adapterId, setAdapterId] = useState("wheel_app_dividend_holdings");
  const summary = useMemo(() => getDividendImportSummary(rows), [rows]);

  useEffect(() => {
    setRows((current) => current.length
      ? reviewDividendImportRows(current, holdings)
      : current);
  }, [holdings]);

  const replaceRows = (nextRows) => setRows(reviewDividendImportRows(nextRows, holdings));

  const selectFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setError("");
    setRows([]);
    setFileName("");
    try {
      const adapter = DIVIDEND_IMPORT_ADAPTERS.find((item) => item.id === adapterId);
      const parsed = await parseCsvFile(file, { positional: adapter?.positional });
      setRows(createDividendImportRows(parsed, holdings, adapterId));
      setFileName(file.name);
    } catch (parseError) {
      setError(parseError.message || "The CSV could not be read.");
    } finally {
      setParsing(false);
      event.target.value = "";
    }
  };

  const updateCandidate = (rowId, field, value) => {
    replaceRows(rows.map((row) => row.importRowId === rowId ? {
      ...row,
      candidate: { ...row.candidate, [field]: value },
      duplicateDecision: null,
    } : row));
  };

  const toggleIncluded = (rowId) => {
    replaceRows(rows.map((row) => row.importRowId === rowId ? {
      ...row,
      included: !row.included,
      duplicateDecision: row.duplicates.length ? (!row.included ? null : "skip") : row.duplicateDecision,
    } : row));
  };

  const resolveDuplicate = (rowId, decision) => {
    replaceRows(rows.map((row) => row.importRowId === rowId ? {
      ...row,
      included: decision === "add",
      duplicateDecision: decision,
    } : row));
  };

  const confirm = () => {
    if (!summary.canConfirm) return;
    try {
      onConfirm(rows);
    } catch (confirmationError) {
      setError(confirmationError.message || "The holdings could not be imported.");
    }
  };

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(WHEEL_APP_DIVIDEND_TEMPLATE)}`;

  return (
    <div className="dividend-modal-layer dividend-import-layer" role="dialog" aria-modal="true" aria-labelledby="dividend-import-title">
      <button className="dividend-modal-backdrop" onClick={onClose} aria-label="Close dividend import" />
      <section className="dividend-import-dialog">
        <header>
          <div>
            <span className="dividend-eyebrow">DIVIDEND HOLDINGS</span>
            <h2 id="dividend-import-title">Import CSV</h2>
            <p>Your CSV is processed on this device. The original file is not uploaded.</p>
          </div>
          <button className="dividend-form-close" onClick={onClose} aria-label="Close dividend import">×</button>
        </header>

        <div className="dividend-import-source">
          <label>
            <span>Import format</span>
            <select aria-label="Import format" value={adapterId} onChange={(event) => {
              setAdapterId(event.target.value);
              setRows([]);
              setFileName("");
              setError("");
            }}>
              {DIVIDEND_IMPORT_ADAPTERS.map((adapter) => <option key={adapter.id} value={adapter.id}>{adapter.label}</option>)}
            </select>
          </label>
          <label className="dividend-import-file">
            <span>CSV file</span>
            <input type="file" accept=".csv,text/csv" onChange={selectFile} />
          </label>
          <a className="csp-btn-sm dividend-template-link" href={templateHref} download="investing-dashboard-dividend-template.csv">
            DOWNLOAD EXAMPLE TEMPLATE
          </a>
        </div>
        <p className="dividend-import-columns">
          {adapterId === "snowball_analytics_holdings"
            ? "Snowball requires Holding and Shares. Missing dividend details remain in review until completed. Account defaults to Unknown."
            : "Required columns: Ticker, Shares, Dividend Per Share, Frequency, Currency, Account, Next Payment Date, Notes"}
        </p>

        {parsing && <p className="dividend-import-message" role="status">Reading CSV…</p>}
        {error && <div className="dividend-form-error" role="alert">{error}</div>}

        {rows.length > 0 && (
          <>
            <div className="dividend-import-review-heading">
              <div><strong>Review holdings</strong><span>{fileName}</span></div>
              <div aria-label="Import summary">
                <span>{summary.ready} ready</span>
                <span>{summary.duplicate} duplicate</span>
                <span>{summary.needs_review + summary.unsupported} needs review</span>
                <span>{summary.excluded} excluded</span>
              </div>
            </div>

            <div className="dividend-import-table-wrap">
              <table className="dividend-import-table">
                <thead><tr><th>Include</th><th>Status</th><th>Ticker</th><th>Shares</th><th>Dividend / Share</th><th>Frequency</th><th>Currency</th><th>Account</th><th>Next Payment</th><th>Notes</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.importRowId} className={`dividend-import-row status-${row.status}`}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Include row ${row.sourceRowNumber}`}
                          checked={row.included}
                          onChange={() => toggleIncluded(row.importRowId)}
                        />
                      </td>
                      <td>
                        <span className={`dividend-import-status status-${row.status}`}>{STATUS_LABELS[row.status]}</span>
                        {row.validationError && row.included && <small>{row.validationError}</small>}
                        {row.issues.map((issue) => <small key={`${issue.field}-${issue.code}`}>{issue.message}</small>)}
                        {row.duplicates.length > 0 && (
                          <div className="dividend-duplicate-actions">
                            <small>Possible match found. Choose:</small>
                            <button className={row.duplicateDecision === "skip" ? "selected" : ""} onClick={() => resolveDuplicate(row.importRowId, "skip")}>Skip</button>
                            <button className={row.duplicateDecision === "add" ? "selected" : ""} onClick={() => resolveDuplicate(row.importRowId, "add")}>Add separately</button>
                          </div>
                        )}
                      </td>
                      <td><input aria-label={`Ticker row ${row.sourceRowNumber}`} value={row.candidate.ticker} onChange={(event) => updateCandidate(row.importRowId, "ticker", event.target.value)} /></td>
                      <td><input aria-label={`Shares row ${row.sourceRowNumber}`} type="number" min="0" step="any" value={row.candidate.shares} onChange={(event) => updateCandidate(row.importRowId, "shares", event.target.value)} /></td>
                      <td><input aria-label={`Dividend per share row ${row.sourceRowNumber}`} type="number" min="0" step="any" value={row.candidate.dividendPerShare} onChange={(event) => updateCandidate(row.importRowId, "dividendPerShare", event.target.value)} /></td>
                      <td><select aria-label={`Frequency row ${row.sourceRowNumber}`} value={row.candidate.frequency} onChange={(event) => updateCandidate(row.importRowId, "frequency", event.target.value)}>
                        {!DIVIDEND_FREQUENCIES[row.candidate.frequency] && <option value={row.candidate.frequency}>{row.candidate.frequency || "Select"}</option>}
                        {Object.keys(DIVIDEND_FREQUENCIES).map((frequency) => <option key={frequency} value={frequency}>{FREQUENCY_LABELS[frequency]}</option>)}
                      </select></td>
                      <td><select aria-label={`Currency row ${row.sourceRowNumber}`} value={row.candidate.currency} onChange={(event) => updateCandidate(row.importRowId, "currency", event.target.value)}>
                        {!['CAD', 'USD'].includes(row.candidate.currency) && <option value={row.candidate.currency}>{row.candidate.currency || "Select"}</option>}
                        <option value="CAD">CAD</option><option value="USD">USD</option>
                      </select></td>
                      <td><input aria-label={`Account row ${row.sourceRowNumber}`} value={row.candidate.account} onChange={(event) => updateCandidate(row.importRowId, "account", event.target.value)} /></td>
                      <td><input aria-label={`Next payment date row ${row.sourceRowNumber}`} type="date" value={row.candidate.nextPaymentDate} onChange={(event) => updateCandidate(row.importRowId, "nextPaymentDate", event.target.value)} /></td>
                      <td><input aria-label={`Notes row ${row.sourceRowNumber}`} value={row.candidate.notes} onChange={(event) => updateCandidate(row.importRowId, "notes", event.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="dividend-import-confirm-summary">
              <strong>{summary.included} holding{summary.included === 1 ? "" : "s"} will be added.</strong>
              <span>Existing holdings will not be changed.</span>
            </div>
          </>
        )}

        <footer>
          <button className="csp-btn" onClick={confirm} disabled={!summary.canConfirm}>IMPORT {summary.included || ""} HOLDING{summary.included === 1 ? "" : "S"}</button>
          <button className="csp-btn-sm" onClick={onClose}>CANCEL</button>
        </footer>
      </section>
    </div>
  );
}
