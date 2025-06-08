import React from "react";
import { Users, Image } from "lucide-react";
import "../../styles/DashboardView.css";

const DashboardView = ({ schools, selectedSchool, students, photos }) => {
  const selectedSchoolData = schools.find((s) => s.id === selectedSchool);

  return (
    <div className="dashboard-view">
      <div className="card-header">
        <h2 className="card-title">Dashboard</h2>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-stat">
            <Users className="dashboard-stat-icon dashboard-stat-icon-blue" />
            <div>
              <h3 className="dashboard-stat-label">Students</h3>
              <p className="dashboard-stat-number dashboard-stat-number-blue">
                {students.length}
              </p>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-stat">
            <Image className="dashboard-stat-icon dashboard-stat-icon-green" />
            <div>
              <h3 className="dashboard-stat-label">Photos</h3>
              <p className="dashboard-stat-number dashboard-stat-number-green">
                {photos.length}
              </p>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-school-info">
            <h3 className="dashboard-stat-label">School</h3>
            <p className="dashboard-school-name">
              {selectedSchoolData?.name || "Unknown"}
            </p>
            <p className="dashboard-school-org">
              {selectedSchoolData?.organization || ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
