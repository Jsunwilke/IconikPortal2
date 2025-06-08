import React, { useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  Info,
  Copy,
  FolderOpen,
} from "lucide-react";
import "../../styles/ExportResultModal.css";

const ExportResultModal = ({ isOpen, onClose, result }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !result) return null;

  const { type, success, title, message, stats, details, folderName } = result;

  const getIcon = () => {
    if (success) return CheckCircle;
    if (stats?.failedCount > 0 && stats?.successCount > 0) return AlertTriangle;
    return AlertTriangle;
  };

  const getIconClass = () => {
    if (success) return "modal-success-icon";
    if (stats?.failedCount > 0 && stats?.successCount > 0)
      return "modal-warning-icon";
    return "modal-warning-icon";
  };

  const Icon = getIcon();

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container">
        <div className="modal-header">
          <div className={`modal-icon-container ${getIconClass()}`}>
            <Icon style={{ width: "24px", height: "24px" }} />
          </div>
          <div>
            <h2 className="modal-title">{title}</h2>
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-content">{message}</div>

          {stats && (
            <div className="modal-stats">
              <div className="modal-stats-grid">
                <div className="modal-stat-item">
                  <p className="modal-stat-number modal-total-number">
                    {stats.totalCount || stats.processedCount || 0}
                  </p>
                  <p className="modal-stat-label">Total</p>
                </div>

                {stats.successCount !== undefined && (
                  <div className="modal-stat-item">
                    <p className="modal-stat-number modal-success-number">
                      {stats.successCount}
                    </p>
                    <p className="modal-stat-label">Success</p>
                  </div>
                )}

                {stats.failedCount !== undefined && stats.failedCount > 0 && (
                  <div className="modal-stat-item">
                    <p className="modal-stat-number modal-failed-number">
                      {stats.failedCount}
                    </p>
                    <p className="modal-stat-label">Failed</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {details && (
            <div className="modal-details">
              <div className="modal-details-title">
                <Info style={{ width: "16px", height: "16px" }} />
                Export Details
              </div>
              <div className="modal-details-list">
                {details.map((detail, index) => (
                  <div key={index} className="modal-detail-item">
                    • {detail}
                  </div>
                ))}
              </div>
            </div>
          )}

          {folderName && (
            <div className="modal-details">
              <div className="modal-details-title">
                <FolderOpen style={{ width: "16px", height: "16px" }} />
                Export Location
              </div>
              <div className="modal-folder-info">
                <code className="modal-folder-path">{folderName}</code>
                <button
                  onClick={() => copyToClipboard(folderName)}
                  className="modal-copy-button"
                  title="Copy folder name"
                >
                  {copied ? (
                    <CheckCircle style={{ width: "14px", height: "14px" }} />
                  ) : (
                    <Copy style={{ width: "14px", height: "14px" }} />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="modal-button modal-button-primary"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportResultModal;
