import React from "react";
import { Info, FolderOpen, CheckCircle } from "lucide-react";
import "../../styles/PSPAInstructionModal.css";

const PSPAInstructionModal = ({ isOpen, onClose, onContinue }) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container">
        <div className="modal-header">
          <div className="modal-icon-container modal-info-icon">
            <Info style={{ width: "24px", height: "24px" }} />
          </div>
          <div>
            <h2 className="modal-title">PSPA Export Instructions</h2>
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-content">
            You'll select a folder location, then your browser will ask for
            permission to save files. This permission popup is normal and safe
            to accept.
          </div>

          <div className="instruction-steps">
            <div className="instruction-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <div className="step-title">Select Folder Location</div>
                <div className="step-description">
                  Choose where to save your PSPA package (Desktop, Documents,
                  etc.).
                </div>
              </div>
            </div>

            <div className="instruction-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <div className="step-title">Browser Permission Popup</div>
                <div className="step-description">
                  Browser will ask for permission - click "Edit files" to
                  continue.
                </div>
                <div className="popup-example">
                  <img
                    src="/images/browser-permission-popup.png"
                    alt="Browser permission popup example"
                    className="popup-screenshot"
                  />
                  <div className="click-indicator">← Click "Edit files"</div>
                </div>
              </div>
            </div>

            <div className="instruction-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <div className="step-title">Processing Complete</div>
                <div className="step-description">
                  System creates your PSPA package ready for yearbook software.
                </div>
              </div>
            </div>
          </div>

          <div className="instruction-note">
            <Info style={{ width: "14px", height: "14px" }} />
            <div>
              <strong>Note:</strong> The permission popup is normal browser
              security.
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="modal-button modal-button-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="modal-button modal-button-primary"
          >
            <CheckCircle style={{ width: "16px", height: "16px" }} />I
            Understand, Continue Export
          </button>
        </div>
      </div>
    </div>
  );
};

export default PSPAInstructionModal;
