export default function CloudSyncControls({ onUpload, onDownload }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <button className="csp-btn" onClick={onUpload}>
        UPLOAD THIS DEVICE TO CLOUD
      </button>
      <button className="csp-btn" onClick={onDownload} style={{ marginLeft: 8 }}>
        DOWNLOAD CLOUD TO THIS DEVICE
      </button>
    </div>
  );
}
