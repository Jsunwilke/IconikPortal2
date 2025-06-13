import React, { useState } from "react";
import { Camera } from "lucide-react";
import "../../styles/UploadView.css";

const UploadView = ({
  onCSVUpload,
  onPhotoUpload,
  onRetakesUpload,
  selectedSchool,
  userRole,
}) => {
  const [csvFile, setCsvFile] = useState(null);
  const [photoFiles, setPhotoFiles] = useState(null);
  const [retakesCsvFile, setRetakesCsvFile] = useState(null);
  const [retakesPhotoFiles, setRetakesPhotoFiles] = useState(null);

  const handleCSVChange = (e) => {
    setCsvFile(e.target.files[0]);
  };

  const handlePhotoChange = (e) => {
    setPhotoFiles(e.target.files);
  };

  const handleRetakesCSVChange = (e) => {
    setRetakesCsvFile(e.target.files[0]);
  };

  const handleRetakesPhotoChange = (e) => {
    setRetakesPhotoFiles(e.target.files);
  };

  const handleCSVSubmit = () => {
    if (csvFile) {
      onCSVUpload(csvFile);
      setCsvFile(null);
      const csvInput = document.querySelector(
        'input[type="file"][accept=".csv"]:not(#retakes-csv-input)'
      );
      if (csvInput) csvInput.value = "";
    }
  };

  const handlePhotoSubmit = () => {
    if (photoFiles) {
      onPhotoUpload(photoFiles);
      setPhotoFiles(null);
      const photoInput = document.querySelector(
        'input[type="file"][accept="image/*"]:not(#retakes-photo-input)'
      );
      if (photoInput) photoInput.value = "";
    }
  };

  const handleRetakesCSVSubmit = () => {
    if (retakesCsvFile) {
      onRetakesUpload(retakesCsvFile, "csv");
      setRetakesCsvFile(null);
      const retakesInput = document.querySelector("#retakes-csv-input");
      if (retakesInput) retakesInput.value = "";
    }
  };

  const handleRetakesPhotoSubmit = () => {
    if (retakesPhotoFiles) {
      onRetakesUpload(retakesPhotoFiles, "photos");
      setRetakesPhotoFiles(null);
      const retakesPhotoInput = document.querySelector("#retakes-photo-input");
      if (retakesPhotoInput) retakesPhotoInput.value = "";
    }
  };

  // Only show retakes/makeups section for studio users
  const showRetakesSection = userRole === "studio";

  return (
    <div className="upload-view">
      <div className="card-header">
        <h2 className="card-title">Upload Data</h2>
      </div>

      <div className="upload-section-title">Initial Import</div>
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

      {showRetakesSection && (
        <>
          <div className="upload-section-divider"></div>
          <div className="upload-section-title">
            <Camera style={{ width: "18px", height: "18px" }} />
            Retakes & Makeups Import
          </div>
          <div className="upload-grid">
            <div className="upload-card">
              <h3 className="upload-card-title">Upload Retakes/Makeups CSV</h3>
              <div className="upload-card-content">
                <div className="upload-alert upload-alert-info">
                  <p className="upload-alert-text">
                    <strong>Retakes/Makeups:</strong> System will match students
                    by Online Code. Existing students will be marked as "Retake"
                    with photo archived. New students will be marked as
                    "Makeup".
                  </p>
                </div>
                <input
                  id="retakes-csv-input"
                  type="file"
                  accept=".csv"
                  onChange={handleRetakesCSVChange}
                  className="upload-input"
                />
                {retakesCsvFile && (
                  <div className="upload-file-info">
                    <span className="upload-file-name">
                      {retakesCsvFile.name}
                    </span>
                    <button
                      onClick={handleRetakesCSVSubmit}
                      className="button button-primary"
                    >
                      Upload Retakes CSV
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="upload-card">
              <h3 className="upload-card-title">
                Upload Retakes/Makeups Photos
              </h3>
              <div className="upload-card-content">
                <div className="upload-alert upload-alert-info">
                  <p className="upload-alert-text">
                    <strong>Photo Processing:</strong> Photos will be matched to
                    students and previous photos will be archived with metadata
                    preserved.
                  </p>
                </div>
                <input
                  id="retakes-photo-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleRetakesPhotoChange}
                  className="upload-input"
                />
                {retakesPhotoFiles && (
                  <div className="upload-file-info">
                    <span className="upload-file-name">
                      {retakesPhotoFiles.length} files selected
                    </span>
                    <button
                      onClick={handleRetakesPhotoSubmit}
                      className="button button-secondary"
                    >
                      Upload Retakes Photos
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UploadView;
