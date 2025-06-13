import React, { useState, useEffect } from "react";
import {
  Bell,
  Clock,
  User,
  School,
  Trash2,
  CheckCircle,
  Check,
} from "lucide-react";
import {
  getUserNotifications,
  markNotificationAsRead,
  markNotificationAsApplied,
} from "../../services/notificationService";
import "../../styles/NotificationsView.css";

const NotificationsView = ({ user, userRole }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // "all", "unread", "read", "applied", "pending"
  const [schoolFilter, setSchoolFilter] = useState("all"); // "all" or specific school name

  useEffect(() => {
    if (user?.uid) {
      loadNotifications();
    }
  }, [user?.uid]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const allNotifications = await getUserNotifications(user.uid, 100); // Get more for history
      console.log(
        "NotificationsView: Loaded",
        allNotifications.length,
        "notifications"
      );
      setNotifications(allNotifications);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
    setLoading(false);
  };

  const handleMarkAsRead = async (notification) => {
    if (!notification.userRead) {
      try {
        await markNotificationAsRead(notification.userNotificationId);
        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, userRead: true } : n
          )
        );
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }
  };

  const handleMarkAsApplied = async (notification) => {
    try {
      await markNotificationAsApplied(
        notification.userNotificationId,
        !notification.appliedInStudio
      );
      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id
            ? { ...n, appliedInStudio: !notification.appliedInStudio }
            : n
        )
      );
    } catch (error) {
      console.error("Error updating applied status:", error);
      alert("Error updating applied status: " + error.message);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  const renderChanges = (changes) => {
    if (!changes || changes.length === 0) return "No specific changes recorded";

    return (
      <div className="notification-changes-detailed">
        {changes.slice(0, 5).map((change, index) => (
          <div key={index} className="notification-change-detailed">
            <span className="change-field-detailed">{change.field}:</span>
            <span className="change-values">
              <span className="old-value">"{change.oldValue}"</span>
              <span className="change-arrow">→</span>
              <span className="new-value">"{change.newValue}"</span>
            </span>
          </div>
        ))}
        {changes.length > 5 && (
          <div className="notification-changes-more">
            +{changes.length - 5} more changes
          </div>
        )}
      </div>
    );
  };

  const getStudentInfoBeforeChange = (notification) => {
    // Use the stored student data before change if available
    if (notification.studentDataBeforeChange) {
      return {
        firstName: notification.studentDataBeforeChange["First Name"] || "",
        lastName: notification.studentDataBeforeChange["Last Name"] || "",
        grade: notification.studentDataBeforeChange["Grade"] || "",
        teacher: notification.studentDataBeforeChange["Teacher"] || "",
      };
    }

    // Fallback to old method if studentDataBeforeChange not available
    const changes = notification.changes || [];
    const info = {};

    // Start with the student name from notification, but use old values if changed
    info.firstName = notification.studentName?.split(" ")[0] || "";
    info.lastName =
      notification.studentName?.split(" ").slice(1).join(" ") || "";
    info.grade = "";
    info.teacher = "";

    // Override with old values from changes if these fields were changed
    changes.forEach((change) => {
      switch (change.field) {
        case "First Name":
          info.firstName = change.oldValue;
          break;
        case "Last Name":
          info.lastName = change.oldValue;
          break;
        case "Grade":
          info.grade = change.oldValue;
          break;
        case "Teacher":
          info.teacher = change.oldValue;
          break;
      }
    });

    return info;
  };

  // Get unique schools for the filter
  const availableSchools = [
    ...new Set(notifications.map((n) => n.schoolName).filter(Boolean)),
  ].sort();

  const filteredNotifications = notifications.filter((notification) => {
    // Filter by read/applied status
    let passesReadFilter = true;
    switch (filter) {
      case "unread":
        passesReadFilter = !notification.userRead;
        break;
      case "read":
        passesReadFilter = notification.userRead;
        break;
      case "applied":
        passesReadFilter = notification.appliedInStudio;
        break;
      case "pending":
        passesReadFilter = !notification.appliedInStudio;
        break;
      default:
        passesReadFilter = true;
    }

    // Filter by school
    let passesSchoolFilter = true;
    if (schoolFilter !== "all") {
      passesSchoolFilter = notification.schoolName === schoolFilter;
    }

    return passesReadFilter && passesSchoolFilter;
  });

  const unreadCount = notifications.filter((n) => !n.userRead).length;
  const appliedCount = notifications.filter((n) => n.appliedInStudio).length;
  const pendingCount = notifications.filter((n) => !n.appliedInStudio).length;

  if (userRole !== "studio") {
    return (
      <div className="notifications-view">
        <div className="card-header">
          <h2 className="card-title">Access Denied</h2>
        </div>
        <div className="notifications-card">
          <p>Notifications are only available for studio users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-view">
      <div className="card-header">
        <div>
          <h2 className="card-title">Notifications</h2>
          <p className="notifications-summary">
            {notifications.length} total • {unreadCount} unread • {appliedCount}{" "}
            applied • {pendingCount} pending
          </p>
        </div>
        <div className="notifications-filters">
          <button
            className={`filter-button ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({notifications.length})
          </button>
          <button
            className={`filter-button ${filter === "unread" ? "active" : ""}`}
            onClick={() => setFilter("unread")}
          >
            Unread ({unreadCount})
          </button>
          <button
            className={`filter-button ${filter === "read" ? "active" : ""}`}
            onClick={() => setFilter("read")}
          >
            Read ({notifications.length - unreadCount})
          </button>
          <button
            className={`filter-button ${filter === "pending" ? "active" : ""}`}
            onClick={() => setFilter("pending")}
          >
            Pending ({pendingCount})
          </button>
          <button
            className={`filter-button ${filter === "applied" ? "active" : ""}`}
            onClick={() => setFilter("applied")}
          >
            Applied ({appliedCount})
          </button>
        </div>
      </div>

      {/* School Filter */}
      {availableSchools.length > 1 && (
        <div className="notifications-card">
          <div className="school-filter">
            <label className="school-filter-label">Filter by School:</label>
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="school-filter-select"
            >
              <option value="all">All Schools ({notifications.length})</option>
              {availableSchools.map((school) => {
                const schoolCount = notifications.filter(
                  (n) => n.schoolName === school
                ).length;
                return (
                  <option key={school} value={school}>
                    {school} ({schoolCount})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      )}

      <div className="notifications-card">
        {loading ? (
          <div className="notifications-loading">
            <Bell className="loading-icon" />
            <p>Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notifications-empty">
            <Bell className="empty-icon" />
            <h3>No notifications found</h3>
            <p>
              {filter === "all" &&
                schoolFilter === "all" &&
                "No notifications have been created yet."}
              {filter === "unread" && "All notifications have been read."}
              {filter === "read" && "No read notifications found."}
              {filter === "applied" && "No applied notifications found."}
              {filter === "pending" && "No pending notifications found."}
              {schoolFilter !== "all" &&
                `No notifications found for ${schoolFilter}.`}
            </p>
          </div>
        ) : (
          <div className="notifications-list-view">
            {filteredNotifications.map((notification) => {
              const studentInfo = getStudentInfoBeforeChange(notification);

              return (
                <div
                  key={notification.id}
                  className={`notification-item ${
                    !notification.userRead ? "notification-unread" : ""
                  } ${
                    notification.appliedInStudio ? "notification-applied" : ""
                  }`}
                >
                  {/* Student Info */}
                  <div className="student-header">
                    <div className="student-info">
                      <h3 className="student-name">
                        {studentInfo.firstName} {studentInfo.lastName}
                      </h3>
                      <div className="student-details">
                        Grade: {studentInfo.grade || "N/A"} • Teacher:{" "}
                        {studentInfo.teacher || "N/A"} •{" "}
                        {notification.schoolName}
                      </div>
                    </div>

                    <div className="notification-badges">
                      {!notification.userRead && (
                        <span className="unread-badge">NEW</span>
                      )}
                      {notification.appliedInStudio && (
                        <span className="applied-badge">APPLIED</span>
                      )}
                    </div>
                  </div>

                  {/* Changes */}
                  <div className="changes-section">
                    <div className="changes-title">Changes Made:</div>
                    {renderChanges(notification.changes)}
                  </div>

                  {/* Footer */}
                  <div className="notification-footer">
                    <div className="notification-meta">
                      {formatTimestamp(notification.timestamp)} by{" "}
                      {notification.changedBy?.email}
                    </div>

                    <div className="notification-actions">
                      {!notification.userRead && (
                        <button
                          onClick={() => handleMarkAsRead(notification)}
                          className="mark-read-btn"
                          title="Mark as read"
                        >
                          <CheckCircle
                            style={{ width: "14px", height: "14px" }}
                          />
                        </button>
                      )}

                      <label className="applied-checkbox">
                        <input
                          type="checkbox"
                          checked={notification.appliedInStudio || false}
                          onChange={() => handleMarkAsApplied(notification)}
                        />
                        <Check
                          className={`checkbox-icon ${
                            notification.appliedInStudio ? "checked" : ""
                          }`}
                          style={{ width: "16px", height: "16px" }}
                        />
                        Applied in studio
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsView;
