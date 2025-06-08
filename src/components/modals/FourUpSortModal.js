import React, { useState } from "react";
import { ArrowUpDown, CheckCircle } from "lucide-react";
import "../../styles/FourUpSortModal.css";

const FourUpSortModal = ({
  isOpen,
  onClose,
  onContinue,
  students,
  filteredStudents = [],
}) => {
  // Get available fields from students data
  const getAvailableFields = () => {
    if (!students || students.length === 0) return [];

    const allFields = new Set();
    students.forEach((student) => {
      Object.keys(student).forEach((key) => {
        if (!["id", "createdAt", "updatedAt"].includes(key)) {
          allFields.add(key);
        }
      });
    });

    // Common sorting fields in preferred order
    const preferredOrder = [
      "Last Name",
      "First Name",
      "Grade",
      "Teacher",
      "Homeroom",
      "Student ID",
      "Subject ID",
      "SASID",
      "Student Number",
    ];

    const availableFields = [];

    // Add preferred fields first if they exist
    preferredOrder.forEach((field) => {
      if (allFields.has(field)) {
        availableFields.push(field);
        allFields.delete(field);
      }
    });

    // Add remaining fields alphabetically
    const remainingFields = Array.from(allFields).sort();
    availableFields.push(...remainingFields);

    return availableFields;
  };

  const availableFields = getAvailableFields();

  // Default sort order
  const [sortOrder, setSortOrder] = useState([
    "Last Name",
    "First Name",
    "Grade",
    "Teacher",
  ]);

  // Data source selection
  const [useFilteredData, setUseFilteredData] = useState(true);

  if (!isOpen) return null;

  const handleFieldChange = (index, value) => {
    const newOrder = [...sortOrder];
    newOrder[index] = value;
    setSortOrder(newOrder);
  };

  const handleContinue = () => {
    onContinue(sortOrder, useFilteredData);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Calculate counts
  const allStudentsCount = students?.length || 0;
  const filteredStudentsCount = filteredStudents?.length || 0;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container modal-container-compact">
        <div className="modal-header modal-header-compact">
          <div className="modal-icon-container modal-info-icon">
            <ArrowUpDown style={{ width: "20px", height: "20px" }} />
          </div>
          <div>
            <h2 className="modal-title">4-Up Export Sort Order</h2>
          </div>
        </div>

        <div className="modal-body modal-body-compact">
          <div className="modal-content modal-content-compact">
            Choose the sort order for your 4-Up labels and select which students
            to include.
          </div>

          <div className="data-source-selection data-source-selection-compact">
            <h3 className="data-source-title">Students to Export</h3>

            <div className="data-source-options">
              <label className="data-source-option data-source-option-compact">
                <input
                  type="radio"
                  name="dataSource"
                  checked={useFilteredData}
                  onChange={() => setUseFilteredData(true)}
                  className="data-source-radio"
                />
                <span className="data-source-label">
                  <strong>
                    Filtered Students Only ({filteredStudentsCount})
                  </strong>
                  <br />
                  <small>
                    Export only students currently visible in the Students view
                  </small>
                </span>
              </label>

              <label className="data-source-option data-source-option-compact">
                <input
                  type="radio"
                  name="dataSource"
                  checked={!useFilteredData}
                  onChange={() => setUseFilteredData(false)}
                  className="data-source-radio"
                />
                <span className="data-source-label">
                  <strong>All Students ({allStudentsCount})</strong>
                  <br />
                  <small>
                    Export all students in the school (ignores current filters)
                  </small>
                </span>
              </label>
            </div>
          </div>

          <div className="sort-fields-container sort-fields-container-compact">
            <h3 className="sort-fields-title">Sort Priority</h3>

            <div className="sort-fields-grid">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="sort-field-row sort-field-row-compact"
                >
                  <div className="sort-field-number sort-field-number-compact">
                    {index + 1}
                  </div>
                  <select
                    value={sortOrder[index] || ""}
                    onChange={(e) => handleFieldChange(index, e.target.value)}
                    className="sort-field-select sort-field-select-compact"
                  >
                    <option value="">-- Select Field --</option>
                    {availableFields.map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="sort-preview sort-preview-compact">
            <div className="sort-preview-text">
              <strong>Sort:</strong>{" "}
              {sortOrder.filter(Boolean).length > 0 ? (
                sortOrder.filter(Boolean).join(" → ")
              ) : (
                <em>Select at least one field</em>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer modal-footer-compact">
          <button
            onClick={onClose}
            className="modal-button modal-button-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            className="modal-button modal-button-primary"
            disabled={sortOrder.filter(Boolean).length === 0}
          >
            <CheckCircle style={{ width: "16px", height: "16px" }} />
            Create 4-Up PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default FourUpSortModal;
