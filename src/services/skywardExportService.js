import { findPhotoForStudent } from "../utils/photoUtils";
import { validateStudentIds } from "../utils/validation";

export const exportToSkyward = async (
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
      type: "skyward_export",
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

  let idField = "Student Number";
  if (!students.some((s) => s[idField] && s[idField].trim() !== "")) {
    const possibleFields = ["Subject ID", "SASID", "MEPID", "Student ID", "ID"];
    idField =
      possibleFields.find((field) =>
        students.some((s) => s[field] && s[field].trim() !== "")
      ) || "Student Number";
  }

  const validation = validateStudentIds(students, idField);
  if (!validation.isValid) {
    return new Promise((resolve) => {
      setIdValidationModal({
        isOpen: true,
        validationResult: validation,
        exportType: "Skyward",
        onContinue: () => {
          setIdValidationModal(null);
          performSkywardExport(
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

  return performSkywardExport(
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

const performSkywardExport = async (
  students,
  photos,
  selectedSchool,
  schools,
  exportCancelledRef,
  setUploadProgress,
  setUploadStats,
  idField
) => {
  exportCancelledRef.current = false;

  try {
    const timestamp = new Date().toISOString().split("T")[0];
    setUploadProgress("Preparing Skyward export...");
    setUploadStats({
      current: 0,
      total: students.length + 1,
      percentage: 0,
      operation: "Creating Skyward Package",
    });

    const hasFileSystemAccess =
      "showSaveFilePicker" in window && window.self === window.top;

    if (hasFileSystemAccess) {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: `Skyward_Photos_${timestamp}.zip`,
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

      return await processSkywardExport(
        students,
        photos,
        fileHandle,
        idField,
        exportCancelledRef,
        setUploadProgress,
        setUploadStats
      );
    } else {
      return await processSkywardExportLegacy(
        students,
        idField,
        setUploadProgress,
        setUploadStats
      );
    }
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        type: "skyward_export",
        success: false,
        title: "Export Cancelled",
        message: "No destination was selected for the Skyward export.",
        details: ["The file picker was cancelled", "No files were created"],
      };
    } else {
      return {
        type: "skyward_export",
        success: false,
        title: "Skyward Export Failed",
        message:
          "An error occurred while creating your Skyward export package.",
        details: [`Error: ${error.message}`, "Please try the export again"],
      };
    }
  }
};

const processSkywardExport = async (
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
    const studentNumber = student[idField] || `TEMP_${i + 1}`;
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
        : "Processing Skyward Photos",
    });
    setUploadProgress(
      `Processing ${processedCount + 1}/${students.length}: ${studentName}`
    );

    const photo = findPhotoForStudent(student, photos);

    if (photo) {
      try {
        const fileName = `${studentNumber}.jpg`;
        mappingLines.push(`${studentNumber}\t${fileName}`);

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

        const targetWidth = 480;
        const targetHeight = 640;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", {
          alpha: false,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
        });

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        const scaleToFit = Math.min(
          targetWidth / img.width,
          targetHeight / img.height
        );
        const scaledWidth = Math.ceil(img.width * scaleToFit);
        const scaledHeight = Math.ceil(img.height * scaleToFit);
        const offsetX = Math.floor((targetWidth - scaledWidth) / 2);
        const offsetY = Math.floor((targetHeight - scaledHeight) / 2);

        ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

        if (exportCancelledRef.current) {
          throw new Error("Export cancelled");
        }

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
          setUploadProgress("Export cancelled by user");
          setTimeout(() => {
            setUploadProgress(null);
            setUploadStats(null);
          }, 1500);
          return;
        }

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

  setUploadProgress("Creating Skyward ZIP package...");

  try {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const mappingContent = mappingLines.join("\n");
    zip.file("PhotoMapping.txt", mappingContent);

    photoData.forEach((photo) => {
      zip.file(photo.name, photo.blob);
    });

    if (exportCancelledRef.current) {
      setUploadProgress("Export cancelled by user");
      setTimeout(() => {
        setUploadProgress(null);
        setUploadStats(null);
      }, 1500);
      return;
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });

    if (exportCancelledRef.current) {
      setUploadProgress("Export cancelled by user");
      setTimeout(() => {
        setUploadProgress(null);
        setUploadStats(null);
      }, 1500);
      return;
    }

    const writable = await fileHandle.createWritable();
    await writable.write(zipBlob);
    await writable.close();

    setUploadProgress(null);
    setUploadStats(null);

    return {
      type: "skyward_export",
      success: failedCount === 0,
      title:
        failedCount === 0
          ? "Skyward Export Complete"
          : "Skyward Export Completed with Issues",
      message:
        failedCount === 0
          ? "Your Skyward ZIP package has been successfully created and downloaded!"
          : `Skyward ZIP package created with ${successCount} photos and ${failedCount} failed items.`,
      stats: {
        totalCount: processedCount,
        successCount: successCount,
        failedCount: failedCount,
      },
      details: [
        `Created ZIP package with ${successCount} student photos`,
        `Used ${idField} field for student identification`,
        "Photos resized to 480x640px (Skyward standard)",
        "Includes PhotoMapping.txt mapping file",
        "Photos placed in ZIP root (no subdirectories)",
        "Package ready for Skyward SMS import",
        ...(failedCount > 0
          ? [`${failedCount} students had no matching photos`]
          : []),
      ],
    };
  } catch (error) {
    setUploadProgress(null);
    setUploadStats(null);

    return {
      type: "skyward_export",
      success: false,
      title: "Skyward Export Failed",
      message: "Failed to create ZIP package.",
      details: [`Error: ${error.message}`],
    };
  }
};

const processSkywardExportLegacy = async (
  students,
  idField,
  setUploadProgress,
  setUploadStats
) => {
  setUploadProgress("Creating Skyward export (Legacy Mode)...");

  try {
    const mappingLines = [];

    students.forEach((student) => {
      const studentNumber =
        student[idField] || `TEMP_${students.indexOf(student) + 1}`;
      const fileName = `${studentNumber}.jpg`;
      mappingLines.push(`${studentNumber}\t${fileName}`);
    });

    const mappingContent = mappingLines.join("\n");

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file("PhotoMapping.txt", mappingContent);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Skyward_Export.zip";
      a.click();
      window.URL.revokeObjectURL(url);

      setUploadProgress(null);
      setUploadStats(null);

      return {
        type: "skyward_export",
        success: true,
        title: "Skyward Export Complete (Legacy Mode)",
        message:
          "Your Skyward ZIP file has been downloaded with mapping file only.",
        details: [
          "Downloaded: Skyward_Export.zip",
          `Used ${idField} field for identification`,
          "Contains PhotoMapping.txt file",
          "Photos must be manually added to complete the package",
          "For full photo processing, use a modern browser like Chrome or Edge",
        ],
      };
    } catch (zipError) {
      const blob = new Blob([mappingContent], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "PhotoMapping.txt";
      a.click();
      window.URL.revokeObjectURL(url);

      setUploadProgress(null);
      setUploadStats(null);

      return {
        type: "skyward_export",
        success: true,
        title: "Skyward Export Complete (Legacy Mode)",
        message: "Your Skyward mapping file has been downloaded.",
        details: [
          "Downloaded: PhotoMapping.txt",
          `Used ${idField} field for identification`,
          "Manual photo collection required",
          "For complete ZIP package, use a modern browser",
        ],
      };
    }
  } catch (error) {
    setUploadProgress(null);
    setUploadStats(null);

    return {
      type: "skyward_export",
      success: false,
      title: "Skyward Export Failed",
      message: "Failed to create export file.",
      details: [`Error: ${error.message}`],
    };
  }
};
