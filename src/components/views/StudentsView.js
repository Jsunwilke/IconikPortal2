import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  Download,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Camera,
  History,
  RotateCcw,
  X,
} from "lucide-react";
import "../../styles/StudentsView.css";

// Helper function to find photo for student (moved here since it's view-specific logic)
const findStudentPhoto = (student, photos) => {
  if (!student || !photos || photos.length === 0) return null;

  if (student["Images"]) {
    const photo = photos.find((p) => p && p.name === student["Images"]);
    if (photo) return photo;
  }

  const firstName = student["First Name"];
  const lastName = student["Last Name"];
  if (!firstName || !lastName) return null;

  const expectedName = (firstName + "_" + lastName + ".jpg").replace(
    /\s+/g,
    "_"
  );
  const photo = photos.find((p) => p && p.name === expectedName);
  if (photo) return photo;

  const firstNameLower = firstName.toLowerCase() || "";
  const lastNameLower = lastName.toLowerCase() || "";
  const looseMatch = photos.find((p) => {
    if (!p || !p.name) return false;
    const photoName = p.name.toLowerCase();
    return (
      photoName.includes(firstNameLower) && photoName.includes(lastNameLower)
    );
  });

  return looseMatch || null;
};

const StudentsView = ({
  students = [],
  photos = [],
  selectedSchool,
  onExport,
  onExportPSPA,
  onUpdateStudent,
  onDeleteStudent,
  userRole,
  onPhotoReplace,
  onLoadPhotoVersions,
  onRestorePhotoVersion,
  onDeletePhotoVersion,
  onFilteredStudentsChange,
}) => {
  const [viewMode, setViewMode] = useState("grid");
  const [groupBy, setGroupBy] = useState("grade");
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [sortBy, setSortBy] = useState("lastName");
  const [sortOrder, setSortOrder] = useState("asc");
  const [groupsDropdownOpen, setGroupsDropdownOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [filtersDropdownOpen, setFiltersDropdownOpen] = useState(false);
  const [photoVersions, setPhotoVersions] = useState(null);
  const [showVersionHistory, setShowVersionHistory] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Refs for click-away detection
  const groupsDropdownRef = useRef(null);
  const filtersDropdownRef = useRef(null);

  // Debug: Log when students prop changes
  useEffect(() => {
    console.log(
      "StudentsView received students update:",
      students.length,
      "students"
    );
    console.log(
      "First few students:",
      students.slice(0, 3).map((s) => ({
        id: s.id,
        name: `${s["First Name"]} ${s["Last Name"]}`,
        grade: s.Grade,
      }))
    );
  }, [students]);

  // Available filter options
  const filterOptions = [
    { id: "missing-photo", label: "Students without photos" },
    { id: "missing-subject-id", label: "Students without Subject ID" },
    { id: "missing-email", label: "Students without email" },
    { id: "missing-grade", label: "Students without grade" },
    { id: "missing-teacher", label: "Students without teacher" },
  ];

  // Click-away effect for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check groups dropdown
      if (
        groupsDropdownRef.current &&
        !groupsDropdownRef.current.contains(event.target)
      ) {
        setGroupsDropdownOpen(false);
      }

      // Check filters dropdown
      if (
        filtersDropdownRef.current &&
        !filtersDropdownRef.current.contains(event.target)
      ) {
        setFiltersDropdownOpen(false);
      }
    };

    // Add event listener
    document.addEventListener("mousedown", handleClickOutside);

    // Cleanup
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter students based on search term and active filters
  const getFilteredStudents = (studentsToFilter) => {
    let filtered = [...studentsToFilter];

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((student) => {
        const firstName = (student["First Name"] || "").toLowerCase();
        const lastName = (student["Last Name"] || "").toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        const reverseFullName = `${lastName} ${firstName}`.trim();
        const grade = (student.Grade || "").toString().toLowerCase();
        const teacher = (student.Teacher || "").toLowerCase();
        const email = (student["Email(s)"] || "").toLowerCase();

        // Check if search term matches individual fields
        const matchesIndividualFields =
          firstName.includes(search) ||
          lastName.includes(search) ||
          grade.includes(search) ||
          teacher.includes(search) ||
          email.includes(search);

        // Check if search term matches full name in either order
        const matchesFullName =
          fullName.includes(search) || reverseFullName.includes(search);

        return matchesIndividualFields || matchesFullName;
      });
    }

    // Apply active filters
    activeFilters.forEach((filterId) => {
      switch (filterId) {
        case "missing-photo":
          filtered = filtered.filter(
            (student) => !findStudentPhoto(student, photos)
          );
          break;
        case "missing-subject-id":
          filtered = filtered.filter(
            (student) =>
              !student["Subject ID"] || student["Subject ID"].trim() === ""
          );
          break;
        case "missing-email":
          filtered = filtered.filter(
            (student) =>
              !student["Email(s)"] || student["Email(s)"].trim() === ""
          );
          break;
        case "missing-grade":
          filtered = filtered.filter(
            (student) => !student.Grade || student.Grade.trim() === ""
          );
          break;
        case "missing-teacher":
          filtered = filtered.filter(
            (student) => !student.Teacher || student.Teacher.trim() === ""
          );
          break;
        default:
          break;
      }
    });

    return filtered;
  };

  // Sort students
  const getSortedStudents = (studentsToSort) => {
    const filtered = getFilteredStudents(studentsToSort);
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "firstName":
          aValue = (a["First Name"] || "").toLowerCase();
          bValue = (b["First Name"] || "").toLowerCase();
          break;
        case "lastName":
          aValue = (a["Last Name"] || "").toLowerCase();
          bValue = (b["Last Name"] || "").toLowerCase();
          break;
        case "grade":
          aValue = parseInt(a.Grade || "0");
          bValue = parseInt(b.Grade || "0");
          break;
        case "teacher":
          aValue = (a.Teacher || "").toLowerCase();
          bValue = (b.Teacher || "").toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  // Group students based on selected grouping
  const getGroupedStudents = () => {
    const sortedStudents = getSortedStudents(students);

    if (groupBy === "none") {
      return { "All Students": sortedStudents };
    }

    const groups = {};
    sortedStudents.forEach((student) => {
      let groupKey = "Unknown";

      switch (groupBy) {
        case "grade":
          groupKey = student.Grade || "No Grade";
          break;
        case "teacher":
          groupKey = student.Teacher || "No Teacher";
          break;
        case "homeroom":
          groupKey = student.Homeroom || "No Homeroom";
          break;
        default:
          groupKey = "All Students";
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(student);
    });

    // Sort groups by key (natural sort for grades)
    const sortedGroups = {};
    Object.keys(groups)
      .sort((a, b) => {
        // For grade sorting, handle numeric values properly
        if (groupBy === "grade" && !isNaN(a) && !isNaN(b)) {
          return parseInt(a) - parseInt(b);
        }
        return a.localeCompare(b);
      })
      .forEach((key) => {
        sortedGroups[key] = groups[key];
      });

    return sortedGroups;
  };

  const allGroups = getGroupedStudents();
  const availableGroups = Object.keys(allGroups);

  // Initialize selected groups when groupBy changes
  useEffect(() => {
    if (groupBy === "none") {
      setSelectedGroups(new Set(["All Students"]));
    } else {
      setSelectedGroups(new Set(availableGroups));
    }
    setGroupsDropdownOpen(false);
  }, [groupBy, JSON.stringify(availableGroups)]);

  // Track filtered students and report to parent
  useEffect(() => {
    const allGroupedStudents = getGroupedStudents();
    const currentFilteredStudents = [];

    Object.entries(allGroupedStudents).forEach(([groupName, groupStudents]) => {
      if (selectedGroups.has(groupName)) {
        currentFilteredStudents.push(...groupStudents);
      }
    });

    // Report filtered students to parent component
    if (onFilteredStudentsChange) {
      onFilteredStudentsChange(currentFilteredStudents);
    }
  }, [
    searchTerm,
    activeFilters,
    selectedGroups,
    groupBy,
    students,
    photos,
    onFilteredStudentsChange,
  ]);

  // Filter groups based on selection
  const filteredGroups = {};
  Object.entries(allGroups).forEach(([groupName, groupStudents]) => {
    if (selectedGroups.has(groupName)) {
      filteredGroups[groupName] = groupStudents;
    }
  });

  // Calculate current visible students count
  const visibleStudentsCount = Object.values(filteredGroups).reduce(
    (total, groupStudents) => total + groupStudents.length,
    0
  );

  const handleGroupSelection = (groupName, checked) => {
    const newSelected = new Set(selectedGroups);
    if (checked) {
      newSelected.add(groupName);
    } else {
      newSelected.delete(groupName);
    }
    setSelectedGroups(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedGroups(new Set(availableGroups));
  };

  const handleSelectNone = () => {
    setSelectedGroups(new Set());
  };

  const allSelected = selectedGroups.size === availableGroups.length;
  const noneSelected = selectedGroups.size === 0;

  const toggleGroupCollapse = (groupName) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(groupName)) {
      newCollapsed.delete(groupName);
    } else {
      newCollapsed.add(groupName);
    }
    setCollapsedGroups(newCollapsed);
  };

  const handleCollapseAll = () => {
    if (collapsedGroups.size === 0) {
      // Collapse all groups
      setCollapsedGroups(new Set(Object.keys(allGroups)));
    } else {
      // Expand all groups
      setCollapsedGroups(new Set());
    }
  };

  const handleFilterToggle = (filterId) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(filterId)) {
      newFilters.delete(filterId);
    } else {
      newFilters.add(filterId);
    }
    setActiveFilters(newFilters);
  };

  const clearAllFilters = () => {
    setActiveFilters(new Set());
    setSearchTerm("");
  };

  // Edit student functions
  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setEditForm({ ...student });
  };

  const handleCancelEdit = () => {
    setEditingStudent(null);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    try {
      await onUpdateStudent(editingStudent.id, editForm);
      setEditingStudent(null);
      setEditForm({});
    } catch (error) {
      alert("Error updating student: " + error.message);
    }
  };

  const handleInputChange = (field, value) => {
    setEditForm({ ...editForm, [field]: value });
  };

  // Delete student function
  const handleDeleteStudent = async (student) => {
    const confirmMessage = `Are you sure you want to delete ${student["First Name"]} ${student["Last Name"]}?\n\nThis will permanently remove:\n• Student record from database\n• Associated photo from storage\n\nThis action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await onDeleteStudent(student.id, student);
    } catch (error) {
      alert("Error deleting student: " + error.message);
    }
  };

  // Photo viewing functions
  const handlePhotoClick = (photo, student) => {
    setViewingPhoto({ photo, student });
  };

  const handleClosePhotoView = () => {
    setViewingPhoto(null);
  };

  // Photo replacement functions
  const handlePhotoFileSelect = async (event, student) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("Image file is too large. Please select a file smaller than 10MB.");
      return;
    }

    try {
      await onPhotoReplace(student, file);
      // Clear the input
      event.target.value = "";
    } catch (error) {
      alert("Error replacing photo: " + error.message);
    }
  };

  // Photo version history functions
  const handleShowVersionHistory = async (student) => {
    try {
      const versions = await onLoadPhotoVersions(student.id);
      setPhotoVersions(versions);
      setShowVersionHistory(student);
    } catch (error) {
      alert("Error loading photo versions: " + error.message);
    }
  };

  const handleRestoreVersion = async (version) => {
    setConfirmDialog({
      title: "Restore Photo Version",
      message: `Restore photo version from ${version.uploadDate.toLocaleString()}?`,
      details: [
        `File: ${version.originalName}`,
        "Current photo will be archived to version history",
        "This will become the active photo",
      ],
      confirmText: "Restore",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await onRestorePhotoVersion(showVersionHistory, version);
          setShowVersionHistory(null);
          setPhotoVersions(null);
        } catch (error) {
          alert("Error restoring photo version: " + error.message);
        }
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const handleDeleteVersion = async (version) => {
    setConfirmDialog({
      title: "Delete Photo Version",
      message: "Permanently delete this photo version?",
      details: [
        `File: ${version.originalName}`,
        `Date: ${version.uploadDate.toLocaleString()}`,
        "This action cannot be undone",
      ],
      confirmText: "Delete",
      confirmStyle: "danger",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await onDeletePhotoVersion(version);
          // Refresh the version list
          const updatedVersions = await onLoadPhotoVersions(
            showVersionHistory.id
          );
          setPhotoVersions(updatedVersions);
        } catch (error) {
          alert("Error deleting photo version: " + error.message);
        }
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const handleCloseVersionHistory = () => {
    setShowVersionHistory(null);
    setPhotoVersions(null);
  };

  // Debug logging for render
  console.log("StudentsView rendering with", students.length, "students");

  return (
    <div className="students-view">
      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div
          className="modal-overlay"
          onClick={confirmDialog.onCancel}
          style={{ zIndex: 6000 }}
        >
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div
                className={`modal-icon-container ${
                  confirmDialog.confirmStyle === "danger"
                    ? "modal-warning-icon"
                    : "modal-info-icon"
                }`}
              >
                {confirmDialog.confirmStyle === "danger" ? (
                  <Trash2 style={{ width: "24px", height: "24px" }} />
                ) : (
                  <RotateCcw style={{ width: "24px", height: "24px" }} />
                )}
              </div>
              <div>
                <h2 className="modal-title">{confirmDialog.title}</h2>
              </div>
            </div>

            <div className="modal-body">
              <div className="modal-content">{confirmDialog.message}</div>

              {confirmDialog.details && (
                <div className="modal-details">
                  <div className="modal-details-list">
                    {confirmDialog.details.map((detail, index) => (
                      <div key={index} className="modal-detail-item">
                        • {detail}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={confirmDialog.onCancel}
                className="modal-button modal-button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`modal-button ${
                  confirmDialog.confirmStyle === "danger"
                    ? "modal-button-danger"
                    : "modal-button-primary"
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Version History Modal */}
      {showVersionHistory && (
        <div className="modal-overlay" onClick={handleCloseVersionHistory}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-container modal-info-icon">
                <History style={{ width: "24px", height: "24px" }} />
              </div>
              <div>
                <h2 className="modal-title">Photo Version History</h2>
              </div>
            </div>

            <div className="modal-body">
              <div className="modal-content">
                {showVersionHistory["First Name"]}{" "}
                {showVersionHistory["Last Name"]}
              </div>

              {photoVersions && photoVersions.length > 0 ? (
                <div className="modal-details">
                  <div className="modal-details-title">
                    <History style={{ width: "16px", height: "16px" }} />
                    Previous Versions
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      gap: "1rem",
                      overflowX: "auto",
                      padding: "1rem 0.5rem",
                      minHeight: "200px",
                    }}
                  >
                    {photoVersions.map((version, index) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          padding: "0.75rem",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "0.5rem",
                          textAlign: "center",
                          minWidth: "150px",
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src={version.url}
                          alt={`Version ${index + 1}`}
                          style={{
                            width: "80px",
                            height: "80px",
                            objectFit: "cover",
                            borderRadius: "0.375rem",
                            border: "1px solid #e2e8f0",
                            marginBottom: "0.5rem",
                          }}
                        />
                        <div style={{ width: "100%" }}>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              color: "#1f2937",
                              marginBottom: "0.25rem",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "130px",
                            }}
                          >
                            {version.originalName}
                          </div>
                          <div
                            style={{
                              fontSize: "0.625rem",
                              color: "#6b7280",
                              marginBottom: "0.5rem",
                              lineHeight: "1.3",
                            }}
                          >
                            {version.uploadDate.toLocaleDateString()} at{" "}
                            {version.uploadDate.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              justifyContent: "center",
                            }}
                          >
                            <button
                              onClick={() => handleRestoreVersion(version)}
                              className="modal-button modal-button-primary"
                              style={{
                                padding: "0.5rem 0.75rem",
                                fontSize: "0.75rem",
                              }}
                            >
                              <RotateCcw
                                style={{ width: "14px", height: "14px" }}
                              />
                              Restore
                            </button>
                            <button
                              onClick={() => handleDeleteVersion(version)}
                              className="modal-button modal-button-secondary"
                              style={{
                                padding: "0.5rem 0.75rem",
                                fontSize: "0.75rem",
                                backgroundColor: "#ef4444",
                                color: "white",
                                border: "none",
                              }}
                              title="Delete this version permanently"
                            >
                              <X style={{ width: "14px", height: "14px" }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="modal-details">
                  <div className="modal-details-title">
                    <History style={{ width: "16px", height: "16px" }} />
                    No Previous Versions
                  </div>
                  <div className="modal-details-list">
                    <div className="modal-detail-item">
                      This student has no photo version history yet.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={handleCloseVersionHistory}
                className="modal-button modal-button-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {viewingPhoto && (
        <div className="photo-lightbox" onClick={handleClosePhotoView}>
          <div className="photo-lightbox-content">
            {/* Close button */}
            <button
              onClick={handleClosePhotoView}
              className="photo-lightbox-close"
            >
              ✕
            </button>

            {/* Photo */}
            <img
              src={viewingPhoto.photo.url}
              alt={
                viewingPhoto.student["First Name"] +
                " " +
                viewingPhoto.student["Last Name"]
              }
              className="photo-lightbox-image"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Student info overlay */}
            <div className="photo-lightbox-info">
              <h3 className="photo-lightbox-name">
                {viewingPhoto.student["First Name"]}{" "}
                {viewingPhoto.student["Last Name"]}
              </h3>
              <p className="photo-lightbox-details">
                Grade {viewingPhoto.student.Grade} •{" "}
                {viewingPhoto.student.Teacher}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingStudent && (
        <div className="edit-modal-overlay">
          <div className="edit-modal-content">
            <div className="edit-modal-header">
              <h2 className="edit-modal-title">Edit Student</h2>
              <button onClick={handleCancelEdit} className="edit-modal-close">
                ✕
              </button>
            </div>

            <div className="edit-modal-form">
              {/* Define the desired field order */}
              {(() => {
                const allFields = Object.keys(editForm).filter(
                  (key) => !["id", "createdAt", "updatedAt"].includes(key)
                );

                // Preferred field order
                const fieldOrder = [
                  "First Name",
                  "Last Name",
                  "Grade",
                  "Teacher",
                  "Homeroom",
                  "Images",
                  "Student ID",
                  "Subject ID",
                  "SASID",
                  "Student Number",
                  "Email(s)",
                ];

                // Start with preferred fields in order, then add any remaining fields
                const orderedFields = [];
                fieldOrder.forEach((field) => {
                  if (allFields.includes(field)) {
                    orderedFields.push(field);
                  }
                });

                // Add any remaining fields that weren't in the preferred order
                allFields.forEach((field) => {
                  if (!orderedFields.includes(field)) {
                    orderedFields.push(field);
                  }
                });

                return orderedFields.map((field) => (
                  <div key={field} className="edit-modal-field">
                    <label className="edit-modal-label">{field}</label>
                    <input
                      type="text"
                      value={editForm[field] || ""}
                      onChange={(e) => handleInputChange(field, e.target.value)}
                      className="edit-modal-input"
                    />
                  </div>
                ));
              })()}
            </div>

            <div className="edit-modal-actions">
              <button
                onClick={handleCancelEdit}
                className="button button-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="button button-primary"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card-header">
        <div>
          <h2 className="card-title">Students & Photos</h2>
          <p className="students-summary">
            {students.length} students • {photos.length} photos available
          </p>
        </div>
        <div className="students-actions">
          <button
            onClick={onExportPSPA}
            className="button button-primary"
            disabled={students.length === 0}
          >
            <Download style={{ width: "16px", height: "16px" }} />
            Export PSPA
          </button>
          <button
            onClick={onExport}
            className="button button-secondary"
            disabled={students.length === 0}
          >
            <FileSpreadsheet style={{ width: "16px", height: "16px" }} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="search-filter-bar">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search students by name, grade, teacher, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {(searchTerm || activeFilters.size > 0) && (
            <button onClick={clearAllFilters} className="clear-filters-button">
              Clear All
            </button>
          )}
        </div>

        <div className="filter-section">
          <div className="filter-dropdown" ref={filtersDropdownRef}>
            <button
              onClick={() => setFiltersDropdownOpen(!filtersDropdownOpen)}
              className="filter-dropdown-button"
            >
              <span>
                Filters {activeFilters.size > 0 && `(${activeFilters.size})`}
              </span>
              <span
                className={`filter-dropdown-arrow ${
                  filtersDropdownOpen ? "open" : ""
                }`}
              >
                ▼
              </span>
            </button>

            {filtersDropdownOpen && (
              <div className="filter-dropdown-menu">
                {filterOptions.map((option) => (
                  <div
                    key={option.id}
                    className={`filter-dropdown-item ${
                      activeFilters.has(option.id) ? "selected" : ""
                    }`}
                    onClick={() => handleFilterToggle(option.id)}
                  >
                    <input
                      type="checkbox"
                      checked={activeFilters.has(option.id)}
                      onChange={() => handleFilterToggle(option.id)}
                      className="filter-checkbox"
                    />
                    <span className="filter-label">{option.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Student Count Display */}
          <div className="student-count-display">
            Showing {visibleStudentsCount} of {students.length} students
          </div>
        </div>
      </div>

      {/* Controls Row */}
      <div className="students-controls">
        <div className="controls-grid">
          {/* Group By */}
          <div className="control-group">
            <label className="control-label">Group by</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="control-select"
            >
              <option value="none">No Grouping</option>
              <option value="grade">Grade</option>
              <option value="teacher">Teacher</option>
              <option value="homeroom">Homeroom</option>
            </select>
          </div>

          {/* Group Filter Dropdown */}
          {groupBy !== "none" && availableGroups.length > 1 && (
            <div className="control-group control-group-flex">
              <label className="control-label">Show groups</label>
              <div className="groups-dropdown" ref={groupsDropdownRef}>
                <button
                  onClick={() => setGroupsDropdownOpen(!groupsDropdownOpen)}
                  className="groups-dropdown-button"
                >
                  <span>
                    Groups ({selectedGroups.size} of {availableGroups.length})
                  </span>
                  <span
                    className={`groups-dropdown-arrow ${
                      groupsDropdownOpen ? "open" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>

                {groupsDropdownOpen && (
                  <div className="groups-dropdown-menu">
                    {/* All Groups checkbox */}
                    <div className="groups-dropdown-all">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(input) => {
                          if (input)
                            input.indeterminate = !allSelected && !noneSelected;
                        }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleSelectAll();
                          } else {
                            handleSelectNone();
                          }
                        }}
                        className="groups-checkbox"
                      />
                      <span className="groups-label-all">All Groups</span>
                    </div>

                    {/* Individual group checkboxes */}
                    {availableGroups.map((group) => (
                      <div
                        key={group}
                        className={`groups-dropdown-item ${
                          selectedGroups.has(group) ? "selected" : ""
                        }`}
                        onClick={() =>
                          handleGroupSelection(
                            group,
                            !selectedGroups.has(group)
                          )
                        }
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroups.has(group)}
                          onChange={(e) =>
                            handleGroupSelection(group, e.target.checked)
                          }
                          className="groups-checkbox"
                        />
                        <span className="groups-label">{group}</span>
                        <span className="groups-count">
                          {allGroups[group]?.length || 0}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collapse All Button */}
          {groupBy !== "none" && Object.keys(filteredGroups).length > 1 && (
            <div className="control-group">
              <button
                onClick={handleCollapseAll}
                className="collapse-all-button"
              >
                {collapsedGroups.size === 0 ? "Collapse All" : "Expand All"}
              </button>
            </div>
          )}

          {/* Sort By */}
          <div className="control-group">
            <label className="control-label">Sort by</label>
            <div className="sort-controls">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="control-select"
              >
                <option value="lastName">Last Name</option>
                <option value="firstName">First Name</option>
                <option value="grade">Grade</option>
                <option value="teacher">Teacher</option>
              </select>
              <button
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="sort-order-button"
                title={
                  sortOrder === "asc" ? "Sort Descending" : "Sort Ascending"
                }
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="students-card">
          <div className="empty-state">
            <Users className="empty-state-icon" />
            <h3 className="empty-state-title">No Students Found</h3>
            <p className="empty-state-text">
              Upload a CSV file to get started with student data.
            </p>
          </div>
        </div>
      ) : (
        <div>
          {Object.entries(filteredGroups).map(([groupName, groupStudents]) => (
            <div
              key={`${groupName}-${groupStudents.length}`}
              className="students-card"
            >
              {groupBy !== "none" && (
                <div
                  className="group-header"
                  onClick={() => toggleGroupCollapse(groupName)}
                >
                  <h3 className="group-title">
                    <span
                      className={`group-arrow ${
                        collapsedGroups.has(groupName) ? "" : "open"
                      }`}
                    >
                      ▶
                    </span>
                    {groupBy === "grade" ? `Grade ${groupName}` : groupName}
                    <span className="group-count">
                      {groupStudents.length} student
                      {groupStudents.length !== 1 ? "s" : ""}
                    </span>
                  </h3>
                </div>
              )}

              {!collapsedGroups.has(groupName) && (
                <div className="students-grid">
                  {groupStudents.map((student) => {
                    const photo = findStudentPhoto(student, photos);
                    return (
                      <div
                        key={`${student.id}-${
                          student.updatedAt || "no-update"
                        }`}
                        className="student-card"
                      >
                        {/* Edit button */}
                        <button
                          onClick={() => handleEditStudent(student)}
                          className="student-edit-button"
                          title="Edit Student"
                        >
                          <Edit2 style={{ width: "14px", height: "14px" }} />
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteStudent(student)}
                          className="student-delete-button"
                          title="Delete Student"
                        >
                          <Trash2 style={{ width: "14px", height: "14px" }} />
                        </button>

                        <div className="student-photo-container">
                          {photo ? (
                            <>
                              <img
                                src={photo.url}
                                alt={
                                  student["First Name"] +
                                  " " +
                                  student["Last Name"]
                                }
                                className="student-photo"
                                onClick={() => handlePhotoClick(photo, student)}
                                title="Click to view full image"
                              />
                              {/* Replace photo button - Only for studio users */}
                              {userRole === "studio" && (
                                <>
                                  <div className="photo-replace-overlay">
                                    <label
                                      className="replace-photo-button"
                                      title="Replace Photo"
                                    >
                                      <Camera
                                        style={{
                                          width: "16px",
                                          height: "16px",
                                        }}
                                      />
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) =>
                                          handlePhotoFileSelect(e, student)
                                        }
                                        style={{ display: "none" }}
                                      />
                                    </label>
                                  </div>
                                  <div className="photo-history-overlay">
                                    <button
                                      className="photo-history-button"
                                      title="View Photo History"
                                      onClick={() =>
                                        handleShowVersionHistory(student)
                                      }
                                    >
                                      <History
                                        style={{
                                          width: "16px",
                                          height: "16px",
                                        }}
                                      />
                                    </button>
                                  </div>
                                </>
                              )}
                            </>
                          ) : (
                            <div className="student-no-photo">
                              <Users
                                style={{ width: "28px", height: "28px" }}
                              />
                              <span>No Photo</span>
                              {/* Add photo button - Only for studio users */}
                              {userRole === "studio" && (
                                <label
                                  className="add-photo-button"
                                  title="Add Photo"
                                >
                                  <Camera
                                    style={{
                                      width: "16px",
                                      height: "16px",
                                      marginRight: "4px",
                                    }}
                                  />
                                  Add Photo
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                      handlePhotoFileSelect(e, student)
                                    }
                                    style={{ display: "none" }}
                                  />
                                </label>
                              )}
                            </div>
                          )}
                          {!photo && (
                            <div className="student-missing-badge">
                              <span className="missing-label">Missing</span>
                            </div>
                          )}
                        </div>

                        <div className="student-info">
                          <h3 className="student-name">
                            {student["First Name"]} {student["Last Name"]}
                          </h3>
                          <p className="student-detail">
                            Grade {student.Grade} • {student.Teacher}
                          </p>
                          {student.Homeroom && (
                            <p className="student-detail">
                              Room: {student.Homeroom}
                            </p>
                          )}
                          {student["Email(s)"] && (
                            <p className="student-email">
                              {student["Email(s)"]}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentsView;
