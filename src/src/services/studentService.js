import { db, storage } from "./firebase";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
  getMetadata,
} from "firebase/storage";
import { createNotification, findChanges } from "./notificationService";

// Simple photo metadata extraction function
const extractPhotoMetadata = async (file) => {
  try {
    const metadata = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      lastModified: new Date(file.lastModified).toISOString(),
      dateTaken: new Date(file.lastModified).toISOString(),
    };
    return metadata;
  } catch (error) {
    console.error("Error extracting photo metadata:", error);
    return {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      lastModified: new Date().toISOString(),
      dateTaken: null,
    };
  }
};

export const loadSchools = async () => {
  try {
    const schoolsRef = collection(db, "schools");
    const snapshot = await getDocs(schoolsRef);
    const schoolsList = [];
    snapshot.forEach((doc) => {
      schoolsList.push({ id: doc.id, ...doc.data() });
    });
    return schoolsList;
  } catch (error) {
    console.error("Error loading schools:", error);
    throw new Error("Error loading schools: " + error.message);
  }
};

// Real-time listener for students
export const subscribeToStudents = (selectedSchool, callback) => {
  if (!selectedSchool) {
    callback([]);
    return () => {};
  }

  try {
    const studentsRef = collection(db, "schools", selectedSchool, "students");
    const q = query(studentsRef, orderBy("Last Name", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const studentsList = [];
        snapshot.forEach((doc) => {
          studentsList.push({ id: doc.id, ...doc.data() });
        });
        console.log(
          "Real-time students update:",
          studentsList.length,
          "students"
        );
        callback(studentsList);
      },
      (error) => {
        console.error("Error in students listener:", error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error("Error setting up students listener:", error);
    callback([]);
    return () => {};
  }
};

// Keep the original loadStudents for compatibility
export const loadStudents = async (selectedSchool) => {
  if (!selectedSchool) return [];
  try {
    const studentsRef = collection(db, "schools", selectedSchool, "students");
    const snapshot = await getDocs(studentsRef);
    const studentsList = [];
    snapshot.forEach((doc) => {
      studentsList.push({ id: doc.id, ...doc.data() });
    });
    return studentsList;
  } catch (error) {
    console.error("Error loading students:", error);
    throw new Error("Error loading students: " + error.message);
  }
};

export const loadPhotos = async (selectedSchool) => {
  if (!selectedSchool) return [];
  try {
    const photosRef = ref(storage, "schools/" + selectedSchool + "/photos");
    const photosList = await listAll(photosRef);

    console.log("Total items found:", photosList.items.length);
    console.log("Prefixes (subfolders) found:", photosList.prefixes.length);

    // Log each item to see what we're getting
    photosList.items.forEach((item) => {
      console.log("Item path:", item.fullPath);
    });

    // Firebase listAll() only returns items in the current folder, not subfolders
    // So we should only be getting files directly in the photos folder
    const photoUrls = await Promise.all(
      photosList.items.map(async (item) => {
        console.log("Processing photo:", item.name);
        const url = await getDownloadURL(item);
        return { name: item.name, url };
      })
    );

    console.log("Final photo count:", photoUrls.length);
    return photoUrls;
  } catch (error) {
    console.error("Error loading photos:", error);
    return [];
  }
};

export const handleCSVUpload = async (
  file,
  selectedSchool,
  setUploadProgress,
  setUploadStats,
  exportCancelledRef
) => {
  if (!selectedSchool) {
    throw new Error("Please select a school first");
  }

  setUploadProgress("Parsing CSV file...");

  try {
    const text = await file.text();
    const lines = text.split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

    const studentsData = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i]
          .split(",")
          .map((v) => v.trim().replace(/"/g, ""));
        const student = {};
        headers.forEach((header, index) => {
          student[header] = values[index] || "";
        });

        // Check if this row has any actual data (not just empty values)
        const hasData = Object.values(student).some(
          (value) => value.trim() !== ""
        );

        // Also check for required fields to ensure it's a valid student
        const hasRequiredFields =
          student["First Name"]?.trim() ||
          student["Last Name"]?.trim() ||
          student["Online Code"]?.trim();

        if (hasData && hasRequiredFields) {
          studentsData.push(student);
        } else {
          console.log(
            `Skipping empty/invalid row ${i}: ${JSON.stringify(student)}`
          );
        }
      }
    }

    setUploadProgress(
      "Uploading " + studentsData.length + " students to Firestore..."
    );

    const batchSize = 20;
    for (let i = 0; i < studentsData.length; i += batchSize) {
      const batch = studentsData.slice(i, i + batchSize);
      setUploadProgress(
        "Uploading students " +
          (i + 1) +
          "-" +
          Math.min(i + batchSize, studentsData.length) +
          " of " +
          studentsData.length +
          "..."
      );

      await Promise.all(
        batch.map(async (student) => {
          const studentRef = doc(
            collection(db, "schools", selectedSchool, "students")
          );
          await setDoc(studentRef, {
            ...student,
            photoType: "original", // Mark as original photo
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        })
      );
    }

    return {
      success: true,
      count: studentsData.length,
      headers: headers,
    };
  } catch (error) {
    console.error("Error uploading CSV:", error);
    throw error;
  }
};

// New function for handling retakes/makeups CSV upload
export const handleRetakesCSVUpload = async (
  file,
  selectedSchool,
  setUploadProgress,
  setUploadStats
) => {
  if (!selectedSchool) {
    throw new Error("Please select a school first");
  }

  setUploadProgress("Parsing retakes/makeups CSV file...");

  try {
    const text = await file.text();
    const lines = text.split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

    const studentsData = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i]
          .split(",")
          .map((v) => v.trim().replace(/"/g, ""));
        const student = {};
        headers.forEach((header, index) => {
          student[header] = values[index] || "";
        });

        // Check if this row has any actual data (not just empty values)
        const hasData = Object.values(student).some(
          (value) => value.trim() !== ""
        );

        // Also check for required fields to ensure it's a valid student
        const hasRequiredFields =
          student["First Name"]?.trim() || student["Last Name"]?.trim();

        if (hasData && hasRequiredFields) {
          studentsData.push(student);
        }
      }
    }

    setUploadProgress(
      "Processing " + studentsData.length + " retakes/makeups..."
    );
    setUploadStats({
      current: 0,
      total: studentsData.length,
      percentage: 0,
      operation: "Processing Retakes/Makeups",
    });

    let retakeCount = 0;
    let makeupCount = 0;

    // Get all existing students to check online codes
    const existingStudentsRef = collection(
      db,
      "schools",
      selectedSchool,
      "students"
    );
    const existingSnapshot = await getDocs(existingStudentsRef);
    const existingStudentsByOnlineCode = {};

    console.log(`Found ${existingSnapshot.size} existing students in database`);
    console.log(`Processing ${studentsData.length} students from CSV`);

    existingSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data["Online Code"]) {
        existingStudentsByOnlineCode[data["Online Code"]] = {
          id: doc.id,
          data: data,
        };
      }
    });

    console.log(
      `Found ${
        Object.keys(existingStudentsByOnlineCode).length
      } students with Online Codes`
    );

    // Process each student from the CSV
    for (let i = 0; i < studentsData.length; i++) {
      const student = studentsData[i];
      const onlineCode = student["Online Code"];

      console.log(
        `Processing student ${i + 1}: ${student["First Name"]} ${
          student["Last Name"]
        }, Online Code: ${onlineCode}`
      );

      setUploadStats({
        current: i + 1,
        total: studentsData.length,
        percentage: Math.round(((i + 1) / studentsData.length) * 100),
        fileName: `${student["First Name"]} ${student["Last Name"]}`,
        operation: "Processing Retakes/Makeups",
      });

      if (onlineCode && existingStudentsByOnlineCode[onlineCode]) {
        // Student exists - this is a retake
        console.log(
          `Found existing student with Online Code ${onlineCode} - marking as retake`
        );
        const existingStudent = existingStudentsByOnlineCode[onlineCode];
        const studentRef = doc(
          db,
          "schools",
          selectedSchool,
          "students",
          existingStudent.id
        );

        await updateDoc(studentRef, {
          ...student,
          photoType: "retake",
          previousPhotoType: existingStudent.data.photoType || "original",
          retakeDate: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        retakeCount++;
        setUploadProgress(
          `Processed retake for ${student["First Name"]} ${student["Last Name"]}`
        );
      } else {
        // New student - this is a makeup
        console.log(
          `No existing student with Online Code ${onlineCode} - adding as makeup`
        );
        const studentRef = doc(
          collection(db, "schools", selectedSchool, "students")
        );

        await setDoc(studentRef, {
          ...student,
          photoType: "makeup",
          makeupDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        makeupCount++;
        setUploadProgress(
          `Added makeup student ${student["First Name"]} ${student["Last Name"]}`
        );
      }
    }

    console.log(
      `Final counts - Retakes: ${retakeCount}, Makeups: ${makeupCount}, Total: ${studentsData.length}`
    );

    setUploadProgress(null);
    setUploadStats(null);

    return {
      success: true,
      totalCount: studentsData.length,
      retakeCount: retakeCount,
      makeupCount: makeupCount,
      headers: headers,
    };
  } catch (error) {
    console.error("Error uploading retakes CSV:", error);
    throw error;
  }
};

export const handlePhotoUpload = async (
  files,
  selectedSchool,
  setUploadProgress,
  setUploadStats
) => {
  if (!selectedSchool) {
    throw new Error("Please select a school first");
  }

  const filesArray = Array.from(files);
  const totalFiles = filesArray.length;
  let uploadedCount = 0;
  let failedFiles = [];
  const CONCURRENT_UPLOADS = Math.min(5, totalFiles);

  try {
    setUploadProgress("Preparing to upload photos...");
    setUploadStats({
      current: 0,
      total: totalFiles,
      percentage: 0,
      operation: "Uploading Photos",
    });

    const uploadSingleFile = async (file, index) => {
      try {
        const storagePath =
          "schools/" + selectedSchool + "/photos/" + file.name;
        const photoRef = ref(storage, storagePath);
        const uploadResult = await uploadBytes(photoRef, file);
        const downloadURL = await getDownloadURL(photoRef);

        // Find if this photo belongs to a student and save to history
        const studentsRef = collection(
          db,
          "schools",
          selectedSchool,
          "students"
        );
        const studentsSnapshot = await getDocs(studentsRef);

        // Process each matching student
        for (const studentDoc of studentsSnapshot.docs) {
          const data = studentDoc.data();
          if (data["Images"] === file.name) {
            // Save original photo to history
            const historyRef = collection(
              db,
              "schools",
              selectedSchool,
              "students",
              studentDoc.id,
              "photoHistory"
            );
            const historyDocRef = doc(historyRef); // Create a new document reference
            await setDoc(historyDocRef, {
              url: downloadURL,
              originalName: file.name,
              uploadDate: new Date().toISOString(),
              dateTaken: new Date().toISOString(),
              note: "Original photo",
              photoType: "original",
            });
          }
        }

        uploadedCount++;
        const percentage = Math.round((uploadedCount / totalFiles) * 100);

        setUploadStats({
          current: uploadedCount,
          total: totalFiles,
          percentage: percentage,
          fileName: file.name,
          operation: "Uploading Photos",
        });
        setUploadProgress(
          "Uploaded " +
            file.name +
            " (" +
            uploadedCount +
            "/" +
            totalFiles +
            " - " +
            percentage +
            "%)"
        );

        return { success: true, fileName: file.name, url: downloadURL };
      } catch (error) {
        failedFiles.push({ name: file.name, error: error.message });
        return { success: false, fileName: file.name, error: error.message };
      }
    };

    const processInBatches = async () => {
      for (let i = 0; i < filesArray.length; i += CONCURRENT_UPLOADS) {
        const batch = filesArray.slice(i, i + CONCURRENT_UPLOADS);
        const batchPromises = batch.map((file, batchIndex) =>
          uploadSingleFile(file, i + batchIndex)
        );
        await Promise.allSettled(batchPromises);

        if (i + CONCURRENT_UPLOADS < filesArray.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    };

    await processInBatches();

    const successCount = uploadedCount;

    // Clear progress indicators
    setUploadProgress(null);
    setUploadStats(null);

    return {
      success: failedFiles.length === 0,
      totalCount: totalFiles,
      successCount: successCount,
      failedCount: failedFiles.length,
      failedFiles: failedFiles,
    };
  } catch (error) {
    console.error("Error in photo upload:", error);
    // Clear progress indicators on error
    setUploadProgress(null);
    setUploadStats(null);
    throw error;
  }
};

// New function for handling retakes/makeups photo upload
export const handleRetakesPhotoUpload = async (
  files,
  selectedSchool,
  setUploadProgress,
  setUploadStats
) => {
  console.log("=== handleRetakesPhotoUpload called ===");
  console.log("Files:", files);
  console.log("Selected school:", selectedSchool);

  if (!selectedSchool) {
    throw new Error("Please select a school first");
  }

  const filesArray = Array.from(files);
  const totalFiles = filesArray.length;
  let uploadedCount = 0;
  let failedFiles = [];
  let retakeCount = 0;
  let makeupCount = 0;

  console.log(`Processing ${totalFiles} photo files`);

  try {
    setUploadProgress("Processing retakes/makeups photos...");
    setUploadStats({
      current: 0,
      total: totalFiles,
      percentage: 0,
      operation: "Uploading Retakes/Makeups Photos",
    });

    // Get all students to match photos
    const studentsRef = collection(db, "schools", selectedSchool, "students");
    const studentsSnapshot = await getDocs(studentsRef);
    const studentsByImageName = {};
    const studentsWithRetakeType = [];
    const studentsWithMakeupType = [];

    studentsSnapshot.forEach((doc) => {
      const data = doc.data();
      const studentInfo = {
        id: doc.id,
        data: data,
        photoType: data.photoType,
      };

      // Map by Images field if it exists
      if (data["Images"]) {
        studentsByImageName[data["Images"]] = studentInfo;

        // Track students by type for better reporting
        if (data.photoType === "retake") {
          studentsWithRetakeType.push(studentInfo);
        } else if (data.photoType === "makeup") {
          studentsWithMakeupType.push(studentInfo);
        }
      }
    });

    console.log(
      `Found ${studentsWithRetakeType.length} students marked as retakes`
    );
    console.log(
      `Found ${studentsWithMakeupType.length} students marked as makeups`
    );
    console.log(
      `Total students with Images field: ${
        Object.keys(studentsByImageName).length
      }`
    );

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      const matchingStudent = studentsByImageName[file.name];

      console.log(
        `Processing photo: ${file.name}, matched student: ${
          matchingStudent ? `Yes (${matchingStudent.photoType})` : "No"
        }`
      );

      try {
        // Always upload to the regular photos folder
        const storagePath = `schools/${selectedSchool}/photos/${file.name}`;
        const photoRef = ref(storage, storagePath);

        // Extract metadata before upload
        const fileMetadata = await extractPhotoMetadata(file);

        console.log(`Uploading photo ${file.name} to ${storagePath}`);

        const uploadResult = await uploadBytes(photoRef, file, {
          customMetadata: {
            dateTaken: fileMetadata.dateTaken || new Date().toISOString(),
            originalName: file.name,
            photoType: matchingStudent ? matchingStudent.photoType : "original",
          },
        });

        console.log(`Successfully uploaded ${file.name}`);

        // Get photo metadata including date taken
        const metadata = await getMetadata(uploadResult.ref);
        const downloadURL = await getDownloadURL(uploadResult.ref);

        console.log(`Got download URL for ${file.name}: ${downloadURL}`);

        // Extract date taken from metadata if available
        const dateTaken =
          metadata.customMetadata?.dateTaken ||
          fileMetadata.dateTaken ||
          metadata.timeCreated ||
          new Date().toISOString();

        // After successful upload, create a history entry for this photo
        // This ensures we have a complete history including the original
        if (matchingStudent) {
          const historyRef = collection(
            db,
            "schools",
            selectedSchool,
            "students",
            matchingStudent.id,
            "photoHistory"
          );
          await setDoc(doc(historyRef), {
            url: downloadURL,
            originalName: file.name,
            uploadDate: new Date().toISOString(),
            dateTaken: dateTaken,
            note:
              matchingStudent.photoType === "retake"
                ? "Retake photo"
                : matchingStudent.photoType === "makeup"
                ? "Makeup photo"
                : "Original photo",
            photoType: matchingStudent.photoType || "original",
          });
        }

        uploadedCount++;
        const percentage = Math.round((uploadedCount / totalFiles) * 100);

        setUploadStats({
          current: uploadedCount,
          total: totalFiles,
          percentage: percentage,
          fileName: file.name,
          operation: "Uploading Retakes/Makeups Photos",
        });

        const studentInfo = matchingStudent
          ? ` (${matchingStudent.photoType} for ${matchingStudent.data["First Name"]} ${matchingStudent.data["Last Name"]})`
          : "";

        setUploadProgress(
          `Uploaded ${file.name}${studentInfo} (${uploadedCount}/${totalFiles} - ${percentage}%)`
        );
      } catch (error) {
        console.error(`Error uploading photo ${file.name}:`, error);
        failedFiles.push({ name: file.name, error: error.message });

        // Continue to next file instead of stopping
        uploadedCount++;
        const percentage = Math.round((uploadedCount / totalFiles) * 100);

        setUploadStats({
          current: uploadedCount,
          total: totalFiles,
          percentage: percentage,
          fileName: file.name,
          operation: "Uploading Retakes/Makeups Photos",
        });

        setUploadProgress(`Failed to upload ${file.name}: ${error.message}`);
      }
    }

    setUploadProgress(null);
    setUploadStats(null);

    console.log(
      `Upload complete - Success: ${
        failedFiles.length === 0
      }, Retakes: ${retakeCount}, Makeups: ${makeupCount}`
    );

    return {
      success: failedFiles.length === 0,
      totalCount: totalFiles,
      successCount: uploadedCount,
      failedCount: failedFiles.length,
      retakeCount: retakeCount,
      makeupCount: makeupCount,
      failedFiles: failedFiles,
    };
  } catch (error) {
    console.error("Error in retakes photo upload:", error);
    setUploadProgress(null);
    setUploadStats(null);
    throw error;
  }
};

export const updateStudent = async (
  selectedSchool,
  studentId,
  updatedData,
  currentUser = null
) => {
  try {
    const studentRef = doc(
      db,
      "schools",
      selectedSchool,
      "students",
      studentId
    );

    // Get the current data to compare changes
    const currentDoc = await getDoc(studentRef);
    const currentData = currentDoc.exists() ? currentDoc.data() : {};

    // Find what changed
    const changes = findChanges(currentData, updatedData);

    // Update the student
    await updateDoc(studentRef, {
      ...updatedData,
      updatedAt: new Date().toISOString(),
    });

    console.log(
      "Student updated successfully, changes detected:",
      changes.length
    );

    // If there are changes and we have user info, create notification
    if (changes.length > 0 && currentUser) {
      try {
        // Get school name
        const schoolDoc = await getDoc(doc(db, "schools", selectedSchool));
        const schoolName = schoolDoc.exists()
          ? schoolDoc.data().name
          : "Unknown School";

        // Get student name for notification
        const studentName = `${
          updatedData["First Name"] || currentData["First Name"] || ""
        } ${updatedData["Last Name"] || currentData["Last Name"] || ""}`.trim();

        console.log("Creating notification for:", {
          school: schoolName,
          student: studentName,
          changes: changes,
          user: currentUser.email,
        });

        // Create notification for studio users - PASS FULL STUDENT DATA BEFORE CHANGE
        await createNotification(
          selectedSchool,
          studentId,
          studentName || "Unknown Student",
          changes,
          {
            email: currentUser.email,
            role: currentUser.role || "school",
          },
          schoolName,
          currentData // NEW: Pass the full student data before change
        );

        console.log("Notification created successfully for student update:", {
          student: studentName,
          changes: changes.length,
          school: schoolName,
        });
      } catch (notificationError) {
        // Don't fail the update if notification fails
        console.error("Failed to create notification:", notificationError);
      }
    } else {
      console.log(
        "No notification created - changes:",
        changes.length,
        "user:",
        !!currentUser
      );
    }
  } catch (error) {
    console.error("Error updating student:", error);
    throw error;
  }
};

export const deleteStudent = async (selectedSchool, studentId, studentData) => {
  try {
    const studentRef = doc(
      db,
      "schools",
      selectedSchool,
      "students",
      studentId
    );
    await deleteDoc(studentRef);
  } catch (error) {
    throw error;
  }
};

export const createSchool = async (schoolData) => {
  try {
    const schoolRef = doc(collection(db, "schools"));
    await setDoc(schoolRef, {
      ...schoolData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return schoolRef.id;
  } catch (error) {
    throw error;
  }
};
