import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Folder,
  File,
  Upload,
  Download,
  Search,
  Grid3X3,
  List,
  MoreVertical,
  Edit2,
  Trash2,
  History,
  Eye,
  Archive,
  FolderPlus,
  ChevronRight,
  Home,
  Building2,
  Users,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  ArrowUp,
  RotateCcw,
} from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../services/firebase";
import {
  loadFiles,
  uploadFiles,
  createFolder,
  renameFile,
  deleteFile,
  moveFile,
  getFileVersions,
  restoreFileVersion,
  searchFiles,
  getFileAnalytics,
} from "../../services/fileService";
import VirtualizedFileGrid from "../common/VirtualizedFileGrid";
import { getThumbnailUrl } from "../../services/thumbnailService";
import "../../styles/FilesView.css";

const FilesView = ({ selectedSchool, userRole, user, schools }) => {
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState("");
  const [currentFolder, setCurrentFolder] = useState("studio");
  const [viewMode, setViewMode] = useState("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState(null);
  const [uploadCancelling, setUploadCancelling] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFile, setRenamingFile] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());
  const [draggedFile, setDraggedFile] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [dragOverParent, setDragOverParent] = useState(false);
  const [movingFiles, setMovingFiles] = useState(new Set());
  const [moveProgress, setMoveProgress] = useState(0);
  const [moveStats, setMoveStats] = useState(null);
  const [showMoveProgress, setShowMoveProgress] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(null);
  const [showVersionHistory, setShowVersionHistory] = useState(null);
  const [showFileDetails, setShowFileDetails] = useState(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogData, setAuditLogData] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditSearchTerm, setAuditSearchTerm] = useState("");
  const [auditFilterAction, setAuditFilterAction] = useState("all");
  const [isDraggingInternal, setIsDraggingInternal] = useState(false);
  const [dragStarted, setDragStarted] = useState(false);

  const uploadCancelRef = useRef(false);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const contextMenuRef = useRef(null);
  const parentDropZoneRef = useRef(null);
  const dragCleanupTimeoutRef = useRef(null);

  // Derived values - calculated from state
  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper functions - can use derived values
  const getSelectedFileObjects = () => {
    return filteredFiles.filter((file) => selectedFileIds.has(file.id));
  };

  const canUpload = () => {
    if (userRole === "studio") return true;
    return currentFolder === "school";
  };

  const canDelete = () => {
    if (userRole === "studio") return true;
    return currentFolder === "school";
  };

  const canRename = () => {
    if (userRole === "studio") return true;
    return currentFolder === "school";
  };

  const canMove = () => {
    if (userRole === "studio") return true;
    return currentFolder === "school";
  };

  // Main functions
  const loadFilesData = useCallback(async () => {
    setLoading(true);
    try {
      const filesData = await loadFiles(
        selectedSchool,
        currentFolder,
        currentPath
      );
      setFiles(filesData);
    } catch (error) {
      console.error("Error loading files:", error);
      alert("Error loading files: " + error.message);
    }
    setLoading(false);
  }, [selectedSchool, currentFolder, currentPath]);

  const handleFileUpload = useCallback(
    async (files) => {
      if (!canUpload()) {
        alert("You don't have permission to upload files to this folder.");
        return;
      }

      setUploading(true);
      setUploadProgress(0);
      setUploadStats(null);
      setUploadCancelling(false);
      uploadCancelRef.current = false;

      try {
        const cleanUser = {
          uid: user.uid,
          email: user.email,
          role: userRole,
        };

        const results = await uploadFiles(
          selectedSchool,
          currentFolder,
          currentPath,
          files,
          cleanUser,
          (progressData) => {
            if (typeof progressData === "number") {
              setUploadProgress(progressData);
            } else {
              setUploadProgress(progressData.percentage);
              setUploadStats(progressData);
            }
          },
          () => uploadCancelRef.current
        );

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter(
          (r) => !r.success && !r.cancelled
        ).length;
        const cancelledCount = results.filter((r) => r.cancelled).length;

        await loadFilesData();

        let title, message;
        if (uploadCancelRef.current && cancelledCount > 0) {
          title = "Upload Cancelled";
          message = `Upload was cancelled. ${successCount} files were uploaded successfully before cancellation.`;
        } else if (failCount === 0) {
          title = "Upload Complete";
          message = `Successfully uploaded ${successCount} file(s).`;
        } else {
          title = "Upload Completed with Issues";
          message = `Uploaded ${successCount} files successfully, ${failCount} failed.`;
        }

        setUploadResult({
          success: !uploadCancelRef.current && failCount === 0,
          title: title,
          message: message,
          stats: {
            totalCount: files.length,
            successCount: successCount,
            failedCount: failCount,
            ...(cancelledCount > 0 && { cancelledCount: cancelledCount }),
          },
          details: [
            `Location: ${
              currentFolder === "studio" ? "Studio" : "School"
            } Files${currentPath ? ` / ${currentPath}` : ""}`,
            `Successful uploads: ${successCount}`,
            ...(failCount > 0 ? [`Failed uploads: ${failCount}`] : []),
            ...(cancelledCount > 0
              ? [`Cancelled uploads: ${cancelledCount}`]
              : []),
            "Files are immediately available for download",
          ],
        });
      } catch (error) {
        console.error("Upload error:", error);
        if (!uploadCancelRef.current) {
          alert("Error uploading files: " + error.message);
        }
      }

      setUploading(false);
      setUploadProgress(0);
      setUploadStats(null);
      setUploadCancelling(false);
      uploadCancelRef.current = false;
    },
    [
      currentFolder,
      currentPath,
      selectedSchool,
      user,
      userRole,
      canUpload,
      loadFilesData,
    ]
  );

  const handleCancelUpload = () => {
    console.log("Cancel button clicked - setting cancel flag");
    uploadCancelRef.current = true;
    setUploadCancelling(true);
    setUploadStats((prev) => (prev ? { ...prev, status: "cancelling" } : null));
  };

  // Helper to clean up drag state
  const cleanupDragState = useCallback(() => {
    // Don't cleanup if we just started dragging
    if (dragStarted && Date.now() - dragStarted < 100) {
      console.log("Skipping cleanup - drag just started");
      return;
    }

    console.log("Cleaning up drag state");

    // Clear any pending cleanup timeout
    if (dragCleanupTimeoutRef.current) {
      clearTimeout(dragCleanupTimeoutRef.current);
      dragCleanupTimeoutRef.current = null;
    }

    // Remove dragging class from all elements
    const allFileItems = document.querySelectorAll(".file-item.dragging");
    allFileItems.forEach((item) => {
      item.classList.remove("dragging");
    });

    // Clear all drag-related states
    setDragOverFolder(null);
    setDraggedFile(null);
    setDragOverParent(false);
    setIsDraggingInternal(false);
    setDragStarted(false);
  }, [dragStarted]);

  // Drag and drop handlers for moving files
  const handleDragStart = useCallback(
    (e, file) => {
      if (!canMove()) {
        e.preventDefault();
        return;
      }

      console.log("Starting drag for file:", file.name);

      // Clean up any previous drag state first
      cleanupDragState();

      // Set drag started timestamp
      setDragStarted(Date.now());

      // Set internal dragging state immediately
      setIsDraggingInternal(true);
      setDraggedFile(file);

      // Set drag data
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", file.id); // Use text/plain for better compatibility
      e.dataTransfer.setData("application/x-file-move", file.id);

      // Store reference to target element for cleanup
      const target = e.currentTarget;

      // Apply dragging class immediately
      target.classList.add("dragging");

      // Check if file is selected BEFORE updating state
      const isFileSelected = selectedFileIds.has(file.id);

      // If the file being dragged is not selected, defer selection update
      // This prevents React re-render from interfering with drag start
      if (!isFileSelected) {
        // Use setTimeout to defer state update until after drag has started
        setTimeout(() => {
          setSelectedFileIds(new Set([file.id]));
        }, 0);
      } else {
        // File is already selected, apply dragging to other selected files
        setTimeout(() => {
          const allFileItems = document.querySelectorAll(".file-item");
          allFileItems.forEach((item) => {
            const fileId = item.getAttribute("data-file-id");
            if (fileId && selectedFileIds.has(fileId) && item !== target) {
              item.classList.add("dragging");
            }
          });
        }, 10);
      }

      // Simplified drag image - don't create complex custom image
      const dragImage = new Image();
      dragImage.src =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs="; // 1x1 transparent image
      e.dataTransfer.setDragImage(dragImage, 0, 0);

      // Create drag image
      try {
        const dragImage = target.cloneNode(true);
        dragImage.style.position = "absolute";
        dragImage.style.top = "-2000px";
        dragImage.style.left = "-2000px";
        dragImage.style.pointerEvents = "none";
        dragImage.style.width = target.offsetWidth + "px";
        dragImage.style.height = target.offsetHeight + "px";
        dragImage.style.opacity = "0.9";
        dragImage.style.transform = "none";
        dragImage.style.border = "1px solid #e8eaed";
        dragImage.style.borderRadius = "8px";
        dragImage.style.background = "white";
        dragImage.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.15)";
        dragImage.style.animation = "none";
        dragImage.style.zIndex = "10000";

        dragImage.classList.remove("dragging");

        // Add badge if multiple files selected
        if (selectedFileIds.size > 1) {
          const badge = document.createElement("div");
          badge.style.position = "absolute";
          badge.style.top = "-8px";
          badge.style.right = "-8px";
          badge.style.backgroundColor = "#ef4444";
          badge.style.color = "white";
          badge.style.borderRadius = "50%";
          badge.style.width = "24px";
          badge.style.height = "24px";
          badge.style.display = "flex";
          badge.style.alignItems = "center";
          badge.style.justifyContent = "center";
          badge.style.fontSize = "0.75rem";
          badge.style.fontWeight = "600";
          badge.style.border = "2px solid white";
          badge.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
          badge.textContent = selectedFileIds.size.toString();
          dragImage.appendChild(badge);
        }

        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(
          dragImage,
          target.offsetWidth / 2,
          target.offsetHeight / 2
        );

        setTimeout(() => {
          if (document.body.contains(dragImage)) {
            document.body.removeChild(dragImage);
          }
        }, 1);
      } catch (error) {
        console.log("Could not create custom drag image:", error);
      }
    },
    [canMove, selectedFileIds, cleanupDragState]
  );

  const handleDragOver = useCallback(
    (e, targetFile) => {
      if (!draggedFile || !canMove()) return;

      // Only allow dropping on folders, and not on the same file
      if (targetFile.type === "folder" && targetFile.id !== draggedFile.id) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setDragOverFolder(targetFile.id);
      } else {
        e.dataTransfer.dropEffect = "none";
      }
    },
    [draggedFile, canMove]
  );

  const handleDragLeave = useCallback(
    (e, targetFile) => {
      if (!draggedFile) return;

      // Only clear if we're actually leaving the folder
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setDragOverFolder(null);
      }
    },
    [draggedFile]
  );

  const handleDrop = useCallback(
    (e, targetFile) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedFile || !canMove() || targetFile.type !== "folder") {
        cleanupDragState();
        return;
      }

      // Don't allow dropping on self
      if (targetFile.id === draggedFile.id) {
        cleanupDragState();
        return;
      }

      // Check if this is an internal file move
      const moveData =
        e.dataTransfer.getData("application/x-file-move") ||
        e.dataTransfer.getData("text/plain");
      if (moveData) {
        handleMove(draggedFile, targetFile.name);
      }

      cleanupDragState();
    },
    [draggedFile, canMove, cleanupDragState]
  );

  const handleDragEnd = useCallback(
    (e) => {
      console.log("Drag ended for file");

      // Add a small delay to ensure drop events have been processed
      dragCleanupTimeoutRef.current = setTimeout(() => {
        cleanupDragState();
      }, 50);
    },
    [cleanupDragState]
  );

  // Handle file/folder move
  const handleMove = async (sourceFile, targetFolderName) => {
    if (!canMove()) {
      alert("You don't have permission to move files in this folder.");
      return;
    }

    // Get all selected files if sourceFile is selected, otherwise just the sourceFile
    const filesToMove = selectedFileIds.has(sourceFile.id)
      ? getSelectedFileObjects()
      : [sourceFile];

    console.log(
      "Files to move:",
      filesToMove.map((f) => f.name)
    );

    // Show progress bar and initialize
    setShowMoveProgress(true);
    setMoveProgress(0);
    setMoveStats({
      current: 0,
      total: filesToMove.length,
      operation: "Moving files",
      fileName: "",
      percentage: 0,
    });

    // Add visual feedback immediately for all files being moved
    setMovingFiles((prev) => {
      const newSet = new Set(prev);
      filesToMove.forEach((file) => newSet.add(file.id));
      return newSet;
    });

    try {
      console.log(
        `Moving ${filesToMove.length} file(s) to ${targetFolderName}`
      );

      const cleanUser = {
        uid: user.uid,
        email: user.email,
        role: userRole,
      };

      let successCount = 0;
      let failedFiles = [];

      // Calculate target path
      const targetPath = currentPath
        ? `${currentPath}/${targetFolderName}`
        : targetFolderName;

      // Move each file individually with progress updates
      for (let i = 0; i < filesToMove.length; i++) {
        const file = filesToMove[i];

        // Update progress at start of each file
        const current = i + 1;
        const percentage = Math.round(((i + 0.5) / filesToMove.length) * 100);
        setMoveStats({
          current,
          total: filesToMove.length,
          operation: "Moving files",
          fileName: file.name,
          percentage,
        });
        setMoveProgress(percentage);

        try {
          console.log(
            `Moving individual file: ${file.name} (${current}/${filesToMove.length})`
          );

          await moveFile(
            selectedSchool,
            file.id,
            targetPath,
            cleanUser,
            file.type === "folder"
          );

          console.log(`Successfully moved: ${file.name}`);
          successCount++;

          // Update progress after completion
          const completedPercentage = Math.round(
            (current / filesToMove.length) * 100
          );
          setMoveProgress(completedPercentage);
        } catch (error) {
          console.error(`Error moving ${file.name}:`, error);
          failedFiles.push({ name: file.name, error: error.message });
        }

        // Small delay only for progress visibility on very fast operations
        if (i < filesToMove.length - 1 && filesToMove.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      console.log(
        `Move operation complete. Success: ${successCount}, Failed: ${failedFiles.length}`
      );

      await loadFilesData();

      // Clear selection after successful move
      if (successCount > 0) {
        setSelectedFileIds(new Set());
      }

      // Show result based on success/failure
      if (failedFiles.length === 0) {
        setUploadResult({
          success: true,
          title: `${filesToMove.length === 1 ? "File" : "Files"} Moved`,
          message: `Successfully moved ${successCount} file(s) to "${targetFolderName}".`,
          stats: {
            totalCount: filesToMove.length,
            successCount: successCount,
            failedCount: 0,
          },
          details: [
            `Moved: ${filesToMove.map((f) => f.name).join(", ")}`,
            `From: ${currentPath || "Root"}`,
            `To: ${targetPath}`,
            `Location: ${
              currentFolder === "studio" ? "Studio" : "School"
            } Files`,
          ],
        });
      } else {
        setUploadResult({
          success: false,
          title: "Move Completed with Issues",
          message: `Moved ${successCount} files successfully, ${failedFiles.length} failed.`,
          stats: {
            totalCount: filesToMove.length,
            successCount: successCount,
            failedCount: failedFiles.length,
          },
          details: [
            `Successfully moved: ${successCount} files`,
            `Failed files: ${failedFiles.map((f) => f.name).join(", ")}`,
            ...failedFiles.map((f) => `• ${f.name}: ${f.error}`),
          ],
        });
      }
    } catch (error) {
      console.error("Error in move operation:", error);
      alert("Error moving files: " + error.message);
    } finally {
      // Hide progress bar and clean up
      setShowMoveProgress(false);
      setMoveProgress(0);
      setMoveStats(null);

      // Remove visual feedback from all files
      setMovingFiles((prev) => {
        const newSet = new Set(prev);
        filesToMove.forEach((file) => newSet.delete(file.id));
        return newSet;
      });
    }
  };

  // Handle move to parent directory
  const handleMoveToParent = useCallback(
    async (sourceFile) => {
      if (!canMove() || !currentPath) {
        console.log("Move to parent blocked:", {
          canMove: canMove(),
          currentPath,
        });
        return;
      }

      // Get all selected files if sourceFile is selected, otherwise just the sourceFile
      const filesToMove = selectedFileIds.has(sourceFile.id)
        ? getSelectedFileObjects()
        : [sourceFile];

      console.log(
        "Parent move - Files to move:",
        filesToMove.map((f) => f.name)
      );

      // Show progress bar and initialize
      setShowMoveProgress(true);
      setMoveProgress(0);
      setMoveStats({
        current: 0,
        total: filesToMove.length,
        operation: "Moving to parent directory",
        fileName: "",
        percentage: 0,
      });

      // Add visual feedback immediately for all files being moved
      setMovingFiles((prev) => {
        const newSet = new Set(prev);
        filesToMove.forEach((file) => newSet.add(file.id));
        return newSet;
      });

      try {
        const pathParts = currentPath.split("/").filter(Boolean);
        const parentPath = pathParts.slice(0, -1).join("/");

        console.log(
          `Moving ${filesToMove.length} file(s) to parent directory (${
            parentPath || "root"
          })`
        );

        const cleanUser = {
          uid: user.uid,
          email: user.email,
          role: userRole,
        };

        let successCount = 0;
        let failedFiles = [];

        // Move each file individually with progress updates
        for (let i = 0; i < filesToMove.length; i++) {
          const file = filesToMove[i];

          // Update progress
          const current = i + 1;
          const percentage = Math.round((current / filesToMove.length) * 100);
          setMoveStats({
            current,
            total: filesToMove.length,
            operation: "Moving to parent directory",
            fileName: file.name,
            percentage,
          });
          setMoveProgress(percentage);

          try {
            console.log(
              `Moving individual file to parent: ${file.name} (${current}/${filesToMove.length})`
            );

            await moveFile(
              selectedSchool,
              file.id,
              parentPath,
              cleanUser,
              file.type === "folder"
            );

            console.log(`Successfully moved to parent: ${file.name}`);
            successCount++;
          } catch (error) {
            console.error(`Error moving ${file.name} to parent:`, error);
            failedFiles.push({ name: file.name, error: error.message });
          }

          // Small delay only for progress visibility on very fast operations
          if (i < filesToMove.length - 1 && filesToMove.length > 1) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }

        console.log(
          `Parent move operation complete. Success: ${successCount}, Failed: ${failedFiles.length}`
        );

        // Refresh the file list
        await loadFilesData();

        // Clear selection after successful move
        if (successCount > 0) {
          setSelectedFileIds(new Set());
        }

        // Show result based on success/failure
        if (failedFiles.length === 0) {
          setUploadResult({
            success: true,
            title: `${
              filesToMove.length === 1 ? "File" : "Files"
            } Moved to Parent Directory`,
            message: `Successfully moved ${successCount} file(s) to parent directory.`,
            stats: {
              totalCount: filesToMove.length,
              successCount: successCount,
              failedCount: 0,
            },
            details: [
              `Moved: ${filesToMove.map((f) => f.name).join(", ")}`,
              `From: ${currentPath}`,
              `To: ${parentPath || "Root"}`,
              `Location: ${
                currentFolder === "studio" ? "Studio" : "School"
              } Files`,
              `File${
                filesToMove.length === 1 ? " is" : "s are"
              } now available in the parent directory`,
            ],
          });
        } else {
          setUploadResult({
            success: false,
            title: "Move to Parent Completed with Issues",
            message: `Moved ${successCount} files successfully, ${failedFiles.length} failed.`,
            stats: {
              totalCount: filesToMove.length,
              successCount: successCount,
              failedCount: failedFiles.length,
            },
            details: [
              `Successfully moved: ${successCount} files`,
              `Failed files: ${failedFiles.map((f) => f.name).join(", ")}`,
              ...failedFiles.map((f) => `• ${f.name}: ${f.error}`),
            ],
          });
        }
      } catch (error) {
        console.error("Error moving files to parent:", error);

        setUploadResult({
          success: false,
          title: "Move to Parent Failed",
          message: `Could not move ${
            filesToMove.length === 1 ? "file" : "files"
          } to parent directory.`,
          details: [
            `Error: ${error.message}`,
            `Files: ${filesToMove.map((f) => f.name).join(", ")}`,
            `Current location: ${currentPath}`,
            "Please try again or contact support if the issue persists",
          ],
        });
      } finally {
        // Hide progress bar and clean up
        setShowMoveProgress(false);
        setMoveProgress(0);
        setMoveStats(null);

        // Remove visual feedback from all files
        setMovingFiles((prev) => {
          const newSet = new Set(prev);
          filesToMove.forEach((file) => newSet.delete(file.id));
          return newSet;
        });
      }
    },
    [
      canMove,
      currentPath,
      selectedSchool,
      user,
      userRole,
      loadFilesData,
      selectedFileIds,
      getSelectedFileObjects,
    ]
  );

  // Debug selectedFileIds changes
  useEffect(() => {
    console.log("selectedFileIds changed to:", selectedFileIds.size, "files");
    console.trace("Stack trace for selection change");
  }, [selectedFileIds]);
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingInternal && dragStarted && Date.now() - dragStarted > 200) {
        console.log("Global mouseup detected during drag - cleaning up");
        cleanupDragState();
      }
    };

    const handleGlobalDragEnd = (e) => {
      // Only cleanup if this is our drag operation
      if (isDraggingInternal) {
        console.log("Global dragend detected - cleaning up");
        // Use timeout to ensure drop events are processed first
        dragCleanupTimeoutRef.current = setTimeout(() => {
          cleanupDragState();
        }, 100);
      }
    };

    const handleEscape = (e) => {
      if (e.key === "Escape" && isDraggingInternal) {
        console.log("Escape pressed during drag - cleaning up");
        cleanupDragState();
      }
    };

    // Add listeners
    document.addEventListener("mouseup", handleGlobalMouseUp);
    document.addEventListener("dragend", handleGlobalDragEnd, true); // Use capture phase
    document.addEventListener("keydown", handleEscape);

    // Also handle when window loses focus
    const handleBlur = () => {
      if (isDraggingInternal && dragStarted && Date.now() - dragStarted > 200) {
        console.log("Window blur during drag - cleaning up");
        cleanupDragState();
      }
    };
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("dragend", handleGlobalDragEnd, true);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("blur", handleBlur);

      // Clear any pending timeouts
      if (dragCleanupTimeoutRef.current) {
        clearTimeout(dragCleanupTimeoutRef.current);
      }
    };
  }, [isDraggingInternal, dragStarted, cleanupDragState]);

  // UseEffect hooks
  useEffect(() => {
    if (selectedSchool) {
      loadFilesData();
      // Don't clear selection when just loading files
      // setSelectedFileIds(new Set());
    }
  }, [selectedSchool, currentPath, currentFolder, loadFilesData]);

  // TEMPORARILY DISABLED - Click away handler
  /*
  useEffect(() => {
    const handleClickAway = (event) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target)
      ) {
        setContextMenu(null);
      }
    };

    document.addEventListener("click", handleClickAway);
    return () => document.removeEventListener("click", handleClickAway);
  }, []);
  */

  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    const handleDragOver = (e) => {
      if (isDraggingInternal) return;
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("drag-over");
    };

    const handleDragLeave = (e) => {
      if (isDraggingInternal) return;
      e.preventDefault();
      e.stopPropagation();
      if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove("drag-over");
      }
    };

    const handleDrop = (e) => {
      if (isDraggingInternal) {
        dropZone.classList.remove("drag-over");
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("drag-over");

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileUpload(files);
      }
    };

    dropZone.addEventListener("dragover", handleDragOver);
    dropZone.addEventListener("dragleave", handleDragLeave);
    dropZone.addEventListener("drop", handleDrop);

    return () => {
      dropZone.removeEventListener("dragover", handleDragOver);
      dropZone.removeEventListener("dragleave", handleDragLeave);
      dropZone.removeEventListener("drop", handleDrop);
    };
  }, [currentPath, currentFolder, isDraggingInternal, handleFileUpload]);

  // Parent directory drop zone handlers
  useEffect(() => {
    const parentDropZone = parentDropZoneRef.current;
    if (!parentDropZone || !currentPath || !isDraggingInternal) {
      return;
    }

    const handleParentDragEnter = (e) => {
      if (!canMove() || !draggedFile) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOverParent(true);
    };

    const handleParentDragOver = (e) => {
      if (!canMove() || !draggedFile) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
    };

    const handleParentDragLeave = (e) => {
      if (!canMove() || !draggedFile) return;
      e.preventDefault();
      e.stopPropagation();

      // Check if we're actually leaving the drop zone
      if (!parentDropZone.contains(e.relatedTarget)) {
        setDragOverParent(false);
      }
    };

    const handleParentDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!canMove() || !draggedFile) {
        setDragOverParent(false);
        return;
      }

      console.log("Calling handleMoveToParent with:", draggedFile.name);
      handleMoveToParent(draggedFile);
      setDragOverParent(false);
      cleanupDragState();
    };

    parentDropZone.addEventListener("dragenter", handleParentDragEnter);
    parentDropZone.addEventListener("dragover", handleParentDragOver);
    parentDropZone.addEventListener("dragleave", handleParentDragLeave);
    parentDropZone.addEventListener("drop", handleParentDrop);

    console.log("Parent drop zone handlers attached for path:", currentPath);

    return () => {
      parentDropZone.removeEventListener("dragenter", handleParentDragEnter);
      parentDropZone.removeEventListener("dragover", handleParentDragOver);
      parentDropZone.removeEventListener("dragleave", handleParentDragLeave);
      parentDropZone.removeEventListener("drop", handleParentDrop);
    };
  }, [
    currentPath,
    canMove,
    handleMoveToParent,
    draggedFile,
    isDraggingInternal,
  ]);

  // Navigation and UI handlers
  const handleFolderClick = (folderName) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
    setSelectedFileIds(new Set());
  };

  const handleBreadcrumbClick = (index) => {
    const pathParts = currentPath.split("/").filter(Boolean);
    const newPath = pathParts.slice(0, index + 1).join("/");
    setCurrentPath(newPath);
    setSelectedFileIds(new Set());
  };

  const handleBackClick = () => {
    const pathParts = currentPath.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      pathParts.pop();
      setCurrentPath(pathParts.join("/"));
      setSelectedFileIds(new Set());
    }
  };

  const handleFileInputSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileUpload(files);
    }
    e.target.value = "";
  };

  const handleFileSelect = (file, event) => {
    event.stopPropagation();
    event.preventDefault();

    if (event.shiftKey && window.getSelection) {
      window.getSelection().removeAllRanges();
    }

    const newSelected = new Set(selectedFileIds);

    if (event.ctrlKey || event.metaKey) {
      if (newSelected.has(file.id)) {
        newSelected.delete(file.id);
      } else {
        newSelected.add(file.id);
      }
    } else if (event.shiftKey && selectedFileIds.size > 0) {
      const fileIds = filteredFiles.map((f) => f.id);
      const lastSelected =
        Array.from(selectedFileIds)[selectedFileIds.size - 1];
      const currentIndex = fileIds.indexOf(file.id);
      const lastIndex = fileIds.indexOf(lastSelected);

      const start = Math.min(currentIndex, lastIndex);
      const end = Math.max(currentIndex, lastIndex);

      for (let i = start; i <= end; i++) {
        newSelected.add(fileIds[i]);
      }
    } else {
      newSelected.clear();
      newSelected.add(file.id);
    }

    setSelectedFileIds(newSelected);
  };

  const handleSelectAll = () => {
    const allFileIds = new Set(filteredFiles.map((f) => f.id));
    setSelectedFileIds(allFileIds);
  };

  const handleDeselectAll = () => {
    setSelectedFileIds(new Set());
  };

  const handleContextMenu = (e, file) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      file: file,
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const cleanUser = {
        uid: user.uid,
        email: user.email,
        role: userRole,
      };

      await createFolder(
        selectedSchool,
        currentFolder,
        currentPath,
        newFolderName,
        cleanUser
      );

      setNewFolderName("");
      setShowNewFolderModal(false);
      await loadFilesData();

      setUploadResult({
        success: true,
        title: "Folder Created",
        message: `Successfully created folder "${newFolderName}".`,
        details: [
          `Location: ${currentFolder === "studio" ? "Studio" : "School"} Files${
            currentPath ? ` / ${currentPath}` : ""
          }`,
          `Folder name: ${newFolderName}`,
          "Ready for file uploads",
        ],
      });
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Error creating folder: " + error.message);
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim() || !renamingFile) return;

    try {
      const cleanUser = {
        uid: user.uid,
        email: user.email,
        role: userRole,
      };

      await renameFile(
        selectedSchool,
        renamingFile.id,
        renameValue,
        cleanUser,
        renamingFile.type === "folder"
      );

      setRenamingFile(null);
      setRenameValue("");
      await loadFilesData();

      setUploadResult({
        success: true,
        title: "File Renamed",
        message: `Successfully renamed "${renamingFile.name}" to "${renameValue}".`,
        details: [
          `Old name: ${renamingFile.name}`,
          `New name: ${renameValue}`,
          `Location: ${currentFolder === "studio" ? "Studio" : "School"} Files${
            currentPath ? ` / ${currentPath}` : ""
          }`,
        ],
      });
    } catch (error) {
      console.error("Error renaming file:", error);
      alert("Error renaming file: " + error.message);
    }
  };

  const handleDelete = async (file) => {
    if (!canDelete()) {
      alert("You don't have permission to delete files in this folder.");
      return;
    }

    setDeleteConfirmation({
      file: file,
      title: `Delete ${file.type === "folder" ? "Folder" : "File"}`,
      message: `Are you sure you want to delete "${file.name}"?`,
      details: [
        `Type: ${file.type === "folder" ? "Folder" : "File"}`,
        `Location: ${currentFolder === "studio" ? "Studio" : "School"} Files${
          currentPath ? ` / ${currentPath}` : ""
        }`,
        ...(file.type === "folder"
          ? [
              "All files and subfolders will be deleted",
              "This action can be undone from audit log",
            ]
          : [
              "File will be backed up to version history",
              "This action can be undone by restoring from versions",
            ]),
      ],
      onConfirm: async () => {
        setDeleteConfirmation(null);
        try {
          const cleanUser = {
            uid: user.uid,
            email: user.email,
            role: userRole,
          };

          await deleteFile(
            selectedSchool,
            file.id,
            cleanUser,
            file.type === "folder"
          );

          await loadFilesData();

          setUploadResult({
            success: true,
            title: `${file.type === "folder" ? "Folder" : "File"} Deleted`,
            message: `Successfully deleted "${file.name}".`,
            details: [
              `Deleted: ${file.name}`,
              `Type: ${file.type === "folder" ? "Folder" : "File"}`,
              `Location: ${
                currentFolder === "studio" ? "Studio" : "School"
              } Files${currentPath ? ` / ${currentPath}` : ""}`,
              ...(file.type === "file"
                ? ["Backup saved to version history"]
                : []),
            ],
          });
        } catch (error) {
          console.error("Error deleting file:", error);
          alert("Error deleting file: " + error.message);
        }
      },
      onCancel: () => setDeleteConfirmation(null),
    });
  };

  const handleBatchDelete = () => {
    console.log("Batch delete clicked");
    const selectedFileObjects = getSelectedFileObjects();
    console.log("Selected files:", selectedFileObjects);

    if (selectedFileObjects.length === 0) {
      console.log("No files selected");
      return;
    }

    if (!canDelete()) {
      console.log("No delete permission");
      alert("You don't have permission to delete files in this folder.");
      return;
    }

    const confirmData = {
      files: selectedFileObjects,
      isBatch: true,
      title: `Delete ${selectedFileObjects.length} Items`,
      message: `Are you sure you want to delete ${selectedFileObjects.length} selected items?`,
      details: [
        `Selected items: ${selectedFileObjects.length}`,
        `Location: ${currentFolder === "studio" ? "Studio" : "School"} Files${
          currentPath ? ` / ${currentPath}` : ""
        }`,
        "Files will be backed up to version history",
        "This action can be undone from audit log",
      ],
      onConfirm: async () => {
        console.log("Delete confirmed");
        setDeleteConfirmation(null);

        let successCount = 0;
        let failCount = 0;

        for (const file of selectedFileObjects) {
          try {
            const cleanUser = {
              uid: user.uid,
              email: user.email,
              role: userRole,
            };

            // The deleteFile function from fileService expects: (schoolId, fileId, user, isFolder)
            await deleteFile(
              selectedSchool,
              file.id,
              cleanUser,
              file.type === "folder"
            );
            successCount++;
            console.log(`Deleted: ${file.name}`);
          } catch (error) {
            console.error(`Error deleting ${file.name}:`, error);
            failCount++;
          }
        }

        await loadFilesData();
        setSelectedFileIds(new Set());

        setUploadResult({
          success: failCount === 0,
          title:
            failCount === 0
              ? "Batch Delete Complete"
              : "Batch Delete Completed with Issues",
          message:
            failCount === 0
              ? `Successfully deleted ${successCount} items.`
              : `Deleted ${successCount} items successfully, ${failCount} failed.`,
          stats: {
            totalCount: selectedFileObjects.length,
            successCount: successCount,
            failedCount: failCount,
          },
          details: [
            `Total items: ${selectedFileObjects.length}`,
            `Successfully deleted: ${successCount}`,
            ...(failCount > 0 ? [`Failed: ${failCount}`] : []),
            "Files backed up to version history",
          ],
        });
      },
      onCancel: () => {
        console.log("Delete cancelled");
        setDeleteConfirmation(null);
      },
    };

    console.log("Setting delete confirmation:", confirmData);
    setDeleteConfirmation(confirmData);
  };

  // Undo functionality
  const handleUndoAction = async (logEntry) => {
    try {
      console.log("Undoing action:", logEntry);

      const cleanUser = {
        uid: user.uid,
        email: user.email,
        role: userRole,
      };

      let undoSuccess = false;
      let undoMessage = "";

      switch (logEntry.action) {
        case "move_file":
        case "move_folder":
          // Move back to original location
          if (logEntry.sourcePath !== undefined) {
            await moveFile(
              selectedSchool,
              logEntry.fileId,
              logEntry.sourcePath,
              cleanUser,
              logEntry.action === "move_folder"
            );
            undoMessage = `Moved "${logEntry.fileName}" back to original location`;
            undoSuccess = true;
          }
          break;

        case "rename_file":
        case "rename_folder":
          // Restore original name
          if (logEntry.metadata?.oldName) {
            await renameFile(
              selectedSchool,
              logEntry.fileId,
              logEntry.metadata.oldName,
              cleanUser,
              logEntry.action === "rename_folder"
            );
            undoMessage = `Renamed "${logEntry.fileName}" back to "${logEntry.metadata.oldName}"`;
            undoSuccess = true;
          }
          break;

        case "delete_file":
        case "delete_folder":
          // Restore from soft delete
          try {
            const { doc, updateDoc, serverTimestamp } = await import(
              "firebase/firestore"
            );
            const { db } = await import("../../services/firebase");

            const fileRef = doc(
              db,
              "schools",
              selectedSchool,
              "files",
              logEntry.fileId
            );
            await updateDoc(fileRef, {
              isDeleted: false,
              restoredAt: serverTimestamp(),
              restoredBy: cleanUser,
            });

            undoMessage = `Restored "${logEntry.fileName}" from deletion`;
            undoSuccess = true;
          } catch (error) {
            console.error("Error restoring file:", error);
            throw new Error("Could not restore file: " + error.message);
          }
          break;

        case "create_folder":
          // Delete the created folder
          if (logEntry.fileId) {
            await deleteFile(selectedSchool, logEntry.fileId, cleanUser, true);
            undoMessage = `Removed created folder "${logEntry.fileName}"`;
            undoSuccess = true;
          }
          break;

        case "upload":
          // Delete the uploaded file
          if (logEntry.fileId) {
            await deleteFile(selectedSchool, logEntry.fileId, cleanUser, false);
            undoMessage = `Removed uploaded file "${logEntry.fileName}"`;
            undoSuccess = true;
          }
          break;

        default:
          throw new Error(`Cannot undo action type: ${logEntry.action}`);
      }

      if (undoSuccess) {
        // Refresh the file list
        await loadFilesData();

        // Refresh the audit log
        await handleLoadAuditLog();

        // Show success message
        setUploadResult({
          success: true,
          title: "Action Undone",
          message: undoMessage,
          details: [
            `Original action: ${logEntry.action
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase())}`,
            `Performed by: ${logEntry.user?.email || "Unknown"}`,
            `Original time: ${new Date(
              logEntry.timestamp?.seconds * 1000 || logEntry.timestamp
            ).toLocaleString()}`,
            `Undone by: ${user.email}`,
          ],
        });
      }
    } catch (error) {
      console.error("Error undoing action:", error);
      setUploadResult({
        success: false,
        title: "Undo Failed",
        message: `Could not undo the ${logEntry.action.replace(
          /_/g,
          " "
        )} action.`,
        details: [
          `Error: ${error.message}`,
          `File: ${logEntry.fileName}`,
          "The file may have been modified since this action",
          "Please try the action manually or contact support",
        ],
      });
    }
  };

  // Check if an action can be undone
  const canUndoAction = (logEntry) => {
    const undoableActions = [
      "move_file",
      "move_folder",
      "rename_file",
      "rename_folder",
      "delete_file",
      "delete_folder",
      "create_folder",
      "upload",
    ];

    return undoableActions.includes(logEntry.action);
  };

  // Enhanced download functionality with better fallbacks
  const handleDownloadZip = async () => {
    if (selectedFileIds.size === 0) {
      setUploadResult({
        success: false,
        title: "No Files Selected",
        message: "Please select files to download as ZIP.",
        details: [
          "Click on files to select them",
          "Use Ctrl+Click to select multiple files",
          "Selected files will be highlighted in blue",
        ],
      });
      return;
    }

    try {
      // Import JSZip dynamically if available, otherwise show placeholder
      try {
        // This would be the real implementation with JSZip
        // const JSZip = await import('jszip');
        // ... ZIP creation logic ...

        // For now, show development message
        setUploadResult({
          success: false,
          title: "ZIP Download Coming Soon",
          message: "ZIP download functionality is being developed.",
          details: [
            `Selected files: ${selectedFileIds.size}`,
            "This feature will create a ZIP file of all selected files",
            "You'll be able to choose where to save the ZIP file",
            "Use individual downloads for now by right-clicking files",
          ],
        });
      } catch (importError) {
        throw new Error("ZIP library not available");
      }
    } catch (error) {
      console.error("Error creating ZIP:", error);
      setUploadResult({
        success: false,
        title: "ZIP Download Failed",
        message: "Could not create ZIP file.",
        details: [
          `Error: ${error.message}`,
          "ZIP functionality requires additional libraries",
          "Use individual file downloads for now",
        ],
      });
    }
  };

  const handleDownloadToFolder = async () => {
    if (selectedFileIds.size === 0) {
      setUploadResult({
        success: false,
        title: "No Files Selected",
        message: "Please select files to download.",
        details: [
          "Click on files to select them",
          "Use Ctrl+Click to select multiple files",
          "Selected files will be highlighted in blue",
        ],
      });
      return;
    }

    const selectedFileObjects = getSelectedFileObjects();

    try {
      // Check if we're in a secure context and have the API
      const hasFileSystemAccess =
        "showDirectoryPicker" in window &&
        window.isSecureContext &&
        !window.location.href.includes("sandbox");

      if (hasFileSystemAccess) {
        try {
          // Let user pick a directory
          const directoryHandle = await window.showDirectoryPicker();

          let successCount = 0;
          let failCount = 0;
          const failedFiles = [];

          for (const file of selectedFileObjects) {
            try {
              if (file.downloadURL && file.type === "file") {
                // Fetch the file
                const response = await fetch(file.downloadURL);
                if (!response.ok) {
                  throw new Error(
                    `HTTP ${response.status}: ${response.statusText}`
                  );
                }
                const blob = await response.blob();

                // Create file in the selected directory
                const fileHandle = await directoryHandle.getFileHandle(
                  file.name,
                  { create: true }
                );
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();

                successCount++;
              } else if (file.type === "folder") {
                console.log(`Skipping folder: ${file.name}`);
                failCount++;
                failedFiles.push({
                  name: file.name,
                  reason: "Folders cannot be downloaded",
                });
              } else {
                console.error(`No download URL for file: ${file.name}`);
                failCount++;
                failedFiles.push({
                  name: file.name,
                  reason: "No download URL available",
                });
              }
            } catch (fileError) {
              console.error(`Error downloading ${file.name}:`, fileError);
              failCount++;
              failedFiles.push({ name: file.name, reason: fileError.message });
            }
          }

          setUploadResult({
            success: failCount === 0,
            title:
              failCount === 0
                ? "Download Complete"
                : "Download Completed with Issues",
            message:
              failCount === 0
                ? `Successfully downloaded ${successCount} files.`
                : `Downloaded ${successCount} files successfully, ${failCount} failed.`,
            stats: {
              totalCount: selectedFileObjects.length,
              successCount: successCount,
              failedCount: failCount,
            },
            details: [
              `Total selected: ${selectedFileObjects.length}`,
              `Files downloaded: ${successCount}`,
              ...(failCount > 0 ? [`Failed: ${failCount}`] : []),
              `Downloaded to: ${directoryHandle.name}`,
              ...failedFiles.slice(0, 5).map((f) => `• ${f.name}: ${f.reason}`),
              ...(failedFiles.length > 5
                ? [`• ... and ${failedFiles.length - 5} more`]
                : []),
            ],
          });
        } catch (fsError) {
          if (fsError.name === "AbortError") {
            // User cancelled the directory picker
            console.log("User cancelled directory picker");
            return;
          }
          throw fsError;
        }
      } else {
        // Fallback: Traditional individual downloads
        console.log("Using fallback download method");

        let successCount = 0;
        let failCount = 0;
        const failedFiles = [];

        for (let i = 0; i < selectedFileObjects.length; i++) {
          const file = selectedFileObjects[i];

          try {
            if (file.downloadURL && file.type === "file") {
              // Create temporary download link
              const downloadLink = document.createElement("a");
              downloadLink.href = file.downloadURL;
              downloadLink.download = file.name;
              downloadLink.target = "_blank";
              downloadLink.style.display = "none";

              // Add to DOM, click, and remove
              document.body.appendChild(downloadLink);
              downloadLink.click();
              document.body.removeChild(downloadLink);

              successCount++;

              // Add delay between downloads to avoid browser blocking
              if (i < selectedFileObjects.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 800));
              }
            } else if (file.type === "folder") {
              console.log(`Skipping folder: ${file.name}`);
              failCount++;
              failedFiles.push({
                name: file.name,
                reason: "Folders cannot be downloaded",
              });
            } else {
              console.error(`No download URL for file: ${file.name}`);
              failCount++;
              failedFiles.push({
                name: file.name,
                reason: "No download URL available",
              });
            }
          } catch (error) {
            console.error(`Error downloading ${file.name}:`, error);
            failCount++;
            failedFiles.push({ name: file.name, reason: error.message });
          }
        }

        setUploadResult({
          success: failCount === 0,
          title:
            failCount === 0
              ? "Download Started"
              : "Download Started with Issues",
          message:
            failCount === 0
              ? `Successfully started download of ${successCount} files.`
              : `Started download of ${successCount} files, ${failCount} failed.`,
          stats: {
            totalCount: selectedFileObjects.length,
            successCount: successCount,
            failedCount: failCount,
          },
          details: [
            `Total selected: ${selectedFileObjects.length}`,
            `Downloads started: ${successCount}`,
            ...(failCount > 0 ? [`Failed: ${failCount}`] : []),
            "Files will appear in your browser's default downloads folder",
            "Note: Your browser doesn't support direct folder selection",
            "Consider using a modern browser like Chrome or Edge for better download experience",
            ...failedFiles.slice(0, 3).map((f) => `• ${f.name}: ${f.reason}`),
            ...(failedFiles.length > 3
              ? [`• ... and ${failedFiles.length - 3} more`]
              : []),
          ],
        });
      }
    } catch (error) {
      console.error("Error downloading to folder:", error);

      // Provide more specific error messages
      let errorDetails = [`Error: ${error.message}`];

      if (error.message.includes("showDirectoryPicker")) {
        errorDetails = [
          "Your browser doesn't support direct folder downloads",
          "This feature requires a modern browser with File System Access API",
          "Try using Chrome, Edge, or another Chromium-based browser",
          "Alternative: Files will download to your default downloads folder instead",
        ];
      } else if (
        error.message.includes("cross-origin") ||
        error.message.includes("iframe")
      ) {
        errorDetails = [
          "Download blocked due to security restrictions",
          "This may be due to the app running in an embedded frame",
          "Try opening the app in a new tab or window",
          "Files will download individually to your downloads folder instead",
        ];
      }

      setUploadResult({
        success: false,
        title: "Folder Download Failed",
        message: "Could not download files to a specific folder.",
        details: errorDetails,
      });
    }
  };

  const handleDownloadFile = async (file) => {
    try {
      if (file.downloadURL) {
        const downloadLink = document.createElement("a");
        downloadLink.href = file.downloadURL;
        downloadLink.download = file.name;
        downloadLink.target = "_blank";
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        setUploadResult({
          success: true,
          title: "Download Started",
          message: `Download of "${file.name}" has started.`,
          details: [
            `File: ${file.name}`,
            "Check your browser's downloads folder",
          ],
        });
      } else {
        throw new Error("No download URL available for this file");
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      setUploadResult({
        success: false,
        title: "Download Failed",
        message: `Could not download "${file.name}".`,
        details: [
          `Error: ${error.message}`,
          "Please try again or contact support",
        ],
      });
    }
  };

  const handlePreviewFile = async (file) => {
    try {
      if (file.contentType && file.contentType.startsWith("image/")) {
        setShowFilePreview({
          file: file,
          content: file.downloadURL,
          type: "image",
        });
      } else {
        setShowFileDetails({
          file: file,
          details: {
            name: file.name,
            size: file.size,
            modifiedTime: file.modifiedDate,
            contentType: file.contentType,
            downloadURL: file.downloadURL,
          },
        });
      }
    } catch (error) {
      console.error("Error previewing file:", error);
      setUploadResult({
        success: false,
        title: "Preview Failed",
        message: `Could not preview "${file.name}".`,
        details: [
          `Error: ${error.message}`,
          "File may be too large or not supported for preview",
        ],
      });
    }
  };

  const handleShowVersionHistory = async (file) => {
    try {
      console.log(`Loading version history for: ${file.name}`);

      // Show loading state
      setShowVersionHistory({
        file: file,
        versions: null,
        loading: true,
      });

      const versions = await getFileVersions(selectedSchool, file.id);

      // Update with loaded versions
      setShowVersionHistory({
        file: file,
        versions: versions,
        loading: false,
      });

      console.log("Version history loaded:", versions);
    } catch (error) {
      console.error("Error loading version history:", error);

      // Show error in the modal
      setShowVersionHistory({
        file: file,
        versions: [],
        loading: false,
        error: error.message,
      });

      // Also show error popup
      setUploadResult({
        success: false,
        title: "Version History Failed",
        message: `Could not load version history for "${file.name}".`,
        details: [
          `Error: ${error.message}`,
          "Version history may not be available for this file",
          "This feature requires files to have been replaced or backed up",
        ],
      });
    }
  };

  const handleRestoreVersion = async (file, version) => {
    try {
      console.log(`Restoring version for: ${file.name}`);

      await restoreFileVersion(selectedSchool, file.id, version.id, {
        uid: user.uid,
        email: user.email,
        role: userRole,
      });

      await loadFilesData();
      setShowVersionHistory(null);

      setUploadResult({
        success: true,
        title: "Version Restored",
        message: `Successfully restored "${file.name}" to a previous version.`,
        details: [
          `File: ${file.name}`,
          `Restored to: ${version.uploadDate}`,
          "File has been updated with the restored content",
        ],
      });
    } catch (error) {
      console.error("Error restoring version:", error);
      setUploadResult({
        success: false,
        title: "Restore Failed",
        message: `Could not restore version for "${file.name}".`,
        details: [
          `Error: ${error.message}`,
          "Please try again or contact support",
        ],
      });
    }
  };

  const handleLoadAuditLog = async () => {
    setLoadingAudit(true);
    try {
      console.log(`Loading audit log for school: ${selectedSchool}`);

      // Try to use the cloud function first
      try {
        const auditFunction = httpsCallable(functions, "getFileAuditLog");
        const result = await auditFunction({
          schoolId: selectedSchool,
          folder: currentFolder,
          limit: 200,
        });

        setAuditLogData(result.data.logs || []);
        console.log(
          "✅ Audit log loaded via Cloud Function:",
          result.data.logs?.length || 0,
          "entries"
        );
      } catch (cloudFunctionError) {
        console.log(
          "Cloud function failed, trying direct Firestore query:",
          cloudFunctionError
        );

        // Fallback: Direct Firestore query to school-level fileActions collection
        const { collection, query, orderBy, limit, getDocs } = await import(
          "firebase/firestore"
        );
        const { db } = await import("../../services/firebase");

        // Query the school-level fileActions collection (matches your existing structure)
        const actionsRef = collection(
          db,
          "schools",
          selectedSchool,
          "fileActions"
        );
        const actionsQuery = query(
          actionsRef,
          orderBy("timestamp", "desc"),
          limit(200)
        );

        const snapshot = await getDocs(actionsQuery);
        const logs = [];

        snapshot.forEach((doc) => {
          const data = doc.data();

          // Filter by folder if specified
          if (!currentFolder || data.folder === currentFolder) {
            logs.push({
              id: doc.id,
              action: data.action || "unknown",
              fileName: data.fileName || "Unknown file",
              folder: data.folder || "",
              path: data.path || "",
              sourcePath: data.sourcePath || "",
              targetPath: data.targetPath || "",
              user: data.user || { email: "Unknown user" },
              timestamp: data.timestamp?.toDate() || new Date(),
              metadata: data.metadata || {},
            });
          }
        });

        setAuditLogData(logs);
        console.log(
          "✅ Audit log loaded via Firestore fallback:",
          logs.length,
          "entries"
        );
      }

      setShowAuditLog(true);
      setAuditSearchTerm("");
      setAuditFilterAction("all");
    } catch (error) {
      console.error("Error loading audit log:", error);
      setUploadResult({
        success: false,
        title: "Audit Log Failed",
        message: "Could not load file system audit log.",
        details: [
          `Error: ${error.message}`,
          `School: ${selectedSchool}`,
          "The audit log may be empty or not yet populated",
          "File actions will appear here once users start managing files",
        ],
      });
    }
    setLoadingAudit(false);
  };

  const getFilteredAuditLog = () => {
    let filtered = auditLogData;

    if (auditSearchTerm.trim()) {
      const search = auditSearchTerm.toLowerCase().trim();
      filtered = filtered.filter((log) => {
        const fileName = (log.fileName || "").toLowerCase();
        const userEmail = (log.user?.email || "").toLowerCase();
        const action = (log.action || "").toLowerCase();
        const path = (log.path || "").toLowerCase();

        return (
          fileName.includes(search) ||
          userEmail.includes(search) ||
          action.includes(search) ||
          path.includes(search)
        );
      });
    }

    if (auditFilterAction !== "all") {
      filtered = filtered.filter((log) => log.action === auditFilterAction);
    }

    return filtered;
  };

  const getUniqueActions = () => {
    const actions = new Set();
    auditLogData.forEach((log) => {
      if (log.action) {
        actions.add(log.action);
      }
    });
    return Array.from(actions).sort();
  };

  const getFileTypeIcon = (file) => {
    if (file.type === "folder") {
      return <Folder className="file-type-icon folder" />;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "pdf":
        return <FileText className="file-type-icon pdf" />;
      case "doc":
      case "docx":
        return <FileText className="file-type-icon doc" />;
      case "xls":
      case "xlsx":
        return <FileSpreadsheet className="file-type-icon xls" />;
      case "ppt":
      case "pptx":
        return <FileText className="file-type-icon ppt" />;
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
      case "svg":
        return <FileImage className="file-type-icon jpg" />;
      case "mp4":
      case "avi":
      case "mov":
      case "wmv":
        return <FileVideo className="file-type-icon" />;
      case "mp3":
      case "wav":
      case "flac":
        return <FileAudio className="file-type-icon" />;
      case "zip":
      case "rar":
      case "7z":
        return <Archive className="file-type-icon zip" />;
      case "txt":
        return <FileText className="file-type-icon txt" />;
      default:
        return <File className="file-type-icon default" />;
    }
  };

  const breadcrumbs = currentPath ? currentPath.split("/").filter(Boolean) : [];
  const schoolName =
    schools.find((s) => s.id === selectedSchool)?.name || "Unknown School";

  if (!selectedSchool) {
    return (
      <div className="files-view">
        <div className="card-header">
          <h2 className="card-title">Files</h2>
        </div>
        <div className="files-empty-state">
          <Building2 className="empty-state-icon" />
          <h3 className="empty-state-title">Select a School</h3>
          <p className="empty-state-text">
            Choose a school from the header to access their files.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="files-view">
      {/* All modals and dialogs - same as before */}
      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              deleteConfirmation.onCancel();
            }
          }}
        >
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-container modal-warning-icon">
                <Trash2 style={{ width: "24px", height: "24px" }} />
              </div>
              <div>
                <h2 className="modal-title">{deleteConfirmation.title}</h2>
              </div>
            </div>

            <div className="modal-body">
              <div className="modal-content">{deleteConfirmation.message}</div>

              {deleteConfirmation.isBatch && deleteConfirmation.files && (
                <div className="modal-stats">
                  <div className="modal-stats-grid">
                    <div className="modal-stat-item">
                      <p className="modal-stat-number modal-total-number">
                        {deleteConfirmation.files.length}
                      </p>
                      <p className="modal-stat-label">Items</p>
                    </div>
                    <div className="modal-stat-item">
                      <p className="modal-stat-number modal-success-number">
                        {
                          deleteConfirmation.files.filter(
                            (f) => f.type === "file"
                          ).length
                        }
                      </p>
                      <p className="modal-stat-label">Files</p>
                    </div>
                    <div className="modal-stat-item">
                      <p className="modal-stat-number modal-warning-number">
                        {
                          deleteConfirmation.files.filter(
                            (f) => f.type === "folder"
                          ).length
                        }
                      </p>
                      <p className="modal-stat-label">Folders</p>
                    </div>
                  </div>
                </div>
              )}

              {deleteConfirmation.details && (
                <div className="modal-details">
                  <div className="modal-details-title">
                    <Info style={{ width: "16px", height: "16px" }} />
                    Warning
                  </div>
                  <div className="modal-details-list">
                    {deleteConfirmation.details.map((detail, index) => (
                      <div key={index} className="modal-detail-item">
                        • {detail}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={deleteConfirmation.onCancel}
                className="modal-button modal-button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={deleteConfirmation.onConfirm}
                className="modal-button"
                style={{
                  backgroundColor: "#ef4444",
                  color: "white",
                  border: "none",
                }}
              >
                <Trash2 style={{ width: "16px", height: "16px" }} />
                Delete{" "}
                {deleteConfirmation.isBatch
                  ? `${deleteConfirmation.files?.length || 0} Items`
                  : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {showAuditLog && (
        <div className="modal-overlay" onClick={() => setShowAuditLog(false)}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "800px", maxHeight: "80vh" }}
          >
            <div className="modal-header">
              <div className="modal-icon-container modal-info-icon">
                <History style={{ width: "24px", height: "24px" }} />
              </div>
              <div>
                <h2 className="modal-title">File System Audit Log</h2>
              </div>
            </div>

            <div
              className="modal-body"
              style={{ maxHeight: "60vh", overflowY: "auto" }}
            >
              <div className="modal-content">
                Activity log for{" "}
                {currentFolder === "studio" ? "Studio" : "School"} files
              </div>

              {/* Search and Filter */}
              <div
                style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}
              >
                <input
                  type="text"
                  placeholder="Search actions, files, or users..."
                  value={auditSearchTerm}
                  onChange={(e) => setAuditSearchTerm(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                  }}
                />
                <select
                  value={auditFilterAction}
                  onChange={(e) => setAuditFilterAction(e.target.value)}
                  style={{
                    padding: "0.5rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                  }}
                >
                  <option value="all">All Actions</option>
                  {getUniqueActions().map((action) => (
                    <option key={action} value={action}>
                      {action
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              {getFilteredAuditLog().length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "#6b7280",
                  }}
                >
                  <History
                    style={{
                      width: "48px",
                      height: "48px",
                      margin: "0 auto 1rem",
                    }}
                  />
                  <p>No audit log entries found</p>
                  <p style={{ fontSize: "0.875rem", margin: 0 }}>
                    {auditSearchTerm || auditFilterAction !== "all"
                      ? "Try adjusting your search or filter criteria"
                      : "File actions will appear here once users start managing files"}
                  </p>
                </div>
              ) : (
                <div className="modal-details">
                  <div className="modal-details-title">
                    <Info style={{ width: "16px", height: "16px" }} />
                    Recent Activity ({getFilteredAuditLog().length} entries)
                  </div>
                  <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    {getFilteredAuditLog().map((log, index) => (
                      <div
                        key={log.id || index}
                        style={{
                          padding: "0.75rem",
                          borderBottom:
                            index < getFilteredAuditLog().length - 1
                              ? "1px solid #f3f4f6"
                              : "none",
                          fontSize: "0.875rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "0.25rem",
                          }}
                        >
                          <div style={{ fontWeight: "600", color: "#1f2937" }}>
                            {log.action
                              ?.replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase()) ||
                              "Unknown Action"}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <div
                              style={{ fontSize: "0.75rem", color: "#6b7280" }}
                            >
                              {log.timestamp instanceof Date
                                ? log.timestamp.toLocaleString()
                                : new Date(
                                    log.timestamp?.seconds * 1000 || Date.now()
                                  ).toLocaleString()}
                            </div>
                            {canUndoAction(log) && (
                              <button
                                onClick={() => handleUndoAction(log)}
                                style={{
                                  padding: "0.25rem 0.5rem",
                                  fontSize: "0.75rem",
                                  backgroundColor: "#fef3c7",
                                  color: "#d97706",
                                  border: "1px solid #f59e0b",
                                  borderRadius: "0.25rem",
                                  cursor: "pointer",
                                  fontWeight: "500",
                                  transition: "all 0.2s",
                                }}
                                onMouseOver={(e) => {
                                  e.target.style.backgroundColor = "#fcd34d";
                                }}
                                onMouseOut={(e) => {
                                  e.target.style.backgroundColor = "#fef3c7";
                                }}
                              >
                                <RotateCcw
                                  style={{
                                    width: "12px",
                                    height: "12px",
                                    marginRight: "0.25rem",
                                  }}
                                />
                                Undo
                              </button>
                            )}
                          </div>
                        </div>
                        <div
                          style={{ color: "#4b5563", marginBottom: "0.25rem" }}
                        >
                          <strong>File:</strong> {log.fileName || "Unknown"}
                        </div>
                        {log.path && (
                          <div
                            style={{
                              color: "#6b7280",
                              fontSize: "0.8125rem",
                              marginBottom: "0.25rem",
                            }}
                          >
                            <strong>Path:</strong> {log.path}
                          </div>
                        )}
                        {(log.sourcePath || log.targetPath) && (
                          <div
                            style={{
                              color: "#6b7280",
                              fontSize: "0.8125rem",
                              marginBottom: "0.25rem",
                            }}
                          >
                            {log.sourcePath && log.targetPath ? (
                              <>
                                <strong>Moved:</strong> {log.sourcePath} →{" "}
                                {log.targetPath}
                              </>
                            ) : log.sourcePath ? (
                              <>
                                <strong>From:</strong> {log.sourcePath}
                              </>
                            ) : (
                              <>
                                <strong>To:</strong> {log.targetPath}
                              </>
                            )}
                          </div>
                        )}
                        <div
                          style={{ color: "#6b7280", fontSize: "0.8125rem" }}
                        >
                          <strong>User:</strong> {log.user?.email || "System"}
                        </div>
                        {log.metadata &&
                          Object.keys(log.metadata).length > 0 && (
                            <div
                              style={{
                                marginTop: "0.5rem",
                                padding: "0.5rem",
                                backgroundColor: "#f9fafb",
                                borderRadius: "0.25rem",
                                fontSize: "0.8125rem",
                              }}
                            >
                              <strong>Details:</strong>
                              <div
                                style={{
                                  marginTop: "0.25rem",
                                  fontFamily: "monospace",
                                }}
                              >
                                {Object.entries(log.metadata).map(
                                  ([key, value]) => (
                                    <div key={key}>
                                      <span style={{ color: "#6b7280" }}>
                                        {key}:
                                      </span>{" "}
                                      {JSON.stringify(value)}
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowAuditLog(false)}
                className="modal-button modal-button-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showVersionHistory && (
        <div
          className="modal-overlay"
          onClick={() => setShowVersionHistory(null)}
        >
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-container modal-info-icon">
                <History style={{ width: "24px", height: "24px" }} />
              </div>
              <div>
                <h2 className="modal-title">Version History</h2>
              </div>
            </div>

            <div className="modal-body">
              <div className="modal-content">
                File: {showVersionHistory.file?.name}
              </div>

              {showVersionHistory.loading ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "#6b7280",
                  }}
                >
                  <RefreshCw
                    style={{
                      width: "32px",
                      height: "32px",
                      margin: "0 auto 1rem",
                    }}
                    className="loading-spinner"
                  />
                  <p>Loading version history...</p>
                </div>
              ) : showVersionHistory.error ? (
                <div className="modal-details">
                  <div className="modal-details-title">
                    <AlertTriangle style={{ width: "16px", height: "16px" }} />
                    Error Loading Versions
                  </div>
                  <div className="modal-details-list">
                    <div className="modal-detail-item">
                      {showVersionHistory.error}
                    </div>
                    <div className="modal-detail-item">
                      This file may not have any previous versions yet.
                    </div>
                  </div>
                </div>
              ) : showVersionHistory.versions &&
                showVersionHistory.versions.length > 0 ? (
                <div className="modal-details">
                  <div className="modal-details-title">
                    <History style={{ width: "16px", height: "16px" }} />
                    Previous Versions ({showVersionHistory.versions.length})
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      gap: "1rem",
                      overflowX: "auto",
                      padding: "1rem 0.5rem",
                      minHeight: "200px",
                    }}
                  >
                    {showVersionHistory.versions.map((version, index) => (
                      <div
                        key={version.id || index}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          padding: "0.75rem",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "0.5rem",
                          textAlign: "center",
                          minWidth: "150px",
                          flexShrink: 0,
                        }}
                      >
                        {version.url && (
                          <img
                            src={version.url}
                            alt={`Version ${index + 1}`}
                            style={{
                              width: "80px",
                              height: "80px",
                              objectFit: "cover",
                              borderRadius: "0.375rem",
                              border: "1px solid #e2e8f0",
                              marginBottom: "0.5rem",
                            }}
                            onError={(e) => {
                              // Hide broken images
                              e.target.style.display = "none";
                            }}
                          />
                        )}
                        <div style={{ width: "100%" }}>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              color: "#1f2937",
                              marginBottom: "0.25rem",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "130px",
                            }}
                          >
                            {version.originalName || version.name || "Unknown"}
                          </div>
                          <div
                            style={{
                              fontSize: "0.625rem",
                              color: "#6b7280",
                              marginBottom: "0.5rem",
                              lineHeight: "1.3",
                            }}
                          >
                            {version.uploadDate ? (
                              <>
                                {version.uploadDate instanceof Date
                                  ? version.uploadDate.toLocaleDateString()
                                  : new Date(
                                      version.uploadDate
                                    ).toLocaleDateString()}
                                <br />
                                <span style={{ fontSize: "0.6rem" }}>
                                  {version.uploadDate instanceof Date
                                    ? version.uploadDate.toLocaleTimeString(
                                        [],
                                        { hour: "2-digit", minute: "2-digit" }
                                      )
                                    : new Date(
                                        version.uploadDate
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                </span>
                              </>
                            ) : (
                              "Unknown date"
                            )}
                            <br />
                            <span style={{ fontSize: "0.6rem" }}>
                              {version.size || "Unknown size"}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              justifyContent: "center",
                            }}
                          >
                            <button
                              onClick={() =>
                                handleRestoreVersion(
                                  showVersionHistory.file,
                                  version
                                )
                              }
                              className="modal-button modal-button-primary"
                              style={{
                                padding: "0.5rem 0.75rem",
                                fontSize: "0.75rem",
                              }}
                            >
                              <RotateCcw
                                style={{ width: "14px", height: "14px" }}
                              />
                              Restore
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="modal-details">
                  <div className="modal-details-title">
                    <History style={{ width: "16px", height: "16px" }} />
                    No Previous Versions
                  </div>
                  <div className="modal-details-list">
                    <div className="modal-detail-item">
                      This file has no version history yet.
                    </div>
                    <div className="modal-detail-item">
                      Previous versions are created when files are replaced or
                      before deletion.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowVersionHistory(null)}
                className="modal-button modal-button-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Result Modal */}
      {uploadResult && (
        <div className="modal-overlay" onClick={() => setUploadResult(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div
                className={`modal-icon-container ${
                  uploadResult.success
                    ? "modal-success-icon"
                    : "modal-warning-icon"
                }`}
              >
                {uploadResult.success ? (
                  <CheckCircle style={{ width: "24px", height: "24px" }} />
                ) : filteredFiles.length > 50 ? (
                  // Use virtualized grid for large file sets
                  <VirtualizedFileGrid
                    files={filteredFiles}
                    viewMode={viewMode}
                    selectedFileIds={selectedFileIds}
                    draggedFile={draggedFile}
                    dragOverFolder={dragOverFolder}
                    movingFiles={movingFiles}
                    renamingFile={renamingFile}
                    renameValue={renameValue}
                    canMove={canMove()}
                    onFileSelect={handleFileSelect}
                    onFolderClick={handleFolderClick}
                    onContextMenu={handleContextMenu}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onRenameChange={setRenameValue}
                    onRenameBlur={handleRename}
                    onRenameKeyPress={handleRename}
                    getFileTypeIcon={getFileTypeIcon}
                    getThumbnailUrl={getThumbnailUrl}
                  />
                ) : (
                  <AlertTriangle style={{ width: "24px", height: "24px" }} />
                )}
              </div>
              <div>
                <h2 className="modal-title">{uploadResult.title}</h2>
              </div>
            </div>

            <div className="modal-body">
              <div className="modal-content">{uploadResult.message}</div>

              {uploadResult.stats && (
                <div className="modal-stats">
                  <div className="modal-stats-grid">
                    <div className="modal-stat-item">
                      <p className="modal-stat-number modal-total-number">
                        {uploadResult.stats.totalCount}
                      </p>
                      <p className="modal-stat-label">Total</p>
                    </div>
                    <div className="modal-stat-item">
                      <p className="modal-stat-number modal-success-number">
                        {uploadResult.stats.successCount}
                      </p>
                      <p className="modal-stat-label">Success</p>
                    </div>
                    {uploadResult.stats.failedCount > 0 && (
                      <div className="modal-stat-item">
                        <p className="modal-stat-number modal-failed-number">
                          {uploadResult.stats.failedCount}
                        </p>
                        <p className="modal-stat-label">Failed</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {uploadResult.details && (
                <div className="modal-details">
                  <div className="modal-details-title">
                    <Info style={{ width: "16px", height: "16px" }} />
                    Details
                  </div>
                  <div className="modal-details-list">
                    {uploadResult.details.map((detail, index) => (
                      <div key={index} className="modal-detail-item">
                        • {detail}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setUploadResult(null)}
                className="modal-button modal-button-primary"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="card-header">
        <div>
          <h2 className="card-title">Files - {schoolName}</h2>
          <p className="files-summary">
            Database-Driven Storage •{" "}
            {currentFolder === "studio"
              ? "Studio Files (Read Only)"
              : "School Files"}{" "}
            • {filteredFiles.length} items
          </p>
        </div>
        <div className="files-actions">
          <button
            onClick={handleDownloadZip}
            className="button button-secondary"
            disabled={selectedFileIds.size === 0}
          >
            <Archive style={{ width: "16px", height: "16px" }} />
            Download ZIP ({selectedFileIds.size})
          </button>
          <button
            onClick={handleDownloadToFolder}
            className="button button-primary"
            disabled={selectedFileIds.size === 0}
          >
            <Download style={{ width: "16px", height: "16px" }} />
            Download to Folder ({selectedFileIds.size})
          </button>
        </div>
      </div>

      {/* Folder Tabs */}
      <div className="folder-tabs">
        <button
          onClick={() => {
            setCurrentFolder("studio");
            setCurrentPath("");
          }}
          className={`folder-tab ${currentFolder === "studio" ? "active" : ""}`}
        >
          <Building2 style={{ width: "16px", height: "16px" }} />
          Studio Files
          {userRole === "school" && (
            <span className="read-only-badge">Read Only</span>
          )}
        </button>
        <button
          onClick={() => {
            setCurrentFolder("school");
            setCurrentPath("");
          }}
          className={`folder-tab ${currentFolder === "school" ? "active" : ""}`}
        >
          <Users style={{ width: "16px", height: "16px" }} />
          School Files
        </button>
      </div>

      {/* Toolbar */}
      <div className="files-toolbar-container">
        {/* Main toolbar - always visible */}
        <div className="files-toolbar">
          {/* Navigation and basic actions */}
          <div className="toolbar-section">
            {currentPath && (
              <button
                onClick={handleBackClick}
                className="toolbar-button toolbar-button-icon"
                title="Back"
              >
                <ArrowLeft style={{ width: "16px", height: "16px" }} />
              </button>
            )}

            {canUpload() && (
              <>
                <button
                  onClick={handleFileInputSelect}
                  className="toolbar-button toolbar-button-primary"
                >
                  <Upload style={{ width: "16px", height: "16px" }} />
                  Upload
                </button>
                <button
                  onClick={() => setShowNewFolderModal(true)}
                  className="toolbar-button"
                >
                  <FolderPlus style={{ width: "16px", height: "16px" }} />
                  New Folder
                </button>
              </>
            )}

            <button
              onClick={loadFilesData}
              className="toolbar-button toolbar-button-icon"
              title="Refresh"
            >
              <RefreshCw style={{ width: "16px", height: "16px" }} />
            </button>

            {userRole === "studio" && (
              <button
                onClick={handleLoadAuditLog}
                className="toolbar-button"
                disabled={loadingAudit}
                title="View File System Audit Log"
              >
                {loadingAudit ? (
                  <RefreshCw
                    style={{ width: "16px", height: "16px" }}
                    className="loading-spinner"
                  />
                ) : (
                  <History style={{ width: "16px", height: "16px" }} />
                )}
                Audit Log
              </button>
            )}
          </div>

          {/* Search - centered with flex */}
          <div className="toolbar-search">
            <div className="search-box">
              <Search />
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          {/* View toggle */}
          <div className="toolbar-section">
            <div className="view-toggle">
              <button
                onClick={() => setViewMode("grid")}
                className={`view-toggle-button ${
                  viewMode === "grid" ? "active" : ""
                }`}
                title="Grid view"
              >
                <Grid3X3 />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`view-toggle-button ${
                  viewMode === "list" ? "active" : ""
                }`}
                title="List view"
              >
                <List />
              </button>
            </div>
          </div>
        </div>

        {/* Selection toolbar - always present but content changes */}
        <div className="files-toolbar-secondary">
          {selectedFileIds.size > 0 ? (
            <>
              <div className="toolbar-section">
                <div className="selection-badge">
                  {selectedFileIds.size} selected
                </div>

                <button
                  onClick={handleSelectAll}
                  className="toolbar-button toolbar-button-small"
                >
                  Select All
                </button>

                <button
                  onClick={handleDeselectAll}
                  className="toolbar-button toolbar-button-small"
                >
                  Clear
                </button>
              </div>

              <div className="toolbar-section">
                <button
                  onClick={handleDownloadToFolder}
                  className="toolbar-button toolbar-button-small"
                >
                  <Download style={{ width: "16px", height: "16px" }} />
                  Download to Folder
                </button>

                <button
                  onClick={handleDownloadZip}
                  className="toolbar-button toolbar-button-small"
                >
                  <Archive style={{ width: "16px", height: "16px" }} />
                  Download ZIP
                </button>

                <button
                  onClick={handleBatchDelete}
                  className="toolbar-button toolbar-button-small"
                  style={{ color: "#dc2626" }}
                >
                  <Trash2 style={{ width: "16px", height: "16px" }} />
                  Delete Selected
                </button>
              </div>
            </>
          ) : (
            <div className="toolbar-empty-message">
              Select files to perform batch actions
            </div>
          )}
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="breadcrumbs">
        <button
          onClick={() => setCurrentPath("")}
          className={`breadcrumb-item ${!currentPath ? "active" : ""}`}
        >
          <Home style={{ width: "14px", height: "14px" }} />
          {currentFolder === "studio" ? "Studio" : "School"}
        </button>
        {breadcrumbs.map((part, index) => (
          <React.Fragment key={index}>
            <ChevronRight
              style={{ width: "14px", height: "14px" }}
              className="breadcrumb-separator"
            />
            <button
              onClick={() => handleBreadcrumbClick(index)}
              className={`breadcrumb-item ${
                index === breadcrumbs.length - 1 ? "active" : ""
              }`}
            >
              {part}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Parent Directory Drop Zone - Always show when not at root */}
      {currentPath && canMove() && (
        <div
          ref={parentDropZoneRef}
          className={`parent-drop-zone ${dragOverParent ? "drag-over" : ""}`}
        >
          <ArrowUp style={{ width: "16px", height: "16px" }} />
          Drop here to move to parent directory
          <span
            style={{ marginLeft: "0.5rem", fontSize: "0.75rem", opacity: 0.7 }}
          >
            (← {currentPath.split("/").slice(0, -1).join("/") || "Root"})
          </span>
        </div>
      )}

      {/* Move Progress */}
      {showMoveProgress && (
        <div className="upload-progress">
          {moveStats && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.5rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  color: "#10b981",
                }}
              >
                {moveStats.operation} {moveStats.current} of {moveStats.total}{" "}
                files
              </div>
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  color: "#10b981",
                }}
              >
                {moveProgress}%
              </div>
            </div>
          )}

          <div className="upload-progress-bar">
            <div
              className="upload-progress-fill"
              style={{
                width: `${moveProgress}%`,
                backgroundColor: "#10b981",
              }}
            />
          </div>

          {moveStats && moveStats.fileName && (
            <div
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
                marginTop: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ fontWeight: "500" }}>Moving:</span>
              <span
                style={{
                  fontFamily: "monospace",
                  backgroundColor: "#f1f5f9",
                  padding: "0.125rem 0.375rem",
                  borderRadius: "0.25rem",
                  maxWidth: "400px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {moveStats.fileName}
              </span>
              <span style={{ color: "#10b981" }}>📁 Moving...</span>
            </div>
          )}
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="upload-progress">
          {uploadStats && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.5rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  color: uploadCancelling ? "#ef4444" : "#1e40af",
                }}
              >
                {uploadCancelling
                  ? "Cancelling..."
                  : `Uploading ${uploadStats.current} of ${uploadStats.total} files`}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    color: "#1e40af",
                  }}
                >
                  {uploadProgress}%
                </div>
                <button
                  onClick={handleCancelUpload}
                  disabled={uploadCancelling}
                  style={{
                    padding: "0.375rem 0.75rem",
                    fontSize: "0.75rem",
                    fontWeight: "500",
                    backgroundColor: uploadCancelling ? "#9ca3af" : "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: uploadCancelling ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {uploadCancelling ? "Cancelling..." : "Cancel"}
                </button>
              </div>
            </div>
          )}

          <div className="upload-progress-bar">
            <div
              className="upload-progress-fill"
              style={{
                width: `${uploadProgress}%`,
                backgroundColor: uploadCancelling ? "#ef4444" : "#3b82f6",
              }}
            />
          </div>

          {uploadStats && uploadStats.fileName && (
            <div
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
                marginTop: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ fontWeight: "500" }}>Current file:</span>
              <span
                style={{
                  fontFamily: "monospace",
                  backgroundColor: "#f1f5f9",
                  padding: "0.125rem 0.375rem",
                  borderRadius: "0.25rem",
                  maxWidth: "400px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {uploadStats.fileName}
              </span>
              {uploadStats.status === "uploading" && !uploadCancelling && (
                <span style={{ color: "#3b82f6" }}>⏳ Uploading...</span>
              )}
              {uploadStats.status === "completed" && (
                <span style={{ color: "#10b981" }}>✓ Complete</span>
              )}
              {uploadStats.status === "error" && (
                <span style={{ color: "#ef4444" }}>✗ Error</span>
              )}
              {uploadStats.status === "cancelling" && (
                <span style={{ color: "#ef4444" }}>🛑 Cancelling...</span>
              )}
              {uploadCancelling && uploadStats.status === "uploading" && (
                <span style={{ color: "#ef4444" }}>
                  🛑 Finishing current file...
                </span>
              )}
            </div>
          )}

          {!uploadStats && (
            <span className="upload-progress-text">
              Uploading... {uploadProgress}%
            </span>
          )}
        </div>
      )}

      {/* Drop Zone */}
      <div
        ref={dropZoneRef}
        className={`files-container ${viewMode} ${
          isDraggingInternal ? "internal-drag" : ""
        }`}
        onClick={(e) => {
          if (
            e.target === e.currentTarget ||
            e.target.classList.contains("files-grid")
          ) {
            setSelectedFileIds(new Set());
          }
        }}
      >
        {loading ? (
          <div className="files-loading">
            <RefreshCw className="loading-spinner" />
            <p>Loading files...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="files-empty">
            <Folder className="empty-icon" />
            <h3>No files found</h3>
            <p>
              {searchTerm
                ? "No files match your search criteria."
                : canUpload()
                ? "Drag files here or click Upload to add files."
                : "This folder is empty."}
            </p>
          </div>
        ) : (
          <div
            className={`files-grid ${viewMode}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedFileIds(new Set());
              }
            }}
          >
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                data-file-id={file.id}
                className={`file-item ${
                  selectedFileIds.has(file.id) ? "file-item-selected" : ""
                } ${dragOverFolder === file.id ? "drag-over-folder" : ""} ${
                  movingFiles.has(file.id) ? "moving" : ""
                }`}
                draggable={canMove() && !renamingFile}
                onDragStart={(e) => {
                  // Prevent drag if file is being renamed
                  if (renamingFile && renamingFile.id === file.id) {
                    e.preventDefault();
                    return;
                  }
                  handleDragStart(e, file);
                }}
                onDragOver={(e) => handleDragOver(e, file)}
                onDragLeave={(e) => handleDragLeave(e, file)}
                onDrop={(e) => handleDrop(e, file)}
                onDragEnd={handleDragEnd}
                onClick={(e) => {
                  // Prevent click when dragging
                  if (draggedFile) {
                    e.preventDefault();
                    return;
                  }

                  if (file.type === "folder" && e.detail === 2) {
                    handleFolderClick(file.name);
                  } else {
                    handleFileSelect(file, e);
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                {viewMode === "grid" ? (
                  <>
                    <div className="file-header">
                      <div className="file-header-icon">
                        {getFileTypeIcon(file)}
                      </div>
                      <div className="file-header-name">
                        {renamingFile?.id === file.id ? (
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={handleRename}
                            onKeyPress={(e) =>
                              e.key === "Enter" && handleRename()
                            }
                            className="rename-input"
                            autoFocus
                          />
                        ) : (
                          file.name
                        )}
                      </div>
                    </div>

                    <div className="file-preview-area">
                      {file.contentType &&
                      file.contentType.startsWith("image/") ? (
                        <img
                          src={file.downloadURL}
                          alt={file.name}
                          className="file-thumbnail"
                        />
                      ) : (
                        getFileTypeIcon(file)
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="file-preview-area">
                      {file.contentType &&
                      file.contentType.startsWith("image/") ? (
                        <img
                          src={file.downloadURL}
                          alt={file.name}
                          className="file-thumbnail"
                        />
                      ) : (
                        getFileTypeIcon(file)
                      )}
                    </div>

                    <div className="file-info-list">
                      {renamingFile?.id === file.id ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={handleRename}
                          onKeyPress={(e) =>
                            e.key === "Enter" && handleRename()
                          }
                          className="rename-input"
                          autoFocus
                        />
                      ) : (
                        <div className="file-name-list">{file.name}</div>
                      )}
                      <div className="file-meta-list">
                        <span className="file-size">{file.size}</span>
                        <span className="file-date">{file.modifiedDate}</span>
                      </div>
                    </div>
                  </>
                )}

                <button
                  className="file-menu-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, file);
                  }}
                >
                  <MoreVertical style={{ width: "16px", height: "16px" }} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="drop-zone-overlay">
          <div className="drop-zone-content">
            <Upload style={{ width: "48px", height: "48px" }} />
            <h3>Drop files here to upload</h3>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              handlePreviewFile(contextMenu.file);
              setContextMenu(null);
            }}
          >
            <Eye style={{ width: "16px", height: "16px" }} />
            Preview
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              handleDownloadFile(contextMenu.file);
              setContextMenu(null);
            }}
          >
            <Download style={{ width: "16px", height: "16px" }} />
            Download
          </button>
          {canRename() && (
            <button
              className="context-menu-item"
              onClick={() => {
                setRenamingFile(contextMenu.file);
                setRenameValue(contextMenu.file.name);
                setContextMenu(null);
              }}
            >
              <Edit2 style={{ width: "16px", height: "16px" }} />
              Rename
            </button>
          )}
          {contextMenu.file.type === "file" && (
            <button
              className="context-menu-item"
              onClick={() => {
                handleShowVersionHistory(contextMenu.file);
                setContextMenu(null);
              }}
            >
              <History style={{ width: "16px", height: "16px" }} />
              Version History
            </button>
          )}
          {canDelete() && (
            <button
              className="context-menu-item danger"
              onClick={() => {
                handleDelete(contextMenu.file);
                setContextMenu(null);
              }}
            >
              <Trash2 style={{ width: "16px", height: "16px" }} />
              Delete
            </button>
          )}
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowNewFolderModal(false)}
        >
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-container modal-info-icon">
                <FolderPlus style={{ width: "24px", height: "24px" }} />
              </div>
              <h2 className="modal-title">Create New Folder</h2>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleCreateFolder()}
                className="folder-name-input"
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="modal-button modal-button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="modal-button modal-button-primary"
                disabled={!newFolderName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        style={{ display: "none" }}
      />
    </div>
  );
};

export default FilesView;
