import React from "react";
import { Camera, School } from "lucide-react";
import "../../styles/EmptyState.css";

const EmptyState = ({ userRole }) => {
  if (userRole === "school") {
    return (
      <div className="empty-state">
        <Camera className="empty-state-icon" />
        <h3 className="empty-state-title">Loading Your School Data</h3>
        <p className="empty-state-text">
          Please wait while we load your students and photos...
        </p>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <School className="empty-state-icon" />
      <h3 className="empty-state-title">Select a School to Get Started</h3>
      <p className="empty-state-text">
        Choose a school from the dropdown in the header to view students, upload
        photos, and manage data.
      </p>
    </div>
  );
};

export default EmptyState;
