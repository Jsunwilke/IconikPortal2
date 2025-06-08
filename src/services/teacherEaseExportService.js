import { findPhotoForStudent } from "../utils/photoUtils";
import { validateStudentIds } from "../utils/validation";

export const exportToTeacherEase = async (
  students,
  photos,
  selectedSchool,
  schools,
  exportCancelledRef,
  setUploadProgress,
  setUploadStats,
  setIdValidationModal
) => {
  if (students.length === 0) {
    return {
      type: "teacherease_export",
      success: false,
      title: "Export Not Available",
      message:
        "There are no students to export. Please upload student data first.",
      details: [
        "No student records found",
        "Upload a CSV file to add student data",
      ],
    };
  }

  // Check for ID fields in order of preference for TeacherEase
  let idField = "Student ID";
  const possibleTeacherEaseFields = [
    "Student ID",
    "Subject ID",
    "SASID",
    "MEPID",
    "ID",
  ];
  const foundField = possibleTeacherEaseFields.find((field) =>
    students.some((s) => s[field] && s[field].trim() !== "")
  );
  if (foundField) {
    idField = foundField;
  }

  // Validate Student IDs
  const validation = validateStudentIds(students, idField);
  if (!validation.isValid) {
    return new Promise((resolve) => {
      setIdValidationModal({
        isOpen: true,
        validationResult: validation,
        exportType: "TeacherEase",
        onContinue: () => {
          setIdValidationModal(null);
          performTeacherEaseExport(
            students,
            photos,
            selectedSchool,
            schools,
            exportCancelledRef,
            setUploadProgress,
            setUploadStats,
            idField
          ).then(resolve);
        },
      });
    });
  }

  return performTeacherEaseExport(
    students,
    photos,
    selectedSchool,
    schools,
    exportCancelledRef,
    setUploadProgress,
    setUploadStats,
    idField
  );
};

const performTeacherEaseExport = async (
  students,
  photos,
  selectedSchool,
  schools,
  exportCancelledRef,
  setUploadProgress,
  setUploadStats,
  idField = "Student ID"
) => {
  exportCancelledRef.current = false;

  try {
    const schoolName =
      schools.find((s) => s.id === selectedSchool)?.name || "School";
    const timestamp = new Date().toISOString().split("T")[0];

    setUploadProgress("Preparing TeacherEase export...");
    setUploadStats({
      current: 0,
      total: students.length + 1,
      percentage: 0,
      operation: "Creating TeacherEase Package",
    });

    // Check if File System Access API is available
    const hasFileSystemAccess =
      "showSaveFilePicker" in window && window.self === window.top;

    if (hasFileSystemAccess) {
      // Use File System Access API for modern browsers
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: `TeacherEase_Photos_${timestamp}.zip`,
        types: [
          {
            description: "ZIP files",
            accept: { "application/zip": [".zip"] },
          },
        ],
      });

      if (exportCancelledRef.current) {
        setUploadProgress("Export cancelled by user");
        setTimeout(() => {
          setUploadProgress(null);
          setUploadStats(null);
        }, 1500);
        return;
      }

      return await processTeacherEaseExport(
        students,
        photos,
        fileHandle,
        idField,
        exportCancelledRef,
        setUploadProgress,
        setUploadStats
      );
    } else {
      // Fallback for other browsers
      return await processTeacherEaseExportLegacy(
        students,
        idField,
        setUploadProgress,
        setUploadStats
      );
    }
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        type: "teacherease_export",
        success: false,
        title: "Export Cancelled",
        message: "No destination was selected for the TeacherEase export.",
        details: ["The file picker was cancelled", "No files were created"],
      };
    } else {
      console.error("TeacherEase export error:", error);
      return {
        type: "teacherease_export",
        success: false,
        title: "TeacherEase Export Failed",
        message:
          "An error occurred while creating your TeacherEase export package.",
        details: [`Error: ${error.message}`, "Please try the export again"],
      };
    }
  }
};

const processTeacherEaseExport = async (
  students,
  photos,
  fileHandle,
  idField,
  exportCancelledRef,
  setUploadProgress,
  setUploadStats
) => {
  const mappingLines = [];

  let processedCount = 0;
  let successCount = 0;
  let failedCount = 0;
  const photoData = [];

  // Process each student and collect photo data
  for (let i = 0; i < students.length; i++) {
    if (exportCancelledRef.current) {
      setUploadProgress("Export cancelled by user");
      setTimeout(() => {
        setUploadProgress(null);
        setUploadStats(null);
      }, 1500);
      return;
    }

    const student = students[i];
    const studentId = student[idField] || `TEMP_${i + 1}`;
    const studentName = `${student["First Name"]} ${student["Last Name"]}`;

    setUploadStats({
      current: processedCount + 1,
      total: students.length + 1,
      percentage: Math.round(
        ((processedCount + 1) / (students.length + 1)) * 100
      ),
      fileName: studentName,
      operation: exportCancelledRef.current
        ? "Cancelling Export"
        : "Processing TeacherEase Photos",
    });
    setUploadProgress(
      `Processing ${processedCount + 1}/${students.length}: ${studentName}`
    );

    const photo = findPhotoForStudent(student, photos);

    if (photo) {
      try {
        // TeacherEase expects photos named with StudentID.jpg
        const fileName = `${studentId}.jpg`;
        mappingLines.push(`${studentId}\t${fileName}`);

        // Load and process the image
        const img = await new Promise((resolve, reject) => {
          const image = new window.Image();
          image.crossOrigin = "anonymous";

          const timeout = setTimeout(() => {
            reject(new Error("Image load timeout"));
          }, 10000);

          image.onload = () => {
            clearTimeout(timeout);
            if (exportCancelledRef.current) {
              reject(new Error("Export cancelled"));
              return;
            }
            resolve(image);
          };

          image.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("Image load failed"));
          };

          if (exportCancelledRef.current) {
            reject(new Error("Export cancelled"));
            return;
          }

          image.src = photo.url;
        });

        if (exportCancelledRef.current) {
          throw new Error("Export cancelled");
        }

        // Create standardized photo (TeacherEase typically expects 300x400 or similar portrait dimensions)
        const targetWidth = 300;
        const targetHeight = 400;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", {
          alpha: false,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
        });

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Fill with white background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Calculate scaling to fit within target dimensions while maintaining aspect ratio
        const scaleToFit = Math.min(
          targetWidth / img.width,
          targetHeight / img.height
        );
        const scaledWidth = Math.ceil(img.width * scaleToFit);
        const scaledHeight = Math.ceil(img.height * scaleToFit);
        const offsetX = Math.floor((targetWidth - scaledWidth) / 2);
        const offsetY = Math.floor((targetHeight - scaledHeight) / 2);

        // Draw the image centered
        ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

        if (exportCancelledRef.current) {
          throw new Error("Export cancelled");
        }

        // Convert to blob
        const photoBlob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (exportCancelledRef.current) {
                reject(new Error("Export cancelled"));
                return;
              }

              if (blob && blob.size > 0) {
                resolve(blob);
              } else {
                reject(new Error("Failed to create blob"));
              }
            },
            "image/jpeg",
            0.9
          );
        });

        photoData.push({
          name: fileName,
          blob: photoBlob,
        });

        successCount++;
      } catch (error) {
        if (
          exportCancelledRef.current ||
          error.message === "Export cancelled"
        ) {
          console.log("Export cancelled during photo processing");
          setUploadProgress("Export cancelled by user");
          setTimeout(() => {
            setUploadProgress(null);
            setUploadStats(null);
          }, 1500);
          return;
        }

        console.error(`Error processing photo for ${studentName}:`, error);
        failedCount++;
      }
    } else {
      failedCount++;
    }

    processedCount++;
  }

  if (exportCancelledRef.current) {
    setUploadProgress("Export cancelled by user");
    setTimeout(() => {
      setUploadProgress(null);
      setUploadStats(null);
    }, 1500);
    return;
  }

  // Create ZIP file with photos and mapping file
  setUploadProgress("Creating TeacherEase ZIP package...");

  try {
    // Dynamically import JSZip only when needed
    const JSZip = (await import("jszip")).default;

    // Create ZIP package
    const zip = new JSZip();

    // Add mapping file
    const mappingContent = mappingLines.join("\n");
    zip.file("PhotoMapping.txt", mappingContent);

    // Add all photos to Photos folder (TeacherEase expects photos in a Photos subdirectory)
    photoData.forEach((photo) => {
      zip.file(`Photos/${photo.name}`, photo.blob);
    });

    if (exportCancelledRef.current) {
      setUploadProgress("Export cancelled by user");
      setTimeout(() => {
        setUploadProgress(null);
        setUploadStats(null);
      }, 1500);
      return;
    }

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ type: "blob" });

    if (exportCancelledRef.current) {
      setUploadProgress("Export cancelled by user");
      setTimeout(() => {
        setUploadProgress(null);
        setUploadStats(null);
      }, 1500);
      return;
    }

    // Save the ZIP file using the file handle
    const writable = await fileHandle.createWritable();
    await writable.write(zipBlob);
    await writable.close();

    setUploadProgress(null);
    setUploadStats(null);

    return {
      type: "teacherease_export",
      success: failedCount === 0,
      title:
        failedCount === 0
          ? "TeacherEase Export Complete"
          : "TeacherEase Export Completed with Issues",
      message:
        failedCount === 0
          ? "Your TeacherEase ZIP package has been successfully created and downloaded!"
          : `TeacherEase ZIP package created with ${successCount} photos and ${failedCount} failed items.`,
      stats: {
        totalCount: processedCount,
        successCount: successCount,
        failedCount: failedCount,
      },
      details: [
        `Created ZIP package with ${successCount} student photos`,
        `Used ${idField} field for student identification`,
        "Photos resized to 300x400px (TeacherEase standard)",
        "Includes PhotoMapping.txt mapping file",
        "Photos placed in Photos/ subdirectory",
        "Package ready for TeacherEase import",
        ...(failedCount > 0
          ? [`${failedCount} students had no matching photos`]
          : []),
      ],
    };
  } catch (error) {
    console.error("Error creating ZIP:", error);
    setUploadProgress(null);
    setUploadStats(null);

    return {
      type: "teacherease_export",
      success: false,
      title: "TeacherEase Export Failed",
      message: "Failed to create ZIP package.",
      details: [`Error: ${error.message}`],
    };
  }
};

const processTeacherEaseExportLegacy = async (
  students,
  idField,
  setUploadProgress,
  setUploadStats
) => {
  // Legacy fallback - just download mapping file
  const mappingLines = [];

  students.forEach((student) => {
    const studentId =
      student[idField] || `TEMP_${students.indexOf(student) + 1}`;
    const fileName = `${studentId}.jpg`;
    mappingLines.push(`${studentId}\t${fileName}`);
  });

  const mappingContent = mappingLines.join("\n");
  const blob = new Blob([mappingContent], { type: "text/plain" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "TeacherEase_PhotoMapping.txt";
  a.click();
  window.URL.revokeObjectURL(url);

  setUploadProgress(null);
  setUploadStats(null);

  return {
    type: "teacherease_export",
    success: true,
    title: "TeacherEase Export Complete",
    message: "Your TeacherEase mapping file has been downloaded.",
    details: [
      "Downloaded: TeacherEase_PhotoMapping.txt",
      `Used ${idField} field for identification`,
      "Tab-delimited format ready for import",
    ],
  };
};
