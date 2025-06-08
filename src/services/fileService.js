import { db, storage } from "./firebase";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  getMetadata,
} from "firebase/storage";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

// File metadata structure in Firestore
const createFileDocument = (fileData) => ({
  name: fileData.name,
  originalName: fileData.originalName || fileData.name,
  type: fileData.type || "file", // 'file' or 'folder'
  size: fileData.size || 0,
  contentType: fileData.contentType || "",
  path: fileData.path || "", // Virtual path: "folder1/subfolder2"
  folder: fileData.folder || "school", // 'studio' or 'school'
  storageId: fileData.storageId || null, // Unique ID for storage location
  downloadURL: fileData.downloadURL || null,
  uploadedBy: fileData.uploadedBy || null,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  tags: fileData.tags || [],
  description: fileData.description || "",
  isDeleted: false,
});

// Action logging for audit trail
const logFileAction = async (schoolId, actionData) => {
  try {
    const actionDoc = {
      action: actionData.action,
      fileName: actionData.fileName,
      fileId: actionData.fileId,
      folder: actionData.folder,
      path: actionData.path,
      sourcePath: actionData.sourcePath,
      targetPath: actionData.targetPath,
      user: actionData.user
        ? {
            uid: actionData.user.uid,
            email: actionData.user.email,
            role: actionData.user.role || "unknown",
          }
        : null,
      metadata: actionData.metadata || {},
      timestamp: serverTimestamp(),
    };

    await addDoc(collection(db, "schools", schoolId, "fileActions"), actionDoc);
    console.log("File action logged:", actionData.action, actionData.fileName);
  } catch (error) {
    console.error("Error logging file action:", error);
    // Don't throw - logging failure shouldn't break main operation
  }
};

// Generate unique storage ID
const generateStorageId = () => {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Parse virtual path into array
const parsePath = (path) => {
  if (!path || path === "") return [];
  return path.split("/").filter((p) => p.trim() !== "");
};

// Build virtual path from array
const buildPath = (pathArray) => {
  if (!pathArray || pathArray.length === 0) return "";
  return pathArray.filter((p) => p.trim() !== "").join("/");
};

// Load files and folders from Firestore
export const loadFiles = async (schoolId, folder, path = "") => {
  try {
    console.log(`Loading files for ${schoolId}/${folder}/${path}`);

    const filesRef = collection(db, "schools", schoolId, "files");
    const q = query(
      filesRef,
      where("folder", "==", folder),
      where("path", "==", path),
      where("isDeleted", "==", false),
      orderBy("type", "desc"), // folders first
      orderBy("name", "asc")
    );

    const snapshot = await getDocs(q);
    const files = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      files.push({
        id: doc.id,
        name: data.name,
        type: data.type,
        size: data.type === "folder" ? "-" : formatFileSize(data.size),
        modifiedDate: data.updatedAt
          ? new Date(data.updatedAt.seconds * 1000).toLocaleDateString()
          : new Date().toLocaleDateString(),
        downloadURL: data.downloadURL,
        contentType: data.contentType,
        storageId: data.storageId,
        path: data.path,
        fullPath: data.path ? `${data.path}/${data.name}` : data.name,
        metadata: {
          uploadedBy: data.uploadedBy,
          createdAt: data.createdAt,
          tags: data.tags,
          description: data.description,
        },
      });
    });

    console.log(`Loaded ${files.length} files from database`);
    return files;
  } catch (error) {
    console.error("Error loading files from database:", error);
    throw new Error("Error loading files: " + error.message);
  }
};

// Upload a single file
export const uploadFile = async (
  schoolId,
  folder,
  path,
  file,
  user,
  onProgress = null
) => {
  try {
    console.log(`Uploading file: ${file.name} to ${path}`);

    // Generate unique storage ID
    const storageId = generateStorageId();
    const extension = file.name.split(".").pop();
    const storageFileName = extension ? `${storageId}.${extension}` : storageId;

    // Upload to flat storage structure
    const storagePath = `schools/${schoolId}/files/${storageFileName}`;
    const fileRef = ref(storage, storagePath);

    // Upload file
    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);

    if (onProgress) {
      onProgress(100);
    }

    // Create file document in Firestore
    const fileDoc = createFileDocument({
      name: file.name,
      type: "file",
      size: file.size,
      contentType: file.type,
      path: path,
      folder: folder,
      storageId: storageId,
      downloadURL: downloadURL,
      uploadedBy: user
        ? {
            uid: user.uid,
            email: user.email,
            role: user.role,
          }
        : null,
    });

    const docRef = await addDoc(
      collection(db, "schools", schoolId, "files"),
      fileDoc
    );

    // Log the upload action
    await logFileAction(schoolId, {
      action: "upload",
      fileName: file.name,
      fileId: docRef.id,
      folder: folder,
      path: path,
      user: user,
      metadata: {
        size: file.size,
        contentType: file.type,
        storageId: storageId,
      },
    });

    console.log(`Successfully uploaded ${file.name} with ID ${docRef.id}`);

    return {
      success: true,
      downloadURL: downloadURL,
      fileName: file.name,
      fileId: docRef.id,
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    throw new Error("Error uploading file: " + error.message);
  }
};

// Upload multiple files
export const uploadFiles = async (
  schoolId,
  folder,
  path,
  files,
  user,
  onProgress = null,
  shouldCancel = null
) => {
  const results = [];
  let completed = 0;

  for (const file of files) {
    // Check if upload should be cancelled
    if (shouldCancel && shouldCancel()) {
      console.log(
        `Upload cancelled at file ${completed + 1} of ${files.length}`
      );
      // Mark remaining files as cancelled
      for (let i = completed; i < files.length; i++) {
        results.push({
          success: false,
          cancelled: true,
          fileName: files[i].name,
          error: "Upload cancelled by user",
        });
      }
      break;
    }

    try {
      // Update progress with current file info
      if (onProgress) {
        onProgress({
          current: completed + 1,
          total: files.length,
          percentage: Math.round(((completed + 1) / files.length) * 100),
          fileName: file.name,
          status: "uploading",
        });
      }

      const result = await uploadFile(schoolId, folder, path, file, user);
      results.push({ ...result, fileName: file.name });
      completed++;

      // Update progress after completion
      if (onProgress) {
        onProgress({
          current: completed,
          total: files.length,
          percentage: Math.round((completed / files.length) * 100),
          fileName: file.name,
          status: completed === files.length ? "complete" : "completed",
        });
      }
    } catch (error) {
      results.push({
        success: false,
        fileName: file.name,
        error: error.message,
      });
      completed++;

      // Update progress even on error
      if (onProgress) {
        onProgress({
          current: completed,
          total: files.length,
          percentage: Math.round((completed / files.length) * 100),
          fileName: file.name,
          status: "error",
        });
      }
    }
  }

  return results;
};

// Create a new virtual folder
export const createFolder = async (
  schoolId,
  folder,
  path,
  folderName,
  user
) => {
  try {
    console.log(`Creating virtual folder: ${folderName} at ${path}`);

    // Create folder document in Firestore
    const folderDoc = createFileDocument({
      name: folderName,
      type: "folder",
      size: 0,
      path: path,
      folder: folder,
      uploadedBy: user
        ? {
            uid: user.uid,
            email: user.email,
            role: user.role,
          }
        : null,
    });

    const docRef = await addDoc(
      collection(db, "schools", schoolId, "files"),
      folderDoc
    );

    // Log the folder creation
    await logFileAction(schoolId, {
      action: "create_folder",
      fileName: folderName,
      fileId: docRef.id,
      folder: folder,
      path: path,
      user: user,
    });

    console.log(
      `Successfully created folder ${folderName} with ID ${docRef.id}`
    );
    return { success: true, folderId: docRef.id };
  } catch (error) {
    console.error("Error creating folder:", error);
    throw new Error("Error creating folder: " + error.message);
  }
};

// Rename a file or folder
export const renameFile = async (
  schoolId,
  fileId,
  newName,
  user,
  isFolder = false
) => {
  try {
    console.log(
      `Renaming ${isFolder ? "folder" : "file"} ${fileId} to ${newName}`
    );

    const fileRef = doc(db, "schools", schoolId, "files", fileId);
    const fileDoc = await getDoc(fileRef);

    if (!fileDoc.exists()) {
      throw new Error("File not found");
    }

    const fileData = fileDoc.data();
    const oldName = fileData.name;

    // Update file document
    await updateDoc(fileRef, {
      name: newName,
      updatedAt: serverTimestamp(),
    });

    // If it's a folder, update all children's paths
    if (isFolder) {
      await updateChildrenPaths(
        schoolId,
        fileData.folder,
        fileData.path,
        oldName,
        newName
      );
    }

    // Log the rename action
    await logFileAction(schoolId, {
      action: isFolder ? "rename_folder" : "rename_file",
      fileName: oldName,
      fileId: fileId,
      folder: fileData.folder,
      path: fileData.path,
      user: user,
      metadata: {
        newName: newName,
        oldName: oldName,
      },
    });

    console.log(`Successfully renamed ${oldName} to ${newName}`);
    return { success: true };
  } catch (error) {
    console.error("Error renaming file:", error);
    throw new Error("Error renaming file: " + error.message);
  }
};

// Helper function to update children paths when folder is renamed
const updateChildrenPaths = async (
  schoolId,
  folder,
  parentPath,
  oldFolderName,
  newFolderName
) => {
  try {
    const oldFullPath = parentPath
      ? `${parentPath}/${oldFolderName}`
      : oldFolderName;
    const newFullPath = parentPath
      ? `${parentPath}/${newFolderName}`
      : newFolderName;

    // Find all files that have paths starting with the old folder path
    const filesRef = collection(db, "schools", schoolId, "files");
    const q = query(
      filesRef,
      where("folder", "==", folder),
      where("isDeleted", "==", false)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.forEach((doc) => {
      const data = doc.data();
      const currentPath = data.path;

      // Check if this file/folder is inside the renamed folder
      if (
        currentPath === oldFullPath ||
        currentPath.startsWith(oldFullPath + "/")
      ) {
        const newPath = currentPath.replace(oldFullPath, newFullPath);
        batch.update(doc.ref, {
          path: newPath,
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
    console.log(`Updated children paths from ${oldFullPath} to ${newFullPath}`);
  } catch (error) {
    console.error("Error updating children paths:", error);
    throw error;
  }
};

// Delete a file or folder
export const deleteFile = async (schoolId, fileId, user, isFolder = false) => {
  try {
    console.log(`Deleting ${isFolder ? "folder" : "file"} ${fileId}`);

    const fileRef = doc(db, "schools", schoolId, "files", fileId);
    const fileDoc = await getDoc(fileRef);

    if (!fileDoc.exists()) {
      throw new Error("File not found");
    }

    const fileData = fileDoc.data();

    if (isFolder) {
      // Delete all children recursively
      await deleteChildrenRecursively(
        schoolId,
        fileData.folder,
        fileData.path,
        fileData.name,
        user
      );
    } else {
      // Create version before deleting file
      if (fileData.storageId) {
        await createFileVersion(schoolId, fileData, user);
      }

      // Delete from storage if it has a storage file
      if (fileData.downloadURL && fileData.storageId) {
        try {
          const extension = fileData.name.split(".").pop();
          const storageFileName = extension
            ? `${fileData.storageId}.${extension}`
            : fileData.storageId;
          const storageRef = ref(
            storage,
            `schools/${schoolId}/files/${storageFileName}`
          );
          await deleteObject(storageRef);
        } catch (storageError) {
          console.warn("Could not delete from storage:", storageError);
          // Continue with database deletion even if storage delete fails
        }
      }
    }

    // Mark as deleted in database (soft delete for audit trail)
    await updateDoc(fileRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: user
        ? {
            uid: user.uid,
            email: user.email,
            role: user.role,
          }
        : null,
    });

    // Log the delete action
    await logFileAction(schoolId, {
      action: isFolder ? "delete_folder" : "delete_file",
      fileName: fileData.name,
      fileId: fileId,
      folder: fileData.folder,
      path: fileData.path,
      user: user,
      metadata: {
        storageId: fileData.storageId,
        contentType: fileData.contentType,
      },
    });

    console.log(`Successfully deleted ${fileData.name}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting file:", error);
    throw new Error("Error deleting file: " + error.message);
  }
};

// Helper function to delete folder children recursively
const deleteChildrenRecursively = async (
  schoolId,
  folder,
  parentPath,
  folderName,
  user
) => {
  try {
    const targetPath = parentPath ? `${parentPath}/${folderName}` : folderName;

    // Find all children of this folder
    const filesRef = collection(db, "schools", schoolId, "files");
    const q = query(
      filesRef,
      where("folder", "==", folder),
      where("isDeleted", "==", false)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const currentPath = data.path;

      // Check if this is a child of the folder being deleted
      if (
        currentPath === targetPath ||
        currentPath.startsWith(targetPath + "/")
      ) {
        // Create version for files before deleting
        if (data.type === "file" && data.storageId) {
          await createFileVersion(schoolId, data, user);
        }

        // Delete from storage if it's a file
        if (data.type === "file" && data.downloadURL && data.storageId) {
          try {
            const extension = data.name.split(".").pop();
            const storageFileName = extension
              ? `${data.storageId}.${extension}`
              : data.storageId;
            const storageRef = ref(
              storage,
              `schools/${schoolId}/files/${storageFileName}`
            );
            await deleteObject(storageRef);
          } catch (storageError) {
            console.warn(
              `Could not delete storage file ${data.name}:`,
              storageError
            );
          }
        }

        // Mark as deleted in batch
        batch.update(doc.ref, {
          isDeleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: user
            ? {
                uid: user.uid,
                email: user.email,
                role: user.role,
              }
            : null,
        });

        // Log individual deletion
        await logFileAction(schoolId, {
          action: data.type === "folder" ? "delete_folder" : "delete_file",
          fileName: data.name,
          fileId: doc.id,
          folder: data.folder,
          path: data.path,
          user: user,
          metadata: {
            parentDeletion: true,
            storageId: data.storageId,
          },
        });
      }
    }

    await batch.commit();
    console.log(`Recursively deleted children of folder: ${targetPath}`);
  } catch (error) {
    console.error("Error deleting folder children:", error);
    throw error;
  }
};

// Move a file or folder
export const moveFile = async (
  schoolId,
  fileId,
  targetPath,
  user,
  isFolder = false
) => {
  try {
    console.log(
      `Moving ${isFolder ? "folder" : "file"} ${fileId} to ${targetPath}`
    );

    const fileRef = doc(db, "schools", schoolId, "files", fileId);
    const fileDoc = await getDoc(fileRef);

    if (!fileDoc.exists()) {
      throw new Error("File not found");
    }

    const fileData = fileDoc.data();
    const oldPath = fileData.path;
    const oldFullPath = oldPath ? `${oldPath}/${fileData.name}` : fileData.name;

    // Update the file's path
    await updateDoc(fileRef, {
      path: targetPath,
      updatedAt: serverTimestamp(),
    });

    // If it's a folder, update all children's paths
    if (isFolder) {
      const newFullPath = targetPath
        ? `${targetPath}/${fileData.name}`
        : fileData.name;
      await updateChildrenPathsForMove(
        schoolId,
        fileData.folder,
        oldFullPath,
        newFullPath
      );
    }

    // Log the move action
    await logFileAction(schoolId, {
      action: isFolder ? "move_folder" : "move_file",
      fileName: fileData.name,
      fileId: fileId,
      folder: fileData.folder,
      path: oldPath,
      sourcePath: oldPath,
      targetPath: targetPath,
      user: user,
    });

    console.log(
      `Successfully moved ${fileData.name} from ${oldPath} to ${targetPath}`
    );
    return { success: true };
  } catch (error) {
    console.error("Error moving file:", error);
    throw new Error("Error moving file: " + error.message);
  }
};

// Helper function to update children paths when folder is moved
const updateChildrenPathsForMove = async (
  schoolId,
  folder,
  oldFullPath,
  newFullPath
) => {
  try {
    // Find all files that have paths starting with the old folder path
    const filesRef = collection(db, "schools", schoolId, "files");
    const q = query(
      filesRef,
      where("folder", "==", folder),
      where("isDeleted", "==", false)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.forEach((doc) => {
      const data = doc.data();
      const currentPath = data.path;

      // Check if this file/folder is inside the moved folder
      if (currentPath.startsWith(oldFullPath + "/")) {
        const relativePath = currentPath.substring(oldFullPath.length + 1);
        const newPath = `${newFullPath}/${relativePath}`;
        batch.update(doc.ref, {
          path: newPath,
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
    console.log(`Updated children paths from ${oldFullPath} to ${newFullPath}`);
  } catch (error) {
    console.error("Error updating children paths for move:", error);
    throw error;
  }
};

// Create file version (backup before replace/delete)
export const createFileVersion = async (schoolId, fileData, user) => {
  try {
    if (!fileData.storageId || !fileData.downloadURL) {
      console.log("No storage file to version for:", fileData.name);
      return { success: false, error: "No storage file to version" };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const versionDoc = {
      originalFileId: fileData.id || "unknown",
      originalName: fileData.name,
      originalStorageId: fileData.storageId,
      originalPath: fileData.path,
      versionTimestamp: timestamp,
      downloadURL: fileData.downloadURL,
      size: fileData.size,
      contentType: fileData.contentType,
      createdBy: user
        ? {
            uid: user.uid,
            email: user.email,
            role: user.role,
          }
        : null,
      createdAt: serverTimestamp(),
    };

    await addDoc(
      collection(db, "schools", schoolId, "fileVersions"),
      versionDoc
    );

    // Log version creation
    await logFileAction(schoolId, {
      action: "create_version",
      fileName: fileData.name,
      fileId: fileData.id,
      folder: fileData.folder,
      path: fileData.path,
      user: user,
      metadata: {
        versionTimestamp: timestamp,
        storageId: fileData.storageId,
      },
    });

    console.log(`Created version for ${fileData.name}`);
    return { success: true, versionTimestamp: timestamp };
  } catch (error) {
    console.error("Error creating file version:", error);
    return { success: false, error: error.message };
  }
};

// Get file versions
export const getFileVersions = async (schoolId, fileId) => {
  try {
    console.log(`Getting versions for file: ${fileId}`);

    const versionsRef = collection(db, "schools", schoolId, "fileVersions");
    const q = query(
      versionsRef,
      where("originalFileId", "==", fileId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    const versions = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      versions.push({
        id: doc.id,
        name: `${data.versionTimestamp}_${data.originalName}`,
        originalName: data.originalName,
        url: data.downloadURL,
        uploadDate: data.createdAt
          ? new Date(data.createdAt.seconds * 1000)
          : new Date(),
        size: formatFileSize(data.size || 0),
        versionTimestamp: data.versionTimestamp,
        createdBy: data.createdBy,
      });
    });

    console.log(`Found ${versions.length} versions`);
    return versions;
  } catch (error) {
    console.error("Error getting file versions:", error);
    return [];
  }
};

// Restore file from version
export const restoreFileVersion = async (schoolId, fileId, versionId, user) => {
  try {
    console.log(`Restoring file ${fileId} to version ${versionId}`);

    // Get current file
    const fileRef = doc(db, "schools", schoolId, "files", fileId);
    const fileDoc = await getDoc(fileRef);

    if (!fileDoc.exists()) {
      throw new Error("File not found");
    }

    // Get version
    const versionRef = doc(db, "schools", schoolId, "fileVersions", versionId);
    const versionDoc = await getDoc(versionRef);

    if (!versionDoc.exists()) {
      throw new Error("Version not found");
    }

    const fileData = fileDoc.data();
    const versionData = versionDoc.data();

    // Create version of current file first
    await createFileVersion(schoolId, fileData, user);

    // Update file with version data
    await updateDoc(fileRef, {
      downloadURL: versionData.downloadURL,
      size: versionData.size,
      contentType: versionData.contentType,
      updatedAt: serverTimestamp(),
    });

    // Log the restore action
    await logFileAction(schoolId, {
      action: "restore_version",
      fileName: fileData.name,
      fileId: fileId,
      folder: fileData.folder,
      path: fileData.path,
      user: user,
      metadata: {
        restoredFromVersion: versionData.versionTimestamp,
        versionId: versionId,
      },
    });

    console.log(
      `Successfully restored ${fileData.name} to version ${versionData.versionTimestamp}`
    );
    return { success: true };
  } catch (error) {
    console.error("Error restoring file version:", error);
    throw new Error("Error restoring file version: " + error.message);
  }
};

// Search files
export const searchFiles = async (schoolId, searchQuery, folder = null) => {
  try {
    console.log(
      `Searching files: "${searchQuery}" in ${folder || "all folders"}`
    );

    const filesRef = collection(db, "schools", schoolId, "files");
    let q = query(
      filesRef,
      where("isDeleted", "==", false),
      orderBy("name", "asc")
    );

    if (folder) {
      q = query(
        filesRef,
        where("folder", "==", folder),
        where("isDeleted", "==", false),
        orderBy("name", "asc")
      );
    }

    const snapshot = await getDocs(q);
    const allFiles = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      allFiles.push({
        id: doc.id,
        name: data.name,
        type: data.type,
        size: data.type === "folder" ? "-" : formatFileSize(data.size),
        modifiedDate: data.updatedAt
          ? new Date(data.updatedAt.seconds * 1000).toLocaleDateString()
          : new Date().toLocaleDateString(),
        downloadURL: data.downloadURL,
        contentType: data.contentType,
        path: data.path,
        fullPath: data.path ? `${data.path}/${data.name}` : data.name,
        metadata: data,
      });
    });

    // Filter by search query (client-side for now, could be improved with full-text search)
    const searchLower = searchQuery.toLowerCase();
    const filteredFiles = allFiles.filter(
      (file) =>
        file.name.toLowerCase().includes(searchLower) ||
        file.fullPath.toLowerCase().includes(searchLower) ||
        (file.metadata.description &&
          file.metadata.description.toLowerCase().includes(searchLower)) ||
        (file.metadata.tags &&
          file.metadata.tags.some((tag) =>
            tag.toLowerCase().includes(searchLower)
          ))
    );

    console.log(`Search found ${filteredFiles.length} files`);
    return filteredFiles;
  } catch (error) {
    console.error("Error searching files:", error);
    throw new Error("Error searching files: " + error.message);
  }
};

// Get file analytics
export const getFileAnalytics = async (schoolId, folder = null) => {
  try {
    console.log(`Getting analytics for ${schoolId}/${folder || "all"}`);

    const filesRef = collection(db, "schools", schoolId, "files");
    let q = query(filesRef, where("isDeleted", "==", false));

    if (folder) {
      q = query(
        filesRef,
        where("folder", "==", folder),
        where("isDeleted", "==", false)
      );
    }

    const snapshot = await getDocs(q);

    let totalSize = 0;
    let fileCount = 0;
    let folderCount = 0;
    const contentTypes = {};
    const uploaders = {};

    snapshot.forEach((doc) => {
      const data = doc.data();

      if (data.type === "folder") {
        folderCount++;
      } else {
        fileCount++;
        totalSize += data.size || 0;

        // Count content types
        const contentType = data.contentType || "unknown";
        contentTypes[contentType] = (contentTypes[contentType] || 0) + 1;

        // Count uploaders
        if (data.uploadedBy && data.uploadedBy.email) {
          const uploader = data.uploadedBy.email;
          uploaders[uploader] = (uploaders[uploader] || 0) + 1;
        }
      }
    });

    return {
      totalFiles: fileCount,
      totalFolders: folderCount,
      totalSize: totalSize,
      totalSizeFormatted: formatFileSize(totalSize),
      contentTypes: contentTypes,
      uploaders: uploaders,
    };
  } catch (error) {
    console.error("Error getting file analytics:", error);
    throw new Error("Error getting file analytics: " + error.message);
  }
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  if (!bytes) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Export additional functions that might be needed
export {
  logFileAction,
  createFileDocument,
  generateStorageId,
  parsePath,
  buildPath,
};
