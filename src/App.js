import React, { useState, useEffect, useRef } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { auth, db, storage, functions } from "./services/firebase";

// Import components
import LoginForm from "./components/auth/LoginForm";
import Header from "./components/common/Header";
import Sidebar from "./components/common/Sidebar";
import ProgressIndicator from "./components/common/ProgressIndicator";
import EmptyState from "./components/common/EmptyState";
import PSPAInstructionModal from "./components/modals/PSPAInstructionModal";
import ExportResultModal from "./components/modals/ExportResultModal";
import IDValidationModal from "./components/modals/IDValidationModal";
import FourUpSortModal from "./components/modals/FourUpSortModal";
import DashboardView from "./components/views/DashboardView";
import UploadView from "./components/views/UploadView";
import StudentsView from "./components/views/StudentsView";
import SchoolsView from "./components/views/SchoolsView";
import NotificationsView from "./components/views/NotificationsView";
import FilesView from "./components/views/FilesView";

// Import services
import {
  loadSchools,
  loadStudents,
  subscribeToStudents,
  loadPhotos,
  handleCSVUpload,
  handlePhotoUpload,
  updateStudent,
  deleteStudent,
  createSchool,
} from "./services/studentService";
import { exportToCSV } from "./services/csvExportService";
import { exportToPSPA } from "./services/pspaExportService";
import { exportToTeacherEase } from "./services/teacherEaseExportService";
import { exportToSkyward } from "./services/skywardExportService";
import { exportToFourUp } from "./services/fourUpExportService";

// Import styles
import "./styles/globals.css";
import "./styles/App.css";

const App = () => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("dashboard");
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [students, setStudents] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]); // Track filtered students
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadStats, setUploadStats] = useState(null);
  const [exportResult, setExportResult] = useState(null);
  const [idValidationModal, setIdValidationModal] = useState(null);
  const [pspaInstructionModal, setPspaInstructionModal] = useState(false);
  const [fourUpSortModal, setFourUpSortModal] = useState(false);

  // Use useRef for cancellation flag
  const exportCancelledRef = useRef(false);

  const cancelExport = () => {
    exportCancelledRef.current = true;
    setUploadProgress("Cancelling export... Please wait");
    setUploadStats((prev) =>
      prev ? { ...prev, operation: "Cancelling Export" } : null
    );
  };

  const showExportResult = (result) => {
    setExportResult(result);
  };

  const closeExportResult = () => {
    setExportResult(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserRole(userData.role);
            if (userData.role === "school") {
              setSelectedSchool(userData.schoolId);
            }
          } else {
            console.error("User document not found in Firestore");
            alert("User profile not found. Please contact administrator.");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          alert("Error loading user profile: " + error.message);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && userRole) {
      loadSchoolsData();
    }
  }, [user, userRole]);

  useEffect(() => {
    if (selectedSchool) {
      // Set up real-time listener for students
      const unsubscribeStudents = subscribeToStudents(
        selectedSchool,
        (newStudents) => {
          console.log(
            "Students updated via real-time listener:",
            newStudents.length
          );
          setStudents(newStudents);
        }
      );

      loadPhotosData();

      // Cleanup function
      return () => {
        console.log("Cleaning up students listener");
        unsubscribeStudents();
      };
    } else {
      setStudents([]);
      setPhotos([]);
    }
  }, [selectedSchool]);

  const loadSchoolsData = async () => {
    try {
      const schoolsList = await loadSchools();
      setSchools(schoolsList);
    } catch (error) {
      alert(error.message);
    }
  };

  const loadStudentsData = async () => {
    try {
      const studentsList = await loadStudents(selectedSchool);
      setStudents(studentsList);
    } catch (error) {
      alert(error.message);
    }
  };

  const loadPhotosData = async () => {
    try {
      const photosList = await loadPhotos(selectedSchool);
      setPhotos(photosList);
    } catch (error) {
      console.error("Error loading photos:", error);
    }
  };

  const handleLogin = async (email, password) => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Login error:", error);
      let errorMessage = "Login failed: ";
      switch (error.code) {
        case "auth/invalid-email":
          errorMessage += "Invalid email address.";
          break;
        case "auth/user-disabled":
          errorMessage += "This account has been disabled.";
          break;
        case "auth/user-not-found":
          errorMessage += "No account found with this email.";
          break;
        case "auth/wrong-password":
          errorMessage += "Incorrect password.";
          break;
        case "auth/invalid-credential":
          errorMessage += "Invalid login credentials.";
          break;
        default:
          errorMessage += error.message;
      }
      alert(errorMessage);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveView("dashboard");
      setSelectedSchool(null);
      setStudents([]);
      setPhotos([]);
    } catch (error) {
      console.error("Logout error:", error);
      alert("Error logging out: " + error.message);
    }
  };

  const handleCSVUploadWrapper = async (file) => {
    try {
      const result = await handleCSVUpload(
        file,
        selectedSchool,
        setUploadProgress
      );
      setUploadProgress(null);
      showExportResult({
        type: "csv_upload",
        success: true,
        title: "CSV Upload Complete",
        message:
          "Your student data has been successfully imported and is now available in the system.",
        stats: {
          totalCount: result.count,
          successCount: result.count,
          failedCount: 0,
        },
        details: [
          `Imported ${result.count} student records`,
          `Headers detected: ${result.headers.join(", ")}`,
          "All data has been stored in Firebase Firestore",
        ],
      });
      loadStudentsData();
    } catch (error) {
      setUploadProgress(null);
      showExportResult({
        type: "csv_upload",
        success: false,
        title: "CSV Upload Failed",
        message:
          "There was an error importing your student data. Please check your file format and try again.",
        details: [
          `Error: ${error.message}`,
          "Make sure your CSV file has proper headers",
          "Ensure the file is not corrupted or empty",
        ],
      });
    }
  };

  const handlePhotoUploadWrapper = async (files) => {
    try {
      const result = await handlePhotoUpload(
        files,
        selectedSchool,
        setUploadProgress,
        setUploadStats
      );
      setUploadProgress(null);
      setUploadStats(null);
      await loadPhotosData();

      showExportResult({
        type: "photo_upload",
        success: result.success,
        title: result.success
          ? "Photo Upload Complete"
          : "Photo Upload Completed with Issues",
        message: result.success
          ? "All photos have been successfully uploaded and are now available in the system."
          : `Most photos were uploaded successfully, but ${result.failedCount} files encountered issues.`,
        stats: result,
        details: [
          `Successfully uploaded: ${result.successCount} photos`,
          ...(result.failedCount > 0
            ? [`Failed uploads: ${result.failedCount} photos`]
            : []),
          "Photos are stored in Firebase Storage",
          "You can now view and export student photos",
        ],
      });
    } catch (error) {
      setUploadProgress(null);
      setUploadStats(null);
      showExportResult({
        type: "photo_upload",
        success: false,
        title: "Photo Upload Failed",
        message: "A critical error occurred during the photo upload process.",
        details: [
          `Error: ${error.message}`,
          "Please try uploading fewer files at once",
          "Ensure all files are valid image formats",
        ],
      });
    }
  };

  const handleExportCSV = () => {
    const result = exportToCSV(students, selectedSchool, schools);
    showExportResult({
      type: "csv_export",
      ...result,
    });
  };

  const handleExportPSPA = async () => {
    // Show instruction modal first
    setPspaInstructionModal(true);
  };

  const handlePSPAInstructionContinue = async () => {
    setPspaInstructionModal(false);
    // Now proceed with the actual PSPA export
    const result = await exportToPSPA(
      students,
      photos,
      selectedSchool,
      schools,
      exportCancelledRef,
      setUploadProgress,
      setUploadStats
    );
    if (result) {
      showExportResult(result);
    }
  };

  const handleExportTeacherEase = async () => {
    const result = await exportToTeacherEase(
      students,
      photos,
      selectedSchool,
      schools,
      exportCancelledRef,
      setUploadProgress,
      setUploadStats,
      setIdValidationModal
    );
    if (result) {
      showExportResult(result);
    }
  };

  const handleExportSkyward = async () => {
    const result = await exportToSkyward(
      students,
      photos,
      selectedSchool,
      schools,
      exportCancelledRef,
      setUploadProgress,
      setUploadStats,
      setIdValidationModal
    );
    if (result) {
      showExportResult(result);
    }
  };

  const handleExportFourUp = async () => {
    // Show sort selection modal first
    setFourUpSortModal(true);
  };

  const handleFourUpSortContinue = async (sortOptions, useFilteredData) => {
    setFourUpSortModal(false);

    // Choose which students to export based on user selection
    let studentsToExport;
    if (useFilteredData && filteredStudents.length > 0) {
      studentsToExport = filteredStudents;
    } else {
      studentsToExport = students; // Use all students
    }

    // Proceed with the 4-Up export
    const result = await exportToFourUp(
      studentsToExport,
      photos,
      selectedSchool,
      schools,
      exportCancelledRef,
      setUploadProgress,
      setUploadStats,
      sortOptions
    );
    // Only show result modal if there's actually a result
    // (legacy mode returns null when using browser save dialog)
    if (result) {
      showExportResult(result);
    }
  };

  const handleUpdateStudent = async (studentId, updatedData) => {
    try {
      // Pass current user context to updateStudent for notifications
      const currentUser = {
        email: user.email,
        role: userRole,
        uid: user.uid,
      };

      await updateStudent(selectedSchool, studentId, updatedData, currentUser);
      // No need to manually reload - real-time listener will update automatically
      alert("Student updated successfully!");
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteStudent = async (studentId, studentData) => {
    try {
      await deleteStudent(selectedSchool, studentId, studentData);
      // No need to manually reload - real-time listener will update automatically
      alert("Student deleted successfully.");
    } catch (error) {
      throw error;
    }
  };

  const handlePhotoReplace = async (student, newPhotoFile) => {
    try {
      setUploadProgress("Replacing photo...");
      setUploadStats({
        current: 1,
        total: 1,
        percentage: 50,
        fileName: newPhotoFile.name,
        operation: "Replacing Photo",
      });

      console.log("Original filename:", newPhotoFile.name);

      // Find the student's current photo
      const currentPhoto = photos.find((photo) => {
        const firstName = student["First Name"]?.toLowerCase() || "";
        const lastName = student["Last Name"]?.toLowerCase() || "";
        const photoName = photo.name.toLowerCase();

        if (student["Images"] && photo.name === student["Images"]) {
          return true;
        }

        const expectedName = `${firstName}_${lastName}`;
        if (photoName.includes(expectedName)) {
          return true;
        }

        return photoName.includes(firstName) && photoName.includes(lastName);
      });

      // If there's a current photo, move it to version history instead of deleting
      if (currentPhoto && currentPhoto.name !== newPhotoFile.name) {
        try {
          setUploadProgress("Archiving previous photo version...");
          console.log(
            "Moving current photo to version history:",
            currentPhoto.name
          );

          // Create version history folder path
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const versionPath = `schools/${selectedSchool}/photos/versions/${student.id}/${timestamp}_${currentPhoto.name}`;

          // Get the current photo data
          const currentPhotoRef = ref(
            storage,
            `schools/${selectedSchool}/photos/${currentPhoto.name}`
          );
          const currentPhotoBlob = await fetch(currentPhoto.url).then((r) =>
            r.blob()
          );

          // Upload to version history
          const versionRef = ref(storage, versionPath);
          await uploadBytes(versionRef, currentPhotoBlob);

          console.log("Previous version archived to:", versionPath);

          // Now delete the current photo from main folder
          const { deleteObject } = await import("firebase/storage");
          await deleteObject(currentPhotoRef);
          console.log("Current photo moved to version history");
        } catch (archiveError) {
          console.log("Could not archive current photo:", archiveError.message);
          // Continue anyway - not critical if archiving fails
        }
      }

      // Upload the new photo with original filename
      setUploadProgress("Uploading new photo...");
      const originalFileName = newPhotoFile.name;
      const storagePath = `schools/${selectedSchool}/photos/${originalFileName}`;
      const photoRef = ref(storage, storagePath);

      console.log("Storage path:", storagePath);
      console.log("Uploading file:", originalFileName);

      await uploadBytes(photoRef, newPhotoFile);
      const downloadURL = await getDownloadURL(photoRef);

      console.log("Photo uploaded successfully:", downloadURL);

      // Update the student record to reference the new photo
      setUploadProgress("Updating student record...");
      await updateStudent(selectedSchool, student.id, {
        Images: originalFileName,
      });

      setUploadProgress(null);
      setUploadStats(null);

      // Refresh both students and photos to show the changes
      await Promise.all([loadStudentsData(), loadPhotosData()]);

      showExportResult({
        type: "photo_replace",
        success: true,
        title: "Photo Replaced Successfully",
        message: `Photo has been replaced with ${originalFileName}.`,
        details: [
          `New photo: ${originalFileName}`,
          currentPhoto
            ? `Previous version archived: ${currentPhoto.name}`
            : "Added new photo",
          "Student record updated",
          "Previous versions can be restored if needed",
          "Changes are immediately visible",
        ],
      });
    } catch (error) {
      console.error("Photo replacement error:", error);
      setUploadProgress(null);
      setUploadStats(null);
      showExportResult({
        type: "photo_replace",
        success: false,
        title: "Photo Replace Failed",
        message: "There was an error replacing the photo.",
        details: [
          `Error: ${error.message}`,
          "Please try again with a different image",
          "Ensure the file is a valid image format",
        ],
      });
    }
  };

  const loadPhotoVersions = async (studentId) => {
    try {
      const { listAll } = await import("firebase/storage");
      const versionsRef = ref(
        storage,
        `schools/${selectedSchool}/photos/versions/${studentId}`
      );
      const versionsList = await listAll(versionsRef);

      const versions = await Promise.all(
        versionsList.items.map(async (item) => {
          const url = await getDownloadURL(item);
          const fileName = item.name;

          // Extract timestamp and original filename
          const parts = fileName.split("_");
          if (parts.length < 2) {
            // Fallback if filename format is unexpected
            return {
              name: fileName,
              originalName: fileName,
              url: url,
              uploadDate: new Date(), // Use current date as fallback
              fullPath: item.fullPath,
            };
          }

          const timestamp = parts[0];
          const originalName = parts.slice(1).join("_");

          // Convert timestamp back to proper ISO format for parsing
          // timestamp format: 2025-01-15T10-30-00-000Z
          // convert to: 2025-01-15T10:30:00.000Z
          let isoTimestamp = timestamp;
          try {
            // Replace the hyphens in time portion with colons and dots
            isoTimestamp = timestamp.replace(
              /T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/,
              "T$1:$2:$3.$4Z"
            );

            const uploadDate = new Date(isoTimestamp);

            // Check if date is valid
            if (isNaN(uploadDate.getTime())) {
              throw new Error("Invalid date");
            }

            return {
              name: fileName,
              originalName: originalName,
              url: url,
              uploadDate: uploadDate,
              fullPath: item.fullPath,
            };
          } catch (dateError) {
            console.log(
              "Date parsing failed for:",
              timestamp,
              "using fallback"
            );
            // Fallback to current date if parsing fails
            return {
              name: fileName,
              originalName: originalName,
              url: url,
              uploadDate: new Date(), // Use current date as fallback
              fullPath: item.fullPath,
            };
          }
        })
      );

      // Sort by upload date (newest first)
      return versions.sort((a, b) => b.uploadDate - a.uploadDate);
    } catch (error) {
      console.error("Error loading photo versions:", error);
      return [];
    }
  };

  const deletePhotoVersion = async (version) => {
    try {
      const { deleteObject } = await import("firebase/storage");
      const versionRef = ref(storage, version.fullPath);
      await deleteObject(versionRef);
      console.log("Deleted version:", version.fullPath);
    } catch (error) {
      console.error("Error deleting photo version:", error);
      throw new Error("Failed to delete photo version: " + error.message);
    }
  };

  const restorePhotoVersion = async (student, version) => {
    try {
      setUploadProgress("Restoring photo version...");

      // First archive the current photo (same as replace logic)
      const currentPhoto = photos.find((photo) => {
        const firstName = student["First Name"]?.toLowerCase() || "";
        const lastName = student["Last Name"]?.toLowerCase() || "";
        const photoName = photo.name.toLowerCase();

        if (student["Images"] && photo.name === student["Images"]) {
          return true;
        }

        const expectedName = `${firstName}_${lastName}`;
        if (photoName.includes(expectedName)) {
          return true;
        }

        return photoName.includes(firstName) && photoName.includes(lastName);
      });

      if (currentPhoto) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const versionPath = `schools/${selectedSchool}/photos/versions/${student.id}/${timestamp}_${currentPhoto.name}`;

        const currentPhotoRef = ref(
          storage,
          `schools/${selectedSchool}/photos/${currentPhoto.name}`
        );
        const currentPhotoBlob = await fetch(currentPhoto.url).then((r) =>
          r.blob()
        );

        const versionRef = ref(storage, versionPath);
        await uploadBytes(versionRef, currentPhotoBlob);

        const { deleteObject } = await import("firebase/storage");
        await deleteObject(currentPhotoRef);
      }

      // Download the version we want to restore
      const versionBlob = await fetch(version.url).then((r) => r.blob());

      // Upload it as the current photo
      const storagePath = `schools/${selectedSchool}/photos/${version.originalName}`;
      const photoRef = ref(storage, storagePath);
      await uploadBytes(photoRef, versionBlob);

      // Update student record
      await updateStudent(selectedSchool, student.id, {
        Images: version.originalName,
      });

      setUploadProgress(null);
      await Promise.all([loadStudentsData(), loadPhotosData()]);

      showExportResult({
        type: "photo_restore",
        success: true,
        title: "Photo Version Restored",
        message: `Successfully restored photo version: ${version.originalName}`,
        details: [
          `Restored: ${version.originalName}`,
          `From: ${version.uploadDate.toLocaleString()}`,
          "Current photo archived to version history",
          "Changes are immediately visible",
        ],
      });
    } catch (error) {
      setUploadProgress(null);
      showExportResult({
        type: "photo_restore",
        success: false,
        title: "Photo Restore Failed",
        message: "There was an error restoring the photo version.",
        details: [`Error: ${error.message}`],
      });
    }
  };

  const handleCreateSchool = async (schoolData) => {
    try {
      await createSchool(schoolData);
      loadSchoolsData();
      return true;
    } catch (error) {
      throw error;
    }
  };

  const handleSchoolChange = (schoolId) => {
    setSelectedSchool(schoolId);
    setActiveView("dashboard");
  };

  const renderContent = () => {
    const shouldShowContent =
      userRole === "school" ? selectedSchool : selectedSchool;

    if (
      !shouldShowContent &&
      activeView !== "notifications" &&
      activeView !== "files"
    ) {
      return <EmptyState userRole={userRole} />;
    }

    switch (activeView) {
      case "dashboard":
        return (
          <DashboardView
            schools={schools}
            selectedSchool={selectedSchool}
            students={students}
            photos={photos}
          />
        );
      case "students":
        return (
          <StudentsView
            students={students}
            photos={photos}
            selectedSchool={selectedSchool}
            onExport={handleExportCSV}
            onExportPSPA={handleExportPSPA}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
            userRole={userRole}
            onPhotoReplace={handlePhotoReplace}
            onLoadPhotoVersions={loadPhotoVersions}
            onRestorePhotoVersion={restorePhotoVersion}
            onDeletePhotoVersion={deletePhotoVersion}
            onFilteredStudentsChange={setFilteredStudents}
          />
        );
      case "upload":
        return (
          <UploadView
            onCSVUpload={handleCSVUploadWrapper}
            onPhotoUpload={handlePhotoUploadWrapper}
            selectedSchool={selectedSchool}
          />
        );
      case "schools":
        return (
          <SchoolsView schools={schools} onCreateSchool={handleCreateSchool} />
        );
      case "notifications":
        return <NotificationsView user={user} userRole={userRole} />;
      case "files":
        return (
          <FilesView
            selectedSchool={selectedSchool}
            userRole={userRole}
            user={user}
            schools={schools}
          />
        );
      default:
        return <EmptyState userRole={userRole} />;
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <div
          style={{ textAlign: "center", fontSize: "1.25rem", color: "#64748b" }}
        >
          <div>Loading Photography Portal...</div>
          {uploadProgress && (
            <div
              style={{
                color: "#3b82f6",
                marginTop: "0.5rem",
                fontSize: "0.875rem",
              }}
            >
              {uploadProgress}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <ProgressIndicator
        uploadProgress={uploadProgress}
        uploadStats={uploadStats}
        onCancel={uploadProgress ? cancelExport : null}
      />

      <PSPAInstructionModal
        isOpen={pspaInstructionModal}
        onClose={() => setPspaInstructionModal(false)}
        onContinue={handlePSPAInstructionContinue}
      />

      <ExportResultModal
        isOpen={!!exportResult}
        onClose={closeExportResult}
        result={exportResult}
      />

      <IDValidationModal
        isOpen={idValidationModal?.isOpen}
        onClose={() => setIdValidationModal(null)}
        onContinue={idValidationModal?.onContinue}
        validationResult={idValidationModal?.validationResult}
        exportType={idValidationModal?.exportType}
      />

      <FourUpSortModal
        isOpen={fourUpSortModal}
        onClose={() => setFourUpSortModal(false)}
        onContinue={handleFourUpSortContinue}
        students={students}
        filteredStudents={filteredStudents}
      />

      <Header
        user={user}
        userRole={userRole}
        schools={schools}
        selectedSchool={selectedSchool}
        onSchoolChange={handleSchoolChange}
        onLogout={handleLogout}
      />

      <div className="main-layout">
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          userRole={userRole}
          selectedSchool={selectedSchool}
          onExportCSV={handleExportCSV}
          onExportPSPA={handleExportPSPA}
          onExportTeacherEase={handleExportTeacherEase}
          onExportSkyward={handleExportSkyward}
          onExportFourUp={handleExportFourUp}
        />

        <main className="content">{renderContent()}</main>
      </div>
    </div>
  );
};

export default App;
