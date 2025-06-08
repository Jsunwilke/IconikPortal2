import React, { useState } from "react";
import "../../styles/UploadView.css";

const UploadView = ({ onCSVUpload, onPhotoUpload, selectedSchool }) => {
  const [csvFile, setCsvFile] = useState(null);
  const [photoFiles, setPhotoFiles] = useState(null);

  const handleCSVChange = (e) => {
    setCsvFile(e.target.files[0]);
  };

  const handlePhotoChange = (e) => {
    setPhotoFiles(e.target.files);
  };

  const handleCSVSubmit = () => {
    if (csvFile) {
      onCSVUpload(csvFile);
      setCsvFile(null);
      const csvInput = document.querySelector(
        'input[type="file"][accept=".csv"]'
      );
      if (csvInput) csvInput.value = "";
    }
  };

  const handlePhotoSubmit = () => {
    if (photoFiles) {
      onPhotoUpload(photoFiles);
      setPhotoFiles(null);
      const photoInput = document.querySelector(
        'input[type="file"][accept="image/*"]'
      );
      if (photoInput) photoInput.value = "";
    }
  };

  return (
    <div className="upload-view">
      <div className="card-header">
        <h2 className="card-title">Upload Data</h2>
      </div>

      <div className="upload-grid">
        <div className="upload-card">
          <h3 className="upload-card-title">Upload Student CSV</h3>
          <div className="upload-card-content">
            <div className="upload-alert">
              <p className="upload-alert-text">
                <strong>CSV Format:</strong> Include headers like "First Name",
                "Last Name", "Grade", "Teacher", "Email(s)", etc. The system
                will automatically parse and store all columns from your CSV.
              </p>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVChange}
              className="upload-input"
            />
            {csvFile && (
              <div className="upload-file-info">
                <span className="upload-file-name">{csvFile.name}</span>
                <button
                  onClick={handleCSVSubmit}
                  className="button button-primary"
                >
                  Upload CSV
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="upload-card">
          <h3 className="upload-card-title">Upload Photos</h3>
          <div className="upload-card-content">
            <div className="upload-alert">
              <p className="upload-alert-text">
                <strong>Photo Upload:</strong> Select multiple image files (JPG,
                PNG, etc.). Photos will be stored in Firebase Storage.
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              className="upload-input"
            />
            {photoFiles && (
              <div className="upload-file-info">
                <span className="upload-file-name">
                  {photoFiles.length} files selected
                </span>
                <button
                  onClick={handlePhotoSubmit}
                  className="button button-secondary"
                >
                  Upload Photos
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadView;
