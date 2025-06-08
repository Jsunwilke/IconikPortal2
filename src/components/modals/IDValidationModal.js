import React from "react";
import { AlertTriangle, Info } from "lucide-react";
import "../../styles/IDValidationModal.css";

const IDValidationModal = ({
  isOpen,
  onClose,
  onContinue,
  validationResult,
  exportType,
}) => {
  if (!isOpen || !validationResult) return null;

  const { missingIds, fieldName } = validationResult;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container">
        <div className="modal-header">
          <div className="modal-icon-container modal-warning-icon">
            <AlertTriangle style={{ width: "24px", height: "24px" }} />
          </div>
          <div>
            <h2 className="modal-title">Missing Student IDs</h2>
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-content">
            {missingIds.length} student{missingIds.length !== 1 ? "s" : ""}{" "}
            {missingIds.length === 1 ? "is" : "are"} missing required{" "}
            {fieldName} values for {exportType} export. These students will not
            import correctly into the school software.
          </div>

          <div className="modal-stats">
            <div className="modal-stats-grid">
              <div className="modal-stat-item">
                <p className="modal-stat-number modal-failed-number">
                  {missingIds.length}
                </p>
                <p className="modal-stat-label">Missing IDs</p>
              </div>
              <div className="modal-stat-item">
                <p className="modal-stat-number modal-total-number">
                  {fieldName}
                </p>
                <p className="modal-stat-label">Required Field</p>
              </div>
            </div>
          </div>

          <div className="modal-details">
            <div className="modal-details-title">
              <Info style={{ width: "16px", height: "16px" }} />
              Students Missing {fieldName}
            </div>
            <div className="missing-students-list">
              {missingIds.map((student, index) => (
                <div key={index} className="missing-student-item">
                  • {student["First Name"]} {student["Last Name"]} (Grade:{" "}
                  {student.Grade || "N/A"})
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="modal-button modal-button-secondary"
          >
            Cancel Export
          </button>
          <button
            onClick={onContinue}
            className="modal-button modal-button-primary"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

export default IDValidationModal;
