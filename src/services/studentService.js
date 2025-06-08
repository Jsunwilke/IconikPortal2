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
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
} from "firebase/storage";
import { createNotification, findChanges } from "./notificationService";

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
  setUploadProgress
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
        studentsData.push(student);
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

    const successCount = uploadedCount - failedFiles.length;

    return {
      success: failedFiles.length === 0,
      totalCount: totalFiles,
      successCount: successCount,
      failedCount: failedFiles.length,
      failedFiles: failedFiles,
    };
  } catch (error) {
    console.error("Error in photo upload:", error);
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
