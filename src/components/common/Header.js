import React from "react";
import { LogOut } from "lucide-react";
import NotificationsPanel from "./NotificationsPanel";
import "../../styles/Header.css";

const Header = ({
  user,
  userRole,
  schools,
  selectedSchool,
  onSchoolChange,
  onLogout,
}) => {
  const selectedSchoolData = schools.find((s) => s.id === selectedSchool);

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <img
            src="/images/iconik-studio-schools-logo.png"
            alt="Iconik Studio Schools"
            className="logo-image"
          />
          <h1 className="title">School Photo Management</h1>
        </div>

        {/* Only show school selector for studio users */}
        {userRole === "studio" ? (
          <div className="school-selector">
            <span className="school-label">School:</span>
            <select
              value={selectedSchool || ""}
              onChange={(e) => onSchoolChange(e.target.value)}
              className="school-select"
            >
              <option value="">Select a school...</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          /* For school users, show their school name as read-only */
          selectedSchoolData && (
            <div className="school-selector">
              <span className="school-label">School:</span>
              <div className="school-select school-select-readonly">
                {selectedSchoolData.name}
              </div>
            </div>
          )
        )}

        <div className="user-info">
          {/* Notifications Panel - Only for studio users */}
          <NotificationsPanel user={user} userRole={userRole} />

          <span className="user-text">
            {user.email} ({userRole})
          </span>
          <button onClick={onLogout} className="button button-danger">
            <LogOut style={{ width: "16px", height: "16px" }} />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
