import React, { useState, useEffect, useRef } from "react";
import { Bell, X, Clock, User, School } from "lucide-react";
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  getUserNotifications,
} from "../../services/notificationService";
import "../../styles/NotificationsPanel.css";

const NotificationsPanel = ({ user, userRole }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [allNotifications, setAllNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  // Debug logging
  useEffect(() => {
    console.log("NotificationsPanel mounted with:", {
      userEmail: user?.email,
      userRole,
      userId: user?.uid,
    });
  }, []);

  // Only show notifications for studio users
  if (userRole !== "studio") {
    console.log("NotificationsPanel: Not a studio user, hiding panel");
    return null;
  }

  // Subscribe to real-time unread notifications
  useEffect(() => {
    if (!user?.uid) {
      console.log("NotificationsPanel: No user ID, skipping subscription");
      return;
    }

    console.log(
      "NotificationsPanel: Setting up real-time listener for user:",
      user.uid
    );

    const unsubscribe = subscribeToUserNotifications(
      user.uid,
      (newNotifications) => {
        console.log("NotificationsPanel: Received notifications update:", {
          count: newNotifications.length,
          notifications: newNotifications,
        });
        setNotifications(newNotifications);
        setUnreadCount(newNotifications.length);
      }
    );

    return () => {
      console.log("NotificationsPanel: Cleaning up notification listener");
      unsubscribe();
    };
  }, [user?.uid]);

  // Load all notifications when panel opens
  useEffect(() => {
    if (isOpen && user?.uid && allNotifications.length === 0) {
      loadAllNotifications();
    }
  }, [isOpen, user?.uid]);

  // Click away to close panel
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadAllNotifications = async () => {
    setLoading(true);
    try {
      console.log(
        "NotificationsPanel: Loading all notifications for user:",
        user.uid
      );
      const allNotifs = await getUserNotifications(user.uid);
      console.log(
        "NotificationsPanel: Loaded notifications:",
        allNotifs.length
      );
      setAllNotifications(allNotifs);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
    setLoading(false);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.userRead) {
      try {
        await markNotificationAsRead(notification.userNotificationId);
        // Remove from unread list (dropdown)
        setNotifications((prev) =>
          prev.filter((n) => n.id !== notification.id)
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        // Update in all notifications list to show as read
        setAllNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, userRead: true } : n
          )
        );
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }
  };

  const markAllAsRead = async () => {
    try {
      // Mark all unread notifications as read
      const markPromises = notifications.map((notification) =>
        markNotificationAsRead(notification.userNotificationId)
      );
      await Promise.all(markPromises);

      // Clear the dropdown completely
      setNotifications([]);
      setUnreadCount(0);

      // Update all notifications list to show them as read
      setAllNotifications((prev) =>
        prev.map((n) => ({ ...n, userRead: true }))
      );

      console.log("All notifications cleared from dropdown");
    } catch (error) {
      console.error("Error clearing all notifications:", error);
    }
  };

  const togglePanel = () => {
    console.log("NotificationsPanel: Toggling panel, current state:", isOpen);
    setIsOpen(!isOpen);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const renderChanges = (changes) => {
    if (!changes || changes.length === 0) return "No specific changes recorded";

    if (changes.length === 1) {
      const change = changes[0];
      return (
        <div className="notification-change">
          <strong>{change.field}:</strong> "{change.oldValue}" → "
          {change.newValue}"
        </div>
      );
    }

    return (
      <div className="notification-changes">
        <div className="notification-changes-summary">
          {changes.length} fields updated:
        </div>
        <div className="notification-changes-list">
          {changes.slice(0, 2).map((change, index) => (
            <div key={index} className="notification-change-item">
              <span className="change-field">{change.field}</span>
            </div>
          ))}
          {changes.length > 2 && (
            <div className="notification-changes-more">
              +{changes.length - 2} more
            </div>
          )}
        </div>
      </div>
    );
  };

  const displayNotifications = isOpen ? notifications : notifications; // Always show only unread in dropdown

  console.log("NotificationsPanel: Rendering with:", {
    unreadCount,
    isOpen,
    displayNotificationsCount: displayNotifications.length,
    userRole,
  });

  return (
    <div className="notifications-container" ref={panelRef}>
      {/* Notification Bell Button */}
      <button
        className="notifications-button"
        onClick={togglePanel}
        title={`${unreadCount} unread notifications`}
      >
        <Bell style={{ width: "20px", height: "20px" }} />
        {unreadCount > 0 && (
          <span className="notifications-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {isOpen && (
        <div className="notifications-panel">
          <div className="notifications-header">
            <h3 className="notifications-title">
              Notifications
              {unreadCount > 0 && (
                <span className="notifications-header-count">
                  ({unreadCount} unread)
                </span>
              )}
            </h3>
            <div className="notifications-header-actions">
              {unreadCount > 0 && (
                <button
                  className="notifications-clear-all"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  Clear All
                </button>
              )}
              <button
                className="notifications-close"
                onClick={() => setIsOpen(false)}
              >
                <X style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
          </div>

          <div className="notifications-content">
            {loading ? (
              <div className="notifications-loading">
                Loading notifications...
              </div>
            ) : displayNotifications.length === 0 ? (
              <div className="notifications-empty">
                <Bell className="notifications-empty-icon" />
                <p>All caught up!</p>
                <small>No unread notifications</small>
              </div>
            ) : (
              <div className="notifications-list">
                {displayNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item notification-item-compact ${
                      !notification.userRead ? "notification-unread" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="notification-header notification-header-compact">
                      <div className="notification-icon notification-icon-compact">
                        <User style={{ width: "14px", height: "14px" }} />
                      </div>
                      <div className="notification-meta">
                        <div className="notification-title notification-title-compact">
                          Student Data Changed
                        </div>
                        <div className="notification-time notification-time-compact">
                          <Clock style={{ width: "10px", height: "10px" }} />
                          {formatTimestamp(notification.timestamp)}
                        </div>
                      </div>
                      {!notification.userRead && (
                        <div className="notification-unread-dot notification-unread-dot-compact"></div>
                      )}
                    </div>

                    <div className="notification-body notification-body-compact">
                      <div className="notification-student notification-student-compact">
                        <strong>{notification.studentName}</strong>
                      </div>
                      <div className="notification-school notification-school-compact">
                        <School style={{ width: "12px", height: "12px" }} />
                        {notification.schoolName}
                      </div>
                      <div className="notification-changed-by notification-changed-by-compact">
                        Changed by: {notification.changedBy?.email}
                      </div>

                      <div className="notification-changes-container notification-changes-container-compact">
                        {renderChanges(notification.changes)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {displayNotifications.length > 0 && (
            <div className="notifications-footer">
              <span className="notifications-footer-text">
                Showing {displayNotifications.length} notifications
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsPanel;
