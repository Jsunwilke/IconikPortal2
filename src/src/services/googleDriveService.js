// Google Drive API service
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// All Google Drive operations go through Firebase Functions for security
// The service account credentials are stored securely on the server

// Load files and folders from Google Drive
export const loadGoogleDriveFiles = async (schoolId, folder, path = "") => {
  try {
    console.log(
      `[Google Drive API] Loading files for ${schoolId}/${folder}/${path}`
    );

    const loadGoogleDriveFilesFunction = httpsCallable(
      functions,
      "loadGoogleDriveFiles"
    );
    const result = await loadGoogleDriveFilesFunction({
      schoolId,
      folder,
      path,
    });

    console.log("[Google Drive API] Successfully loaded files:", result.data);
    return result.data.files || [];
  } catch (error) {
    console.error("Error loading Google Drive files:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    console.error("Error details:", error.details);

    // If function is not found, show helpful error
    if (error.code === "functions/not-found") {
      throw new Error(
        "Google Drive function not found. Make sure functions are deployed correctly."
      );
    }

    throw new Error("Error loading Google Drive files: " + error.message);
  }
};

// Upload files to Google Drive
export const uploadGoogleDriveFiles = async (
  schoolId,
  folder,
  path,
  files,
  user,
  onProgress = null
) => {
  try {
    console.log(`[Google Drive API] Uploading ${files.length} files`);

    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        // Convert file to base64 for transfer to Firebase Function
        const fileData = await fileToBase64(file);

        const uploadGoogleDriveFileFunction = httpsCallable(
          functions,
          "uploadGoogleDriveFile"
        );
        const result = await uploadGoogleDriveFileFunction({
          schoolId,
          folder,
          path,
          fileName: file.name,
          fileData: fileData,
          mimeType: file.type,
          user: {
            uid: user.uid,
            email: user.email,
            role: user.role,
          },
        });

        if (onProgress) {
          onProgress(Math.round(((i + 1) / files.length) * 100));
        }

        console.log(
          `[Google Drive API] Upload result for ${file.name}:`,
          result.data
        );

        results.push({
          success: result.data.success,
          fileName: file.name,
          fileId: result.data.fileId,
          error: result.data.error,
        });
      } catch (fileError) {
        console.error(
          `[Google Drive API] Error uploading ${file.name}:`,
          fileError
        );

        // Handle specific Firebase Function errors
        let errorMessage = fileError.message;
        if (fileError.code === "functions/not-found") {
          errorMessage =
            "Google Drive upload function not found. Please ensure Firebase Functions are deployed.";
        } else if (fileError.code === "functions/unauthenticated") {
          errorMessage =
            "Authentication failed. Please check your permissions.";
        } else if (fileError.code === "functions/permission-denied") {
          errorMessage =
            "Permission denied. You may not have access to upload to Google Drive.";
        }

        results.push({
          success: false,
          fileName: file.name,
          error: errorMessage,
        });

        if (onProgress) {
          onProgress(Math.round(((i + 1) / files.length) * 100));
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Error uploading to Google Drive:", error);
    throw new Error("Error uploading to Google Drive: " + error.message);
  }
};

// Create a folder in Google Drive
export const createGoogleDriveFolder = async (
  schoolId,
  folder,
  path,
  folderName,
  user
) => {
  try {
    console.log(`[Google Drive API] Creating folder: ${folderName}`);

    const createGoogleDriveFolderFunction = httpsCallable(
      functions,
      "createGoogleDriveFolder"
    );
    const result = await createGoogleDriveFolderFunction({
      schoolId,
      folder,
      path,
      folderName,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Folder creation result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error creating Google Drive folder:", error);
    throw new Error("Error creating Google Drive folder: " + error.message);
  }
};

// Rename a file or folder in Google Drive
export const renameGoogleDriveFile = async (
  schoolId,
  folder,
  fileId,
  newName,
  user,
  isFolder = false
) => {
  try {
    console.log(
      `[Google Drive API] Renaming ${
        isFolder ? "folder" : "file"
      }: ${fileId} to ${newName}`
    );

    const renameGoogleDriveFileFunction = httpsCallable(
      functions,
      "renameGoogleDriveFile"
    );
    const result = await renameGoogleDriveFileFunction({
      schoolId,
      folder,
      fileId,
      newName,
      isFolder,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Rename result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error renaming Google Drive file:", error);
    throw new Error("Error renaming Google Drive file: " + error.message);
  }
};

// Delete a file or folder in Google Drive
export const deleteGoogleDriveFile = async (
  schoolId,
  folder,
  fileId,
  user,
  isFolder = false
) => {
  try {
    console.log(
      `[Google Drive API] Deleting ${isFolder ? "folder" : "file"}: ${fileId}`
    );

    const deleteGoogleDriveFileFunction = httpsCallable(
      functions,
      "deleteGoogleDriveFile"
    );
    const result = await deleteGoogleDriveFileFunction({
      schoolId,
      folder,
      fileId,
      isFolder,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Delete result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error deleting Google Drive file:", error);
    throw new Error("Error deleting Google Drive file: " + error.message);
  }
};

// Move a file or folder in Google Drive
export const moveGoogleDriveFile = async (
  schoolId,
  folder,
  fileId,
  targetFolderId,
  user,
  isFolder = false
) => {
  try {
    console.log(
      `[Google Drive API] Moving ${
        isFolder ? "folder" : "file"
      }: ${fileId} to ${targetFolderId}`
    );

    const moveGoogleDriveFileFunction = httpsCallable(
      functions,
      "moveGoogleDriveFile"
    );
    const result = await moveGoogleDriveFileFunction({
      schoolId,
      folder,
      fileId,
      targetFolderId,
      isFolder,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Move result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error moving Google Drive file:", error);
    throw new Error("Error moving Google Drive file: " + error.message);
  }
};

// NEW: Move a file or folder to parent directory in Google Drive
export const moveGoogleDriveFileToParent = async (
  schoolId,
  folder,
  fileId,
  currentPath,
  user,
  isFolder = false
) => {
  try {
    console.log(
      `[Google Drive API] Moving ${
        isFolder ? "folder" : "file"
      } ${fileId} to parent directory from path: ${currentPath}`
    );

    const moveGoogleDriveFileToParentFunction = httpsCallable(
      functions,
      "moveGoogleDriveFileToParent"
    );
    const result = await moveGoogleDriveFileToParentFunction({
      schoolId,
      folder,
      fileId,
      currentPath,
      isFolder,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Move to parent result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error moving Google Drive file to parent:", error);
    throw new Error(
      "Error moving Google Drive file to parent: " + error.message
    );
  }
};

// NEW: Get parent folder information for Google Drive navigation
export const getGoogleDriveParentInfo = async (
  schoolId,
  folder,
  currentPath
) => {
  try {
    console.log(
      `[Google Drive API] Getting parent info for path: ${currentPath}`
    );

    const getGoogleDriveParentInfoFunction = httpsCallable(
      functions,
      "getGoogleDriveParentInfo"
    );
    const result = await getGoogleDriveParentInfoFunction({
      schoolId,
      folder,
      currentPath,
    });

    console.log(`[Google Drive API] Parent info result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error getting Google Drive parent info:", error);
    throw new Error("Error getting Google Drive parent info: " + error.message);
  }
};

// ===== VERSION HISTORY & RECOVERY =====

// Get file versions/revisions from Google Drive
export const getGoogleDriveFileVersions = async (fileId, user) => {
  try {
    console.log(`[Google Drive API] Getting versions for file: ${fileId}`);

    const getGoogleDriveFileVersionsFunction = httpsCallable(
      functions,
      "getGoogleDriveFileVersions"
    );
    const result = await getGoogleDriveFileVersionsFunction({
      fileId,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] File versions result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error getting Google Drive file versions:", error);
    throw new Error("Error getting file versions: " + error.message);
  }
};

// Restore a previous version of a Google Drive file
export const restoreGoogleDriveFileVersion = async (
  fileId,
  revisionId,
  user
) => {
  try {
    console.log(
      `[Google Drive API] Restoring file ${fileId} to revision ${revisionId}`
    );

    const restoreGoogleDriveFileVersionFunction = httpsCallable(
      functions,
      "restoreGoogleDriveFileVersion"
    );
    const result = await restoreGoogleDriveFileVersionFunction({
      fileId,
      revisionId,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Restore version result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error restoring Google Drive file version:", error);
    throw new Error("Error restoring file version: " + error.message);
  }
};

// ===== BATCH OPERATIONS =====

// Delete multiple Google Drive files at once
export const batchDeleteGoogleDriveFiles = async (fileIds, user) => {
  try {
    console.log(`[Google Drive API] Batch deleting ${fileIds.length} files`);

    const batchDeleteGoogleDriveFilesFunction = httpsCallable(
      functions,
      "batchDeleteGoogleDriveFiles"
    );
    const result = await batchDeleteGoogleDriveFilesFunction({
      fileIds,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Batch delete result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error batch deleting Google Drive files:", error);
    throw new Error("Error batch deleting files: " + error.message);
  }
};

// Move multiple Google Drive files at once
export const batchMoveGoogleDriveFiles = async (
  fileIds,
  targetFolderId,
  user
) => {
  try {
    console.log(
      `[Google Drive API] Batch moving ${fileIds.length} files to ${targetFolderId}`
    );

    const batchMoveGoogleDriveFilesFunction = httpsCallable(
      functions,
      "batchMoveGoogleDriveFiles"
    );
    const result = await batchMoveGoogleDriveFilesFunction({
      fileIds,
      targetFolderId,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Batch move result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error batch moving Google Drive files:", error);
    throw new Error("Error batch moving files: " + error.message);
  }
};

// Download multiple Google Drive files as ZIP
export const downloadGoogleDriveFilesAsZip = async (fileIds, zipName, user) => {
  try {
    console.log(`[Google Drive API] Creating ZIP of ${fileIds.length} files`);

    const downloadGoogleDriveFilesAsZipFunction = httpsCallable(
      functions,
      "downloadGoogleDriveFilesAsZip"
    );
    const result = await downloadGoogleDriveFilesAsZipFunction({
      fileIds,
      zipName,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] ZIP creation result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error creating Google Drive ZIP:", error);
    throw new Error("Error creating ZIP: " + error.message);
  }
};

// ===== ADVANCED FILE OPERATIONS =====

// Copy Google Drive files/folders
export const copyGoogleDriveFile = async (
  fileId,
  newName,
  targetFolderId,
  user
) => {
  try {
    console.log(
      `[Google Drive API] Copying file ${fileId} to ${targetFolderId}`
    );

    const copyGoogleDriveFileFunction = httpsCallable(
      functions,
      "copyGoogleDriveFile"
    );
    const result = await copyGoogleDriveFileFunction({
      fileId,
      newName,
      targetFolderId,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Copy result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error copying Google Drive file:", error);
    throw new Error("Error copying file: " + error.message);
  }
};

// Get detailed Google Drive file metadata
export const getGoogleDriveFileDetails = async (fileId, user) => {
  try {
    console.log(`[Google Drive API] Getting details for file: ${fileId}`);

    const getGoogleDriveFileDetailsFunction = httpsCallable(
      functions,
      "getGoogleDriveFileDetails"
    );
    const result = await getGoogleDriveFileDetailsFunction({
      fileId,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] File details result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error getting Google Drive file details:", error);
    throw new Error("Error getting file details: " + error.message);
  }
};

// Search within Google Drive
export const searchGoogleDriveFiles = async (
  schoolId,
  folder,
  searchQuery,
  mimeType,
  user
) => {
  try {
    console.log(`[Google Drive API] Searching: "${searchQuery}"`);

    const searchGoogleDriveFilesFunction = httpsCallable(
      functions,
      "searchGoogleDriveFiles"
    );
    const result = await searchGoogleDriveFilesFunction({
      schoolId,
      folder,
      searchQuery,
      mimeType,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Search result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error searching Google Drive files:", error);
    throw new Error("Error searching files: " + error.message);
  }
};

// ===== PERMISSION MANAGEMENT =====

// Share Google Drive file with specific users
export const shareGoogleDriveFile = async (
  fileId,
  email,
  role,
  sendNotification,
  user
) => {
  try {
    console.log(`[Google Drive API] Sharing file ${fileId} with ${email}`);

    const shareGoogleDriveFileFunction = httpsCallable(
      functions,
      "shareGoogleDriveFile"
    );
    const result = await shareGoogleDriveFileFunction({
      fileId,
      email,
      role,
      sendNotification,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Share result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error sharing Google Drive file:", error);
    throw new Error("Error sharing file: " + error.message);
  }
};

// Get Google Drive file permissions
export const getGoogleDriveFilePermissions = async (fileId, user) => {
  try {
    console.log(`[Google Drive API] Getting permissions for file: ${fileId}`);

    const getGoogleDriveFilePermissionsFunction = httpsCallable(
      functions,
      "getGoogleDriveFilePermissions"
    );
    const result = await getGoogleDriveFilePermissionsFunction({
      fileId,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Permissions result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error getting Google Drive file permissions:", error);
    throw new Error("Error getting file permissions: " + error.message);
  }
};

// Remove Google Drive file sharing
export const unshareGoogleDriveFile = async (fileId, permissionId, user) => {
  try {
    console.log(
      `[Google Drive API] Removing permission ${permissionId} from file ${fileId}`
    );

    const unshareGoogleDriveFileFunction = httpsCallable(
      functions,
      "unshareGoogleDriveFile"
    );
    const result = await unshareGoogleDriveFileFunction({
      fileId,
      permissionId,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Unshare result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error unsharing Google Drive file:", error);
    throw new Error("Error unsharing file: " + error.message);
  }
};

// ===== DIRECT DOWNLOAD SUPPORT =====

// Generate direct download links for Google Drive files
export const getGoogleDriveDownloadLink = async (fileId, user) => {
  try {
    console.log(
      `[Google Drive API] Generating download link for file: ${fileId}`
    );

    const getGoogleDriveDownloadLinkFunction = httpsCallable(
      functions,
      "getGoogleDriveDownloadLink"
    );
    const result = await getGoogleDriveDownloadLinkFunction({
      fileId,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Download link result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error getting Google Drive download link:", error);
    throw new Error("Error getting download link: " + error.message);
  }
};

// Stream Google Drive file content for preview
export const streamGoogleDriveFile = async (fileId, maxSize, user) => {
  try {
    console.log(`[Google Drive API] Streaming file for preview: ${fileId}`);

    const streamGoogleDriveFileFunction = httpsCallable(
      functions,
      "streamGoogleDriveFile"
    );
    const result = await streamGoogleDriveFileFunction({
      fileId,
      maxSize,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Stream result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error streaming Google Drive file:", error);
    throw new Error("Error streaming file: " + error.message);
  }
};

// ===== FOLDER MANAGEMENT =====

// Get Google Drive folder size and statistics
export const getGoogleDriveFolderStats = async (folderId, user) => {
  try {
    console.log(`[Google Drive API] Getting stats for folder: ${folderId}`);

    const getGoogleDriveFolderStatsFunction = httpsCallable(
      functions,
      "getGoogleDriveFolderStats"
    );
    const result = await getGoogleDriveFolderStatsFunction({
      folderId,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Folder stats result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error getting Google Drive folder stats:", error);
    throw new Error("Error getting folder stats: " + error.message);
  }
};

// Empty Google Drive trash / permanently delete
export const emptyGoogleDriveTrash = async (user) => {
  try {
    console.log(`[Google Drive API] Emptying Google Drive trash`);

    const emptyGoogleDriveTrashFunction = httpsCallable(
      functions,
      "emptyGoogleDriveTrash"
    );
    const result = await emptyGoogleDriveTrashFunction({
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });

    console.log(`[Google Drive API] Empty trash result:`, result.data);
    return result.data;
  } catch (error) {
    console.error("Error emptying Google Drive trash:", error);
    throw new Error("Error emptying trash: " + error.message);
  }
};

// Helper function to convert file to base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove the data:mime/type;base64, prefix
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};
