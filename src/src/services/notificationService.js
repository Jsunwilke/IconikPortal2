import { db } from "./firebase";
import { functions } from "./firebase"; // Add this import
import { httpsCallable } from "firebase/functions"; // Add this import
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

// Create a new notification
export const createNotification = async (
  schoolId,
  studentId,
  studentName,
  changes,
  changedBy,
  schoolName,
  studentDataBeforeChange = null // NEW: Full student data before change
) => {
  try {
    // Create the main notification
    const notificationData = {
      type: "student_changed",
      schoolId: schoolId,
      schoolName: schoolName,
      studentId: studentId,
      studentName: studentName,
      changes: changes, // Array of {field, oldValue, newValue}
      changedBy: changedBy, // {email, role}
      studentDataBeforeChange: studentDataBeforeChange, // NEW: Full student record before change
      timestamp: serverTimestamp(),
      read: false,
    };

    // Add to notifications collection
    const notificationRef = await addDoc(
      collection(db, "notifications"),
      notificationData
    );

    // Get all studio users to notify them
    const usersQuery = query(
      collection(db, "users"),
      where("role", "==", "studio")
    );
    const usersSnapshot = await getDocs(usersQuery);

    // Create individual user notifications for each studio user
    const userNotificationPromises = [];
    usersSnapshot.forEach((userDoc) => {
      const userId = userDoc.id;
      const userNotificationData = {
        notificationId: notificationRef.id,
        userId: userId,
        read: false,
        appliedInStudio: false, // NEW: Track applied status
        timestamp: serverTimestamp(),
      };

      userNotificationPromises.push(
        addDoc(collection(db, "userNotifications"), userNotificationData)
      );
    });

    await Promise.all(userNotificationPromises);

    console.log("Notification created successfully:", notificationRef.id);

    // **NEW: Send instant email notification**
    try {
      console.log("Triggering instant email notification...");

      const sendInstantNotificationEmail = httpsCallable(
        functions,
        "sendInstantNotificationEmail"
      );

      // Prepare notification data for email
      const emailNotificationData = {
        ...notificationData,
        // Convert serverTimestamp to regular timestamp for email function
        timestamp: {
          seconds: Math.floor(Date.now() / 1000),
        },
      };

      const emailResult = await sendInstantNotificationEmail(
        emailNotificationData
      );

      console.log("Instant email notification sent:", {
        emailsSent: emailResult.data?.emailsSent || 0,
        emailsFailed: emailResult.data?.emailsFailed || 0,
      });
    } catch (emailError) {
      // Don't fail the notification creation if email fails
      console.error("Failed to send instant email notification:", emailError);
    }

    return notificationRef.id;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

// Listen to notifications for a specific user
export const subscribeToUserNotifications = (userId, callback) => {
  const q = query(
    collection(db, "userNotifications"),
    where("userId", "==", userId),
    where("read", "==", false),
    orderBy("timestamp", "desc")
  );

  return onSnapshot(q, async (snapshot) => {
    const notifications = [];

    for (const userNotifDoc of snapshot.docs) {
      const userNotifData = userNotifDoc.data();

      // Get the actual notification details
      try {
        const notificationDocRef = doc(
          db,
          "notifications",
          userNotifData.notificationId
        );
        const notificationDoc = await getDoc(notificationDocRef);

        if (notificationDoc.exists()) {
          const notificationData = notificationDoc.data();
          notifications.push({
            id: userNotifDoc.id,
            userNotificationId: userNotifDoc.id,
            notificationId: userNotifData.notificationId,
            ...notificationData,
            userRead: userNotifData.read,
            appliedInStudio: userNotifData.appliedInStudio || false, // NEW: Include applied status
          });
        }
      } catch (error) {
        console.error("Error fetching notification details:", error);
      }
    }

    callback(notifications);
  });
};

// Mark notification as read for a user
export const markNotificationAsRead = async (userNotificationId) => {
  try {
    const userNotificationRef = doc(
      db,
      "userNotifications",
      userNotificationId
    );
    await updateDoc(userNotificationRef, {
      read: true,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

// NEW: Mark notification as applied in studio software
export const markNotificationAsApplied = async (
  userNotificationId,
  appliedStatus
) => {
  try {
    const userNotificationRef = doc(
      db,
      "userNotifications",
      userNotificationId
    );
    await updateDoc(userNotificationRef, {
      appliedInStudio: appliedStatus,
    });
    console.log(
      `Notification ${userNotificationId} marked as ${
        appliedStatus ? "applied" : "not applied"
      } in studio`
    );
  } catch (error) {
    console.error("Error marking notification as applied:", error);
    throw error;
  }
};

// Get all notifications for a user (including read ones)
export const getUserNotifications = async (userId, limit = 50) => {
  try {
    const q = query(
      collection(db, "userNotifications"),
      where("userId", "==", userId),
      orderBy("timestamp", "desc")
    );

    const snapshot = await getDocs(q);
    const notifications = [];

    for (const userNotifDoc of snapshot.docs) {
      const userNotifData = userNotifDoc.data();

      // Get the actual notification details
      try {
        const notificationDocRef = doc(
          db,
          "notifications",
          userNotifData.notificationId
        );
        const notificationDoc = await getDoc(notificationDocRef);

        if (notificationDoc.exists()) {
          const notificationData = notificationDoc.data();
          notifications.push({
            id: userNotifDoc.id,
            userNotificationId: userNotifDoc.id,
            notificationId: userNotifData.notificationId,
            ...notificationData,
            userRead: userNotifData.read,
            appliedInStudio: userNotifData.appliedInStudio || false, // NEW: Include applied status
          });
        }
      } catch (error) {
        console.error("Error fetching notification details:", error);
      }
    }

    return notifications;
  } catch (error) {
    console.error("Error getting user notifications:", error);
    return [];
  }
};

// Helper function to compare objects and find changes
export const findChanges = (
  oldData,
  newData,
  excludeFields = ["id", "createdAt", "updatedAt"]
) => {
  const changes = [];

  // Get all unique keys from both objects
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  allKeys.forEach((key) => {
    if (excludeFields.includes(key)) return;

    const oldValue = oldData[key] || "";
    const newValue = newData[key] || "";

    // Convert to strings for comparison
    const oldStr = String(oldValue).trim();
    const newStr = String(newValue).trim();

    if (oldStr !== newStr) {
      changes.push({
        field: key,
        oldValue: oldValue,
        newValue: newValue,
      });
    }
  });

  return changes;
};

// Send email notification (you'll need to implement this with your preferred email service)
export const sendEmailNotification = async (
  recipientEmail,
  schoolName,
  studentName,
  changes,
  changedBy
) => {
  try {
    // This is a placeholder for email service integration
    // You could use Firebase Functions with SendGrid, Mailgun, etc.

    const emailData = {
      to: recipientEmail,
      subject: `Student Data Change Alert - ${schoolName}`,
      html: generateEmailHTML(schoolName, studentName, changes, changedBy),
    };

    // TODO: Implement actual email sending
    console.log("Email notification would be sent:", emailData);

    // For now, we'll just log it
    // In production, you'd call your email service here
  } catch (error) {
    console.error("Error sending email notification:", error);
  }
};

// Generate HTML for email notification
const generateEmailHTML = (schoolName, studentName, changes, changedBy) => {
  const changesHTML = changes
    .map(
      (change) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${change.field}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${
        change.oldValue || "<em>empty</em>"
      }</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${
        change.newValue || "<em>empty</em>"
      }</td>
    </tr>
  `
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3b82f6;">Student Data Change Alert</h2>
      
      <p><strong>School:</strong> ${schoolName}</p>
      <p><strong>Student:</strong> ${studentName}</p>
      <p><strong>Changed by:</strong> ${changedBy.email} (${changedBy.role})</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      
      <h3>Changes Made:</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f8fafc;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Field</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Old Value</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">New Value</th>
          </tr>
        </thead>
        <tbody>
          ${changesHTML}
        </tbody>
      </table>
      
      <p style="color: #6b7280; font-size: 0.875rem; margin-top: 30px;">
        This is an automated notification from the School Photo Management System.
      </p>
    </div>
  `;
};
