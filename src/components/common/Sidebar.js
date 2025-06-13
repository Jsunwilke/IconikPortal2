import React, { useState } from "react";
import {
  BarChart3,
  Users,
  Upload,
  School,
  Download,
  FileSpreadsheet,
  Archive,
  GraduationCap,
  ChevronDown,
  Grid3x3,
  Bell,
  FolderOpen,
  BookOpen,
} from "lucide-react";
import "../../styles/Sidebar.css";

const Sidebar = ({
  activeView,
  onViewChange,
  userRole,
  selectedSchool,
  selectedSchoolData,
  hasYearbookProofs,
  onExportCSV,
  onExportPSPA,
  onExportTeacherEase,
  onExportSkyward,
  onExportFourUp,
}) => {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "students", label: "Students & Photos", icon: Users },
    { id: "files", label: "Files", icon: FolderOpen },
  ];

  if (userRole === "studio") {
    navItems.splice(
      2,
      0,
      { id: "upload", label: "Upload Data", icon: Upload },
      { id: "schools", label: "Manage Schools", icon: School }
    );
    navItems.push({
      id: "yearbook-proofing",
      label: "Yearbook Proofing",
      icon: BookOpen,
    });
    // Add notifications tab for studio users
    navItems.push({ id: "notifications", label: "Notifications", icon: Bell });
  } else if (userRole === "school" && hasYearbookProofs) {
    // Only show yearbook proofing for school users if proofs exist
    navItems.push({
      id: "yearbook-proofing",
      label: "Yearbook Proofing",
      icon: BookOpen,
    });
  }

  // Get export settings from the selected school
  const exportSettings = selectedSchoolData?.exportSettings || {
    csv: true,
    pspa: false,
    teacherease: false,
    skyward: false,
    fourup: false,
  };

  const exportOptions = [
    {
      id: "csv",
      label: "Export CSV",
      icon: FileSpreadsheet,
      action: onExportCSV,
      enabled: exportSettings.csv,
    },
    {
      id: "pspa",
      label: "Export PSPA",
      icon: Download,
      action: onExportPSPA,
      enabled: exportSettings.pspa,
    },
    {
      id: "teacherease",
      label: "Export TeacherEase",
      icon: Archive,
      action: onExportTeacherEase,
      enabled: exportSettings.teacherease,
    },
    {
      id: "skyward",
      label: "Export Skyward",
      icon: GraduationCap,
      action: onExportSkyward,
      enabled: exportSettings.skyward,
    },
    {
      id: "fourup",
      label: "Export 4-Up Labels",
      icon: Archive,
      action: onExportFourUp,
      enabled: exportSettings.fourup,
    },
  ];

  // Studio users see all exports, school users only see enabled exports
  const enabledExportOptions =
    userRole === "studio"
      ? exportOptions
      : exportOptions.filter((option) => option.enabled);

  const handleExportAction = (option) => {
    if (option.action) {
      option.action();
    }
    setExportMenuOpen(false);
  };

  // For studio users, disable school-specific navigation when no school is selected
  const isNavDisabled = (itemId) => {
    if (userRole !== "studio") return false;
    if (itemId === "schools") return false; // Always allow schools management
    if (itemId === "notifications") return false; // Always allow notifications
    if (itemId === "yearbook-proofing" && userRole === "studio") return false; // Studio users can always access yearbook proofing
    return !selectedSchool; // Disable other items if no school selected
  };

  // Determine if sidebar should be in compact mode (yearbook proofing ONLY)
  const isYearbookCompact = activeView === "yearbook-proofing";

  return (
    <div className={`sidebar ${isYearbookCompact ? "yearbook-compact" : ""}`}>
      {/* Show warning for studio users when no school is selected - hide in compact mode */}
      {userRole === "studio" && !selectedSchool && !isYearbookCompact && (
        <div className="warning-card">
          <div className="warning-title">⚠️ No School Selected</div>
          <div className="warning-text">
            Please select a school from the header dropdown to access student
            data, photos, and files.
          </div>
        </div>
      )}

      <div className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const disabled = isNavDisabled(item.id);
          return (
            <div
              key={item.id}
              className={`nav-item ${
                activeView === item.id && !disabled ? "nav-item-active" : ""
              } ${disabled ? "nav-item-disabled" : ""}`}
              onClick={() => !disabled && onViewChange(item.id)}
              title={isYearbookCompact ? item.label : undefined} // Show tooltip in compact mode
            >
              <Icon style={{ width: "18px", height: "18px" }} />
              {/* Only show text labels when NOT in yearbook compact mode */}
              {!isYearbookCompact && item.label}
              {/* Only show lock icon when NOT in yearbook compact mode */}
              {disabled && !isYearbookCompact && (
                <span className="nav-item-lock">🔒</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Hide export section in compact mode */}
      {selectedSchool &&
        enabledExportOptions.length > 0 &&
        !isYearbookCompact && (
          <div className="nav-section">
            <div className="nav-section-title">Quick Actions</div>

            <div className="export-dropdown">
              <button
                className="export-button"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
              >
                <Download style={{ width: "16px", height: "16px" }} />
                Export Data
                <ChevronDown style={{ width: "16px", height: "16px" }} />
              </button>

              {exportMenuOpen && (
                <div className="export-menu">
                  {enabledExportOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <div
                        key={option.id}
                        className="export-menu-item"
                        onClick={() => handleExportAction(option)}
                      >
                        <Icon style={{ width: "16px", height: "16px" }} />
                        {option.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
};

export default Sidebar;
