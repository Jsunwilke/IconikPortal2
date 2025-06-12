import React, { useState, useEffect, useRef, useCallback } from "react";
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
  const [allNotificationsLoaded, setAllNotificationsLoaded] = useState(false); // Add this state
  const panelRef = useRef(null);

  // Only show notifications for studio users - MOVED TO END
  const isStudioUser = userRole === "studio";

  // Debug logging
  useEffect(() => {
    if (!isStudioUser) return;
    console.log("NotificationsPanel mounted with:", {
      userEmail: user?.email,
      userRole,
      userId: user?.uid,
    });
  }, [user?.email, userRole, user?.uid, isStudioUser]); // Add dependencies

  // Subscribe to real-time unread notifications
  useEffect(() => {
    if (!isStudioUser || !user?.uid) {
      console.log(
        "NotificationsPanel: No user ID or not studio user, skipping subscription"
      );
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
        setNotifications((prevNotifications) => {
          // Only update if notifications actually changed
          if (
            JSON.stringify(prevNotifications) !==
            JSON.stringify(newNotifications)
          ) {
            return newNotifications;
          }
          return prevNotifications;
        });
        setUnreadCount(newNotifications.length);
      }
    );

    return () => {
      console.log("NotificationsPanel: Cleaning up notification listener");
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.uid, isStudioUser]);

  const loadAllNotifications = useCallback(async () => {
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
      setAllNotificationsLoaded(true); // Mark as loaded
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
    setLoading(false);
  }, [user?.uid]); // Add dependency for user.uid

  // Load all notifications when panel opens - FIXED
  useEffect(() => {
    if (!isStudioUser || !isOpen || !user?.uid || allNotificationsLoaded) {
      return;
    }
    loadAllNotifications();
  }, [
    isOpen,
    user?.uid,
    allNotificationsLoaded,
    loadAllNotifications,
    isStudioUser,
  ]); // Add loadAllNotifications to dependencies

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
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const renderChanges = (changes) => {
    if (!changes || !Array.isArray(changes)) {
      return <div className="notification-changes">No changes data</div>;
    }

    return (
      <div className="notification-changes notification-changes-compact">
        {changes.slice(0, 3).map((change, index) => (
          <div
            key={index}
            className="notification-change-item notification-change-item-compact"
          >
            <span className="change-field change-field-compact">
              {change.field}:
            </span>
            <span className="change-values change-values-compact">
              "{change.oldValue || "empty"}" → "{change.newValue || "empty"}"
            </span>
          </div>
        ))}
        {changes.length > 3 && (
          <div className="notification-changes-more notification-changes-more-compact">
            +{changes.length - 3} more changes
          </div>
        )}
      </div>
    );
  };

  // Determine which notifications to display
  const displayNotifications = isOpen ? allNotifications : notifications;

  // Early return for non-studio users AFTER all hooks
  if (!isStudioUser) {
    console.log("NotificationsPanel: Not a studio user, hiding panel");
    return null;
  }

  return (
    <div className="notifications-container" ref={panelRef}>
      {/* Notification Bell Button */}
      <button
        className={`notifications-bell ${unreadCount > 0 ? "has-unread" : ""}`}
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
