import React, { useState, useEffect, useRef } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getDoc,
  doc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  getMetadata,
} from "firebase/storage";
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
import YearbookProofingView from "./components/views/YearbookProofingView";

// Import services
import {
  loadSchools,
  loadStudents,
  subscribeToStudents,
  loadPhotos,
  handleCSVUpload,
  handlePhotoUpload,
  handleRetakesCSVUpload,
  handleRetakesPhotoUpload,
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
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadStats, setUploadStats] = useState(null);
  const [hasYearbookProofs, setHasYearbookProofs] = useState(false);

  // Modal states
  const [pspaInstructionModal, setPspaInstructionModal] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [idValidationModal, setIdValidationModal] = useState(null);
  const [fourUpSortModal, setFourUpSortModal] = useState(false);

  // Refs for cancellation
  const exportCancelledRef = useRef(false);
  const unsubscribeStudentsRef = useRef(null);

  // Authentication
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
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUser(null);
        setUserRole(null);
        setSelectedSchool(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Load schools data
  const loadSchoolsData = async () => {
    try {
      const schoolsData = await loadSchools();
      setSchools(schoolsData);
    } catch (error) {
      console.error("Error loading schools:", error);
    }
  };

  useEffect(() => {
    if (userRole === "studio" || userRole === "school") {
      loadSchoolsData();
    }
  }, [userRole]);

  // Check for yearbook proofs when school is selected
  const checkForYearbookProofs = async (schoolId) => {
    try {
      console.log("Checking for yearbook proofs for school:", schoolId);

      const storageRef = ref(
        storage,
        `schools/${schoolId}/yearbooks/versions/`
      );
      const listResult = await listAll(storageRef);

      const hasProofs = listResult.items.length > 0;
      console.log(`School ${schoolId} has yearbook proofs:`, hasProofs);

      setHasYearbookProofs(hasProofs);
    } catch (error) {
      console.error("Error checking for yearbook proofs:", error);
      setHasYearbookProofs(false);
    }
  };

  // Check for yearbook proofs when school changes
  useEffect(() => {
    if (selectedSchool) {
      checkForYearbookProofs(selectedSchool);
    } else {
      setHasYearbookProofs(false);
    }
  }, [selectedSchool]);

  // Load students and photos when school is selected
  useEffect(() => {
    if (selectedSchool) {
      // Clean up previous subscription
      if (unsubscribeStudentsRef.current) {
        unsubscribeStudentsRef.current();
        unsubscribeStudentsRef.current = null;
      }

      // Subscribe to students for real-time updates
      unsubscribeStudentsRef.current = subscribeToStudents(
        selectedSchool,
        setStudents
      );

      // Load photos
      loadPhotos(selectedSchool).then(setPhotos).catch(console.error);
    } else {
      setStudents([]);
      setPhotos([]);
    }

    return () => {
      if (unsubscribeStudentsRef.current) {
        unsubscribeStudentsRef.current();
        unsubscribeStudentsRef.current = null;
      }
    };
  }, [selectedSchool]);

  // Login handler
  const handleLogin = async ({ email, password }) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      throw error;
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // CSV Upload handler
  const handleCSVUploadWrapper = async (file) => {
    try {
      exportCancelledRef.current = false;
      const result = await handleCSVUpload(
        file,
        selectedSchool,
        setUploadProgress,
        setUploadStats,
        exportCancelledRef
      );

      if (result.success) {
        alert(
          `CSV uploaded successfully!\n\n${result.count} students imported.`
        );
      }

      return result;
    } catch (error) {
      alert(`Error uploading CSV: ${error.message}`);
      throw error;
    }
  };

  // Photo Upload handler
  const handlePhotoUploadWrapper = async (files) => {
    try {
      exportCancelledRef.current = false;
      const result = await handlePhotoUpload(
        files,
        selectedSchool,
        setUploadProgress,
        setUploadStats,
        exportCancelledRef
      );

      if (result.success) {
        alert(
          `Photos uploaded successfully!\n\nTotal: ${result.totalCount}\nSuccess: ${result.successCount}\nFailed: ${result.failedCount}`
        );

        // Reload photos
        const updatedPhotos = await loadPhotos(selectedSchool);
        setPhotos(updatedPhotos);
      } else if (result.failedCount > 0) {
        const failedList = result.failedFiles
          .map((f) => `${f.name}: ${f.error}`)
          .join("\n");
        alert(
          `Photo upload completed with errors:\n\nTotal: ${result.totalCount}\nSuccess: ${result.successCount}\nFailed: ${result.failedCount}\n\nFailed files:\n${failedList}`
        );
      }

      return result;
    } catch (error) {
      alert(`Error uploading photos: ${error.message}`);
      throw error;
    }
  };

  // Retakes/Makeups handlers
  const handleRetakesUpload = async (fileOrFiles, type) => {
    try {
      exportCancelledRef.current = false;

      if (type === "csv") {
        console.log("Processing retakes CSV upload");
        const result = await handleRetakesCSVUpload(
          fileOrFiles,
          selectedSchool,
          setUploadProgress,
          setUploadStats
        );

        if (result.success) {
          alert(
            `Retakes/Makeups CSV processed successfully!\n\nRetakes: ${result.retakeCount}\nMakeups: ${result.makeupCount}\nTotal: ${result.totalCount}`
          );

          // Reload students to show the updated photoType badges
          if (unsubscribeStudentsRef.current) {
            const updatedStudents = await loadStudents(selectedSchool);
            setStudents(updatedStudents);
          }
        }

        return result;
      } else if (type === "photos") {
        console.log("Processing retakes photos upload");
        console.log("Files to upload:", fileOrFiles);

        const result = await handleRetakesPhotoUpload(
          fileOrFiles,
          selectedSchool,
          setUploadProgress,
          setUploadStats
        );

        if (result.success) {
          alert(
            `Retakes/Makeups photos uploaded successfully!\n\nRetakes: ${result.retakeCount}\nMakeups: ${result.makeupCount}\nTotal: ${result.totalCount}`
          );

          // Reload photos
          const updatedPhotos = await loadPhotos(selectedSchool);
          setPhotos(updatedPhotos);
        }

        return result;
      }
    } catch (error) {
      console.error(`Error processing retakes/makeups:`, error);
      alert(`Error processing retakes/makeups: ${error.message}`);
      throw error;
    }
  };

  // Export handlers
  const handleExportCSV = async () => {
    try {
      exportCancelledRef.current = false;
      const result = await exportToCSV(students, selectedSchool, schools);
      setExportResult(result);
    } catch (error) {
      setExportResult({
        success: false,
        title: "Export Failed",
        message: "Failed to export CSV file.",
        details: [`Error: ${error.message}`],
      });
    }
  };

  const handleExportPSPA = async () => {
    setPspaInstructionModal(true);
  };

  const handlePSPAInstructionContinue = async () => {
    setPspaInstructionModal(false);

    // Validate student IDs first
    const studentsWithPhotos = students.filter((student) => {
      const photo = photos.find((p) => p.studentId === student.id);
      return photo && photo.url;
    });

    if (studentsWithPhotos.length === 0) {
      setExportResult({
        success: false,
        title: "No Students with Photos",
        message: "Cannot create PSPA export without students who have photos.",
        details: [
          "Upload photos for students first",
          "Photos must match student names exactly",
        ],
      });
      return;
    }

    // Check for duplicate or missing IDs
    const validationResult = validateStudentIds(studentsWithPhotos);

    if (
      validationResult.duplicateIds.length > 0 ||
      validationResult.missingIds.length > 0
    ) {
      setIdValidationModal({
        isOpen: true,
        validationResult,
        exportType: "PSPA",
        onContinue: () => proceedWithPSPAExport(studentsWithPhotos),
      });
    } else {
      proceedWithPSPAExport(studentsWithPhotos);
    }
  };

  const proceedWithPSPAExport = async (studentsWithPhotos) => {
    try {
      exportCancelledRef.current = false;
      const result = await exportToPSPA(
        studentsWithPhotos,
        photos,
        setUploadProgress,
        setUploadStats,
        exportCancelledRef
      );
      setExportResult(result);
    } catch (error) {
      setExportResult({
        success: false,
        title: "PSPA Export Failed",
        message: "Failed to create PSPA export.",
        details: [`Error: ${error.message}`],
      });
    }
  };

  const handleExportTeacherEase = async () => {
    // Similar validation pattern for TeacherEase export
    const studentsWithPhotos = students.filter((student) => {
      const photo = photos.find((p) => p.studentId === student.id);
      return photo && photo.url;
    });

    if (studentsWithPhotos.length === 0) {
      setExportResult({
        success: false,
        title: "No Students with Photos",
        message:
          "Cannot create TeacherEase export without students who have photos.",
        details: [
          "Upload photos for students first",
          "Photos must match student names exactly",
        ],
      });
      return;
    }

    const validationResult = validateStudentIds(studentsWithPhotos);

    if (
      validationResult.duplicateIds.length > 0 ||
      validationResult.missingIds.length > 0
    ) {
      setIdValidationModal({
        isOpen: true,
        validationResult,
        exportType: "TeacherEase",
        onContinue: () => proceedWithTeacherEaseExport(studentsWithPhotos),
      });
    } else {
      proceedWithTeacherEaseExport(studentsWithPhotos);
    }
  };

  const proceedWithTeacherEaseExport = async (studentsWithPhotos) => {
    try {
      exportCancelledRef.current = false;
      const result = await exportToTeacherEase(
        studentsWithPhotos,
        photos,
        setUploadProgress,
        setUploadStats,
        exportCancelledRef
      );
      setExportResult(result);
    } catch (error) {
      setExportResult({
        success: false,
        title: "TeacherEase Export Failed",
        message: "Failed to create TeacherEase export.",
        details: [`Error: ${error.message}`],
      });
    }
  };

  const handleExportSkyward = async () => {
    // Similar validation pattern for Skyward export
    const studentsWithPhotos = students.filter((student) => {
      const photo = photos.find((p) => p.studentId === student.id);
      return photo && photo.url;
    });

    if (studentsWithPhotos.length === 0) {
      setExportResult({
        success: false,
        title: "No Students with Photos",
        message:
          "Cannot create Skyward export without students who have photos.",
        details: [
          "Upload photos for students first",
          "Photos must match student names exactly",
        ],
      });
      return;
    }

    const validationResult = validateStudentIds(studentsWithPhotos);

    if (
      validationResult.duplicateIds.length > 0 ||
      validationResult.missingIds.length > 0
    ) {
      setIdValidationModal({
        isOpen: true,
        validationResult,
        exportType: "Skyward",
        onContinue: () => proceedWithSkywardExport(studentsWithPhotos),
      });
    } else {
      proceedWithSkywardExport(studentsWithPhotos);
    }
  };

  const proceedWithSkywardExport = async (studentsWithPhotos) => {
    try {
      exportCancelledRef.current = false;
      const result = await exportToSkyward(
        studentsWithPhotos,
        photos,
        setUploadProgress,
        setUploadStats,
        exportCancelledRef
      );
      setExportResult(result);
    } catch (error) {
      setExportResult({
        success: false,
        title: "Skyward Export Failed",
        message: "Failed to create Skyward export.",
        details: [`Error: ${error.message}`],
      });
    }
  };

  const handleExportFourUp = async () => {
    setFourUpSortModal(true);
  };

  const handleFourUpSortContinue = async (sortOptions) => {
    setFourUpSortModal(false);

    const studentsWithPhotos = students.filter((student) => {
      const photo = photos.find((p) => p.studentId === student.id);
      return photo && photo.url;
    });

    if (studentsWithPhotos.length === 0) {
      setExportResult({
        success: false,
        title: "No Students with Photos",
        message: "Cannot create 4-Up labels without students who have photos.",
        details: [
          "Upload photos for students first",
          "Photos must match student names exactly",
        ],
      });
      return;
    }

    try {
      exportCancelledRef.current = false;
      const selectedSchoolData = schools.find((s) => s.id === selectedSchool);
      const result = await exportToFourUp(
        studentsWithPhotos,
        photos,
        sortOptions,
        selectedSchoolData?.name || "Unknown School",
        setUploadProgress,
        setUploadStats,
        exportCancelledRef
      );
      setExportResult(result);
    } catch (error) {
      setExportResult({
        success: false,
        title: "4-Up Export Failed",
        message: "Failed to create 4-Up labels.",
        details: [`Error: ${error.message}`],
      });
    }
  };

  // Student management
  const handleUpdateStudent = async (studentId, updates) => {
    try {
      await updateStudent(selectedSchool, studentId, updates, user);
      return true;
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteStudent = async (studentId) => {
    try {
      await deleteStudent(selectedSchool, studentId);
      return true;
    } catch (error) {
      throw error;
    }
  };

  // Photo management
  const handlePhotoReplace = async (student, file) => {
    try {
      // Upload the new photo to the same location (it will overwrite)
      const storagePath = `schools/${selectedSchool}/photos/${file.name}`;
      const storageRef = ref(storage, storagePath);
      const uploadResult = await uploadBytes(storageRef, file);
      const newPhotoURL = await getDownloadURL(uploadResult.ref);

      // Save the new photo to history
      const historyRef = collection(
        db,
        "schools",
        selectedSchool,
        "students",
        student.id,
        "photoHistory"
      );
      await setDoc(doc(historyRef), {
        url: newPhotoURL,
        originalName: file.name,
        uploadDate: new Date().toISOString(),
        dateTaken: new Date().toISOString(),
        note: "Manual photo replacement",
        photoType: "replacement",
      });

      // Update the student record with the new image filename
      await updateStudent(
        selectedSchool,
        student.id,
        {
          ...student,
          Images: file.name,
        },
        user
      );

      // Reload photos
      const updatedPhotos = await loadPhotos(selectedSchool);
      setPhotos(updatedPhotos);

      return true;
    } catch (error) {
      throw error;
    }
  };

  const loadPhotoVersions = async (studentId) => {
    try {
      // Load photo history from Firestore
      const historyRef = collection(
        db,
        "schools",
        selectedSchool,
        "students",
        studentId,
        "photoHistory"
      );
      const historySnapshot = await getDocs(
        query(historyRef, orderBy("uploadDate", "asc"))
      ); // Order by oldest first

      const versions = [];

      // Only return versions if there's more than one photo in history
      if (historySnapshot.size > 1) {
        historySnapshot.forEach((doc) => {
          const data = doc.data();
          versions.push({
            id: doc.id,
            url: data.url,
            originalName: data.originalName,
            uploadDate: new Date(data.uploadDate),
            dateTaken: data.dateTaken ? new Date(data.dateTaken) : null,
            note: data.note || "",
            photoType: data.photoType,
          });
        });
      }

      return versions;
    } catch (error) {
      throw error;
    }
  };

  const restorePhotoVersion = async (student, version) => {
    try {
      // Get the current photo info
      const currentPhoto = photos.find((p) => p.name === student["Images"]);

      // The version.url points to the old photo we want to restore
      // Since we can't "move" files, we'll update the student record to point to the old filename

      // Save the current photo to history before restoring
      if (currentPhoto) {
        const historyRef = collection(
          db,
          "schools",
          selectedSchool,
          "students",
          student.id,
          "photoHistory"
        );
        await setDoc(doc(historyRef), {
          url: currentPhoto.url,
          originalName: student["Images"],
          uploadDate: new Date().toISOString(),
          dateTaken: new Date().toISOString(),
          replacedBy: version.originalName,
          replacedOn: new Date().toISOString(),
          note: "Photo before restoration",
        });
      }

      // Update student record to use the restored photo filename
      await updateStudent(
        selectedSchool,
        student.id,
        {
          ...student,
          Images: version.originalName,
        },
        user
      );

      // Reload photos
      const updatedPhotos = await loadPhotos(selectedSchool);
      setPhotos(updatedPhotos);

      return true;
    } catch (error) {
      throw error;
    }
  };

  const deletePhotoVersion = async (student, version) => {
    try {
      // Simply delete the history record from Firestore
      // We don't delete the actual file from storage since it might be in use
      const historyRef = doc(
        db,
        "schools",
        selectedSchool,
        "students",
        student.id,
        "photoHistory",
        version.id
      );
      await deleteDoc(historyRef);

      return true;
    } catch (error) {
      throw error;
    }
  };

  // Utility functions
  const validateStudentIds = (students) => {
    const idCounts = {};
    const missingIds = [];
    const duplicateIds = [];

    students.forEach((student) => {
      const id =
        student["Student ID"] ||
        student["Subject ID"] ||
        student["SASID"] ||
        student["Student Number"];

      if (!id || id.toString().trim() === "") {
        missingIds.push({
          name: `${student["First Name"]} ${student["Last Name"]}`,
          row: student.originalRowIndex || "Unknown",
        });
      } else {
        const idStr = id.toString().trim();
        idCounts[idStr] = (idCounts[idStr] || 0) + 1;
      }
    });

    Object.entries(idCounts).forEach(([id, count]) => {
      if (count > 1) {
        const studentsWithId = students.filter((s) => {
          const studentId =
            s["Student ID"] ||
            s["Subject ID"] ||
            s["SASID"] ||
            s["Student Number"];
          return studentId && studentId.toString().trim() === id;
        });

        duplicateIds.push({
          id: id,
          count: count,
          students: studentsWithId.map((s) => ({
            name: `${s["First Name"]} ${s["Last Name"]}`,
            row: s.originalRowIndex || "Unknown",
          })),
        });
      }
    });

    return { missingIds, duplicateIds };
  };

  const closeExportResult = () => {
    setExportResult(null);
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
      activeView !== "files" &&
      activeView !== "yearbook-proofing"
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
            onRetakesUpload={handleRetakesUpload}
            selectedSchool={selectedSchool}
            userRole={userRole}
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
      case "yearbook-proofing":
        return (
          <YearbookProofingView
            selectedSchool={selectedSchool}
            userRole={userRole}
            user={user}
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

  // Get selected school data for Sidebar
  const selectedSchoolData = schools.find((s) => s.id === selectedSchool);

  return (
    <div className="app">
      <ProgressIndicator
        uploadProgress={uploadProgress}
        uploadStats={uploadStats}
        onCancel={
          uploadProgress ? () => (exportCancelledRef.current = true) : null
        }
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
          selectedSchoolData={selectedSchoolData}
          hasYearbookProofs={hasYearbookProofs}
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
