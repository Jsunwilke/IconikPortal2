import React from "react";
import "../../styles/ProgressIndicator.css";

const ProgressIndicator = ({ uploadProgress, uploadStats, onCancel }) => {
  if (!uploadProgress) return null;

  const { current, total, percentage, fileName, operation } = uploadStats || {};

  return (
    <div className="progress-container">
      <div className="progress-header">
        <div className="progress-text">{operation || "Processing"}...</div>
        <button
          onClick={onCancel}
          className="button button-danger progress-cancel"
        >
          Cancel
        </button>
      </div>

      {total && (
        <>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: (percentage || 0) + "%" }}
            />
          </div>
          <div className="progress-stats">
            <span className="progress-detail">
              {current || 0} of {total} files
            </span>
            <span className="progress-detail">{percentage || 0}%</span>
          </div>
        </>
      )}

      {fileName && <div className="progress-detail">Current: {fileName}</div>}
      <div className="progress-status">{uploadProgress}</div>
    </div>
  );
};

export default ProgressIndicator;
