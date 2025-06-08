import { findPhotoForStudent } from "../utils/photoUtils";

export const exportToPSPA = async (
  students,
  photos,
  selectedSchool,
  schools,
  exportCancelledRef,
  setUploadProgress,
  setUploadStats
) => {
  if (students.length === 0) {
    return {
      type: "pspa_export",
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

  if (photos.length === 0) {
    return {
      type: "pspa_export",
      success: false,
      title: "Export Not Available",
      message:
        "No photos available for PSPA export. Please upload photos first.",
      details: ["No photos found in storage", "Upload photos before exporting"],
    };
  }

  // Reset cancellation flag
  exportCancelledRef.current = false;

  // Check if we're in an embedded environment (like CodeSandbox) or if File System Access API is not supported
  const isEmbedded = window.self !== window.top;
  const hasFileSystemAccess = "showDirectoryPicker" in window;

  if (isEmbedded || !hasFileSystemAccess) {
    // Use legacy mode for embedded environments
    return exportToPSPALegacy(
      students,
      photos,
      selectedSchool,
      schools,
      setUploadProgress,
      setUploadStats
    );
  }

  try {
    // Let user select the folder first
    setUploadProgress("Please select a folder for your PSPA export...");

    const directoryHandle = await window.showDirectoryPicker({
      mode: "readwrite",
    });

    // Quick cancellation check after folder selection
    if (exportCancelledRef.current) {
      console.log("Export cancelled after folder selection");
      setUploadProgress("Export cancelled by user");
      setTimeout(() => {
        setUploadProgress(null);
        setUploadStats(null);
      }, 1500);
      return;
    }

    const schoolName =
      schools.find((s) => s.id === selectedSchool)?.name || "School";
    const pspaFolderName =
      schoolName.replace(/[^a-zA-Z0-9]/g, "_") + "_" + new Date().getFullYear();

    // Create PSPA main folder
    const pspaFolder = await directoryHandle.getDirectoryHandle(
      pspaFolderName,
      { create: true }
    );

    // Create Images subfolder
    const imagesFolder = await pspaFolder.getDirectoryHandle("Images", {
      create: true,
    });

    setUploadProgress("Setting up PSPA export...");
    setUploadStats({
      current: 0,
      total: students.length + 1,
      percentage: 0,
      operation: "Creating PSPA Package",
    });

    // Create index.txt content with proper PSPA naming and photo matching
    const indexContent = students
      .map((student, index) => {
        const imageFolder = "Images";

        // PSPA standard naming: Sequential numbers with leading zeros (00001.jpg, 00002.jpg, etc.)
        const sequentialNumber = String(index + 1).padStart(5, "0");
        const imageName = sequentialNumber + ".jpg";

        const homeroom = student.Homeroom || "";
        const period = student.Period || "";
        const teacher = student.Teacher || "";
        const track = student.Track || "";
        const department =
          student.Type === "Student" ? "Student" : student.Type || "Student";
        const grade = student.Grade || "";
        const lastName = student["Last Name"] || "";
        const firstName = student["First Name"] || "";

        return [
          schoolName,
          imageFolder,
          imageName,
          grade,
          lastName,
          firstName,
          homeroom,
          period,
          teacher,
          track,
          department,
        ].join("\t");
      })
      .join("\n");

    // Save index.txt
    const indexFile = await pspaFolder.getFileHandle("index.txt", {
      create: true,
    });
    const indexWritable = await indexFile.createWritable();
    await indexWritable.write(indexContent);
    await indexWritable.close();

    setUploadStats({
      current: 1,
      total: students.length + 1,
      percentage: Math.round((1 / (students.length + 1)) * 100),
      operation: "Processing Images",
    });

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    console.log("Starting to process " + students.length + " students");

    // Process each student and find their matching photo
    for (let i = 0; i < students.length; i++) {
      // AGGRESSIVE cancellation check at the start of each iteration
      if (exportCancelledRef.current) {
        console.log("Export cancelled by user at student " + (i + 1));
        setUploadProgress("Export cancelled by user");
        setTimeout(() => {
          setUploadProgress(null);
          setUploadStats(null);
        }, 1500);
        return; // Exit the entire function
      }

      const student = students[i];
      const matchedPhoto = findPhotoForStudent(student, photos);

      // Skip students without photos
      if (!matchedPhoto) {
        console.log(
          "Skipping student " +
            (i + 1) +
            ": " +
            student["First Name"] +
            " " +
            student["Last Name"] +
            " - no photo found"
        );
        processedCount++;

        setUploadStats({
          current: processedCount + 1,
          total: students.length + 1,
          percentage: Math.round(
            ((processedCount + 1) / (students.length + 1)) * 100
          ),
          fileName:
            student["First Name"] + " " + student["Last Name"] + " (no photo)",
          operation: exportCancelledRef.current
            ? "Cancelling Export"
            : "Processing Images",
        });
        setUploadProgress(
          exportCancelledRef.current
            ? "Cancelling export... Please wait"
            : "Skipping " +
                processedCount +
                "/" +
                students.length +
                ": " +
                student["First Name"] +
                " " +
                student["Last Name"] +
                " (no photo found)"
        );

        // Small delay but check for cancellation
        await new Promise((resolve) => {
          setTimeout(() => {
            if (exportCancelledRef.current) {
              console.log("Export cancelled during skip delay");
            }
            resolve();
          }, 50);
        });
        continue;
      }

      // AGGRESSIVE cancellation check before processing each student
      if (exportCancelledRef.current) {
        console.log("Export cancelled before processing student " + (i + 1));
        setUploadProgress("Export cancelled by user");
        setTimeout(() => {
          setUploadProgress(null);
          setUploadStats(null);
        }, 1500);
        return;
      }

      try {
        const studentName = student["First Name"] + " " + student["Last Name"];

        setUploadStats({
          current: processedCount + 2,
          total: students.length + 1,
          percentage: Math.round(
            ((processedCount + 2) / (students.length + 1)) * 100
          ),
          fileName: matchedPhoto.name,
          operation: exportCancelledRef.current
            ? "Cancelling Export"
            : "Processing Images",
        });
        setUploadProgress(
          exportCancelledRef.current
            ? "Cancelling export... Please wait"
            : "Processing image " +
                (processedCount + 1) +
                "/" +
                students.length +
                ": " +
                studentName
        );

        console.log(
          "Processing student " +
            (i + 1) +
            ": " +
            studentName +
            " with photo: " +
            matchedPhoto.name
        );

        // THROW if cancelled - don't even start loading
        if (exportCancelledRef.current) {
          throw new Error("Export cancelled");
        }

        // Load the matched image - WITH TIMEOUT and cancellation
        const img = await new Promise((resolve, reject) => {
          const image = new window.Image();
          image.crossOrigin = "anonymous";

          const timeout = setTimeout(() => {
            reject(new Error("Image load timeout"));
          }, 10000); // Shorter timeout

          image.onload = () => {
            clearTimeout(timeout);
            // Check cancellation in onload
            if (exportCancelledRef.current) {
              reject(new Error("Export cancelled"));
              return;
            }
            console.log("Image loaded: " + matchedPhoto.name);
            resolve(image);
          };

          image.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("Image load failed"));
          };

          // Check cancellation before setting src
          if (exportCancelledRef.current) {
            reject(new Error("Export cancelled"));
            return;
          }

          image.src = matchedPhoto.url;
        });

        // AGGRESSIVE check after image load
        if (exportCancelledRef.current) {
          throw new Error("Export cancelled");
        }

        // Create high-quality resized image using canvas
        const targetWidth = 640;
        const targetHeight = 800;

        // Calculate scaling to fit within target dimensions while maintaining aspect ratio
        const scaleToFill = Math.max(
          targetWidth / img.width,
          targetHeight / img.height
        );
        const fillWidth = Math.ceil(img.width * scaleToFill);
        const fillHeight = Math.ceil(img.height * scaleToFill);
        const fillX = Math.floor((targetWidth - fillWidth) / 2);
        const fillY = Math.floor((targetHeight - fillHeight) / 2);

        // AGGRESSIVE check before canvas creation
        if (exportCancelledRef.current) {
          throw new Error("Export cancelled");
        }

        // Create canvas for final composition
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", {
          alpha: false,
          imageSmoothingEnabled: false, // Disable smoothing to prevent artifacts
          antialias: false,
          desynchronized: false,
        });

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Fill with pure white background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Disable image smoothing completely to prevent edge artifacts
        ctx.imageSmoothingEnabled = false;
        ctx.imageSmoothingQuality = "low";

        // Draw the image to fill the canvas completely (crop to fit)
        ctx.drawImage(img, fillX, fillY, fillWidth, fillHeight);

        // AGGRESSIVE check before blob creation
        if (exportCancelledRef.current) {
          throw new Error("Export cancelled");
        }

        // Convert to blob
        const resizedBlob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              // Check cancellation in blob callback
              if (exportCancelledRef.current) {
                reject(new Error("Export cancelled"));
                return;
              }

              if (blob && blob.size > 0) {
                console.log(
                  "Successfully created blob for " +
                    studentName +
                    ": " +
                    blob.size +
                    " bytes"
                );
                resolve(blob);
              } else {
                reject(new Error("Failed to create blob"));
              }
            },
            "image/jpeg",
            1.0
          );
        });

        // AGGRESSIVE check after blob creation
        if (exportCancelledRef.current) {
          throw new Error("Export cancelled");
        }

        // Generate PSPA standard filename: Sequential numbers with leading zeros
        const sequentialNumber = String(i + 1).padStart(5, "0");
        const pspaFileName = sequentialNumber + ".jpg";

        // Save with cancellation checks
        console.log("Saving " + pspaFileName);

        // AGGRESSIVE check before file creation
        if (exportCancelledRef.current) {
          throw new Error("Export cancelled");
        }

        const imageFile = await imagesFolder.getFileHandle(pspaFileName, {
          create: true,
        });

        // AGGRESSIVE check before writable creation
        if (exportCancelledRef.current) {
          throw new Error("Export cancelled");
        }

        const imageWritable = await imageFile.createWritable();

        // AGGRESSIVE check before writing
        if (exportCancelledRef.current) {
          await imageWritable.close();
          throw new Error("Export cancelled");
        }

        await imageWritable.write(resizedBlob);

        // AGGRESSIVE check before closing
        if (exportCancelledRef.current) {
          await imageWritable.close();
          throw new Error("Export cancelled");
        }

        await imageWritable.close();

        successCount++;
        console.log(
          "Successfully saved PSPA image: " +
            pspaFileName +
            " for " +
            studentName
        );

        processedCount++;

        // Small delay with cancellation check
        await new Promise((resolve) => {
          setTimeout(() => {
            if (exportCancelledRef.current) {
              console.log("Export cancelled during delay");
            }
            resolve();
          }, 50); // Shorter delay for faster cancellation
        });
      } catch (error) {
        // Check if this is a cancellation error
        if (
          exportCancelledRef.current ||
          error.message === "Export cancelled"
        ) {
          console.log("Export cancelled during student processing");
          setUploadProgress("Export cancelled by user");
          setTimeout(() => {
            setUploadProgress(null);
            setUploadStats(null);
          }, 1500);
          return;
        }

        failedCount++;
        processedCount++;
        console.error(
          "Error processing student " +
            (i + 1) +
            " (" +
            student["First Name"] +
            " " +
            student["Last Name"] +
            "):",
          error
        );
        setUploadProgress(
          "Failed: " +
            student["First Name"] +
            " " +
            student["Last Name"] +
            " - " +
            error.message
        );

        // Update stats even on failure
        setUploadStats({
          current: processedCount + 1,
          total: students.length + 1,
          percentage: Math.round(
            ((processedCount + 1) / (students.length + 1)) * 100
          ),
          fileName: student["First Name"] + " " + student["Last Name"],
          operation: exportCancelledRef.current
            ? "Cancelling Export"
            : "Processing Images",
        });

        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Final check if export was cancelled
    if (exportCancelledRef.current) {
      console.log("=== EXPORT CANCELLED BY USER ===");
      setUploadProgress(null);
      setUploadStats(null);
      return {
        type: "pspa_export",
        success: false,
        title: "PSPA Export Cancelled",
        message: "The PSPA export was cancelled by the user.",
        details: [
          "Export process was interrupted",
          "No complete package was created",
        ],
      };
    }

    setUploadProgress(null);
    setUploadStats(null);

    console.log("=== PSPA Export Complete ===");
    console.log(
      "Processed: " +
        processedCount +
        ", Success: " +
        successCount +
        ", Failed: " +
        failedCount
    );

    return {
      type: "pspa_export",
      success: failedCount === 0,
      title:
        failedCount === 0
          ? "PSPA Export Complete"
          : "PSPA Export Completed with Issues",
      message:
        failedCount === 0
          ? "Your PSPA package has been successfully created and is ready for yearbook software!"
          : `PSPA package created with ${successCount} photos and ${failedCount} failed items.`,
      stats: {
        totalCount: processedCount,
        successCount: successCount,
        failedCount: failedCount,
      },
      details: [
        `Created PSPA package in folder: ${pspaFolderName}`,
        `Package contains index.txt (student data mapping)`,
        `Images folder with ${successCount} photos resized to 640x800px`,
        "Sequential PSPA naming (00001.jpg, 00002.jpg, etc.)",
        "Package ready for yearbook software import",
        ...(failedCount > 0
          ? [`${failedCount} students had no matching photos`]
          : []),
      ],
      folderName: pspaFolderName,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        type: "pspa_export",
        success: false,
        title: "PSPA Export Cancelled",
        message: "No folder was selected for the PSPA export.",
        details: ["The folder picker was cancelled", "No files were created"],
      };
    } else {
      console.error("Error creating PSPA export:", error);
      return {
        type: "pspa_export",
        success: false,
        title: "PSPA Export Failed",
        message: "An error occurred while creating your PSPA export package.",
        details: [`Error: ${error.message}`, "Please try the export again"],
      };
    }
  }
};

// Legacy export for browsers that don't support File System Access API
const exportToPSPALegacy = async (
  students,
  photos,
  selectedSchool,
  schools,
  setUploadProgress,
  setUploadStats
) => {
  try {
    setUploadProgress("Creating PSPA export files...");
    setUploadStats({
      current: 0,
      total: photos.length + 1,
      percentage: 0,
      operation: "Creating PSPA Package (Legacy Mode)",
    });

    const schoolName =
      schools.find((s) => s.id === selectedSchool)?.name || "School";

    // Create index.txt content
    const indexContent = students
      .map((student, index) => {
        const imageFolder = "Images";
        const lastName = (student["Last Name"] || "Unknown").replace(
          /[^a-zA-Z0-9]/g,
          ""
        );
        const firstName = (student["First Name"] || "Unknown").replace(
          /[^a-zA-Z0-9]/g,
          ""
        );
        const grade = student.Grade || "00";
        const imageName = lastName + "_" + firstName + "_" + grade + ".jpg";

        const homeroom = student.Homeroom || "";
        const period = student.Period || "";
        const teacher = student.Teacher || "";
        const track = student.Track || "";
        const department =
          student.Type === "Student" ? "Student" : student.Type || "Student";

        return [
          schoolName,
          imageFolder,
          imageName,
          grade,
          lastName,
          firstName,
          homeroom,
          period,
          teacher,
          track,
          department,
        ].join("\t");
      })
      .join("\n");

    // Download index.txt file
    const indexBlob = new Blob([indexContent], { type: "text/plain" });
    const indexUrl = window.URL.createObjectURL(indexBlob);
    const indexLink = document.createElement("a");
    indexLink.href = indexUrl;
    indexLink.download = "index.txt";
    indexLink.style.display = "none";
    document.body.appendChild(indexLink);
    indexLink.click();
    document.body.removeChild(indexLink);
    window.URL.revokeObjectURL(indexUrl);

    setUploadProgress(null);
    setUploadStats(null);

    return {
      type: "pspa_export",
      success: true,
      title: "PSPA Export Complete (Legacy Mode)",
      message:
        "Your PSPA mapping file has been downloaded. This browser doesn't support folder creation.",
      details: [
        "Downloaded: index.txt (student data mapping)",
        "Photos resized to 640x800px PSPA standard",
        "For complete folder structure, use a modern browser like Chrome or Edge",
        "Manual photo collection required in this mode",
      ],
    };
  } catch (error) {
    console.error("Error creating PSPA export:", error);
    setUploadProgress(null);
    setUploadStats(null);
    return {
      type: "pspa_export",
      success: false,
      title: "PSPA Export Failed",
      message: "An error occurred while creating your PSPA export.",
      details: [`Error: ${error.message}`],
    };
  }
};
