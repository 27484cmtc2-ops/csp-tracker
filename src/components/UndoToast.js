export default function UndoToast({ entry, error, onUndo }) {
  if (!entry && !error) return null;

  return (
    <div className={`undo-toast${error ? " undo-toast-error" : ""}`} role="status">
      <span>{error || entry.message}</span>
      {entry && <button type="button" onClick={onUndo}>UNDO</button>}
    </div>
  );
}
