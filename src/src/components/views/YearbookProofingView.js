import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  MessageSquare,
  X,
  FileText,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MapPin,
  History,
  Save,
} from "lucide-react";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  getMetadata,
} from "firebase/storage";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { storage, db } from "../../services/firebase";
import "../../styles/YearbookProofingView.css";

const YearbookProofingView = ({ selectedSchool, userRole, user }) => {
  // Debug Firebase imports
  console.log("🔧 YearbookProofingView component loaded");
  console.log("Firebase storage imported:", !!storage);
  console.log("Firebase db imported:", !!db);
  console.log("Firebase ref function:", !!ref);
  console.log("Firebase uploadBytes function:", !!uploadBytes);

  // State management
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfPages, setPdfPages] = useState([]);
  const [currentSpread, setCurrentSpread] = useState(0);
  const [comments, setComments] = useState([]);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [newComment, setNewComment] = useState({
    x: 0,
    y: 0,
    text: "",
    page: 0,
  });
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [selectedComment, setSelectedComment] = useState(null);

  // Pan state for zoomed view
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // New state for versioning and storage
  const [currentVersion, setCurrentVersion] = useState(null);
  const [allVersions, setAllVersions] = useState([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingVersion, setLoadingVersion] = useState(false);

  // State for button positioning
  const [buttonPositions, setButtonPositions] = useState({ left: 0, right: 0 });

  // State for collapsible comments sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Refs
  const fileInputRef = useRef();
  const pdfContainerRef = useRef();
  const leftPageRef = useRef();
  const rightPageRef = useRef();

  // Update button positions when container changes
  useEffect(() => {
    const updateButtonPositions = () => {
      if (pdfContainerRef.current) {
        const containerRect = pdfContainerRef.current.getBoundingClientRect();
        const leftPos = containerRect.left + 20; // 20px inside left edge

        // For right button, position it just before the sidebar starts
        const isDesktop = window.innerWidth > 900; // Match CSS breakpoint
        let rightPos;

        if (isDesktop) {
          // On desktop, position right button well inside the PDF area
          const sidebarWidth = sidebarCollapsed ? 60 : 350;
          const gap = 24; // Gap between main content and sidebar (1.5rem = 24px)
          rightPos = sidebarWidth + gap + 60; // Increased from 20px to 60px for better positioning
        } else {
          // On mobile, sidebar is below, so use container edge
          rightPos = window.innerWidth - containerRect.right + 20;
        }

        setButtonPositions({ left: leftPos, right: rightPos });
      }
    };

    // Update positions on mount, window resize, and sidebar collapse state change
    updateButtonPositions();
    window.addEventListener("resize", updateButtonPositions);

    // Also update when PDF loads or sidebar state changes
    if (pdfFile) {
      setTimeout(updateButtonPositions, 100);
    }

    return () => window.removeEventListener("resize", updateButtonPositions);
  }, [pdfFile, sidebarCollapsed]); // Added sidebarCollapsed as dependency

  // Load existing yearbook data when component mounts
  useEffect(() => {
    if (selectedSchool) {
      loadYearbookData();
      testFirebaseConnection();
    }
  }, [selectedSchool]);

  // Track Ctrl key state for panning
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Control") {
        setIsCtrlPressed(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === "Control") {
        setIsCtrlPressed(false);
        // Stop panning if Ctrl is released
        if (isPanning) {
          setIsPanning(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isPanning]);

  // Test Firebase connection and permissions
  const testFirebaseConnection = async () => {
    try {
      console.log("🔍 Testing Firebase connection...");
      console.log("Selected School:", selectedSchool);
      console.log("User:", user?.email);
      console.log("Storage instance:", storage);
      console.log("Firestore instance:", db);

      // Check if Firebase imports worked
      if (!storage) {
        console.error("❌ Firebase Storage not imported properly!");
        return;
      }

      if (!db) {
        console.error("❌ Firebase Firestore not imported properly!");
        return;
      }

      // Test storage access
      const testStorageRef = ref(
        storage,
        `schools/${selectedSchool}/yearbooks/versions/`
      );
      console.log("Storage ref created:", testStorageRef);

      // Test Firestore access - FIXED: proper collection path with 5 segments
      try {
        const yearbookId = currentVersion?.id || "default_yearbook";
        const testFirestoreRef = collection(
          db,
          "schools",
          selectedSchool,
          "yearbooks",
          yearbookId,
          "comments"
        );
        console.log("Firestore ref created:", testFirestoreRef);
        console.log("✅ Firebase connection test passed");
      } catch (firestoreError) {
        console.error("❌ Firestore collection path error:", firestoreError);
        console.log("This might be why comments aren't working!");
      }
    } catch (error) {
      console.error("💥 Firebase connection test failed:", error);
      console.error("This might be why uploads aren't working!");
    }
  };

  // Load existing yearbook data
  const loadYearbookData = async () => {
    try {
      console.log("📂 Loading yearbook data for school:", selectedSchool);
      setLoading(true);

      if (!selectedSchool) {
        console.warn("No school selected, skipping data load");
        return;
      }

      const storageRef = ref(
        storage,
        `schools/${selectedSchool}/yearbooks/versions/`
      );
      console.log("📁 Storage ref:", storageRef);

      const listResult = await listAll(storageRef);
      console.log("📄 Found files:", listResult.items.length);

      if (listResult.items.length === 0) {
        console.log("No yearbook versions found");
        setAllVersions([]);
        setLoading(false);
        return;
      }

      const versions = [];
      for (const item of listResult.items) {
        try {
          const metadata = await getMetadata(item);
          const downloadURL = await getDownloadURL(item);

          const version = {
            id: item.name,
            name: metadata.customMetadata?.originalName || item.name,
            uploadDate: new Date(metadata.timeCreated),
            uploadedBy: metadata.customMetadata?.uploadedBy || "Unknown",
            size: metadata.size,
            downloadURL: downloadURL,
            path: item.fullPath,
          };

          versions.push(version);
        } catch (itemError) {
          console.error("Error loading version metadata:", itemError);
        }
      }

      // Sort by upload date (newest first)
      versions.sort((a, b) => b.uploadDate - a.uploadDate);
      setAllVersions(versions);

      // Load the most recent version automatically
      if (versions.length > 0) {
        console.log("🔄 Loading most recent version:", versions[0].name);
        await loadVersion(versions[0]);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading yearbook data:", error);
      setLoading(false);
      alert("Error loading yearbook data: " + error.message);
    }
  };

  // Load comments for a specific version
  const loadCommentsForVersion = async (versionId) => {
    try {
      console.log("💬 Loading comments for version:", versionId);

      if (!selectedSchool || !versionId) {
        console.warn("Missing school or version ID for comment loading");
        return;
      }

      const commentsRef = collection(
        db,
        "schools",
        selectedSchool,
        "yearbooks",
        versionId,
        "comments"
      );

      const q = query(commentsRef, orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);

      const loadedComments = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        loadedComments.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
          resolvedAt: data.resolvedAt?.toDate() || null,
        });
      });

      setComments(loadedComments);
      console.log(`✅ Loaded ${loadedComments.length} comments`);
    } catch (error) {
      console.error("Error loading comments:", error);
    }
  };

  // Handle file selection
  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log("📁 File selected:", file.name, file.size);

    if (file.type !== "application/pdf") {
      alert("Please select a PDF file");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert("File size too large. Please select a PDF under 50MB.");
      return;
    }

    try {
      setLoading(true);
      setUploadProgress("Uploading file...");

      // Upload to Firebase Storage
      console.log("☁️ Starting Firebase upload...");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `yearbook_${timestamp}.pdf`;

      const storageRef = ref(
        storage,
        `schools/${selectedSchool}/yearbooks/versions/${fileName}`
      );

      console.log("📤 Uploading to:", storageRef.fullPath);

      const uploadResult = await uploadBytes(storageRef, file, {
        customMetadata: {
          originalName: file.name,
          uploadedBy: user?.email || "Anonymous",
          uploadTimestamp: new Date().toISOString(),
        },
      });

      console.log("🔗 Getting download URL...");
      const downloadURL = await getDownloadURL(uploadResult.ref);
      console.log("✅ Download URL obtained!");

      // Create version record
      const newVersion = {
        id: fileName,
        name: file.name,
        uploadDate: new Date(),
        uploadedBy: user?.email || "Anonymous",
        size: file.size,
        downloadURL: downloadURL,
        path: uploadResult.ref.fullPath,
      };

      // Update state
      setAllVersions((prev) => [newVersion, ...prev]);
      setCurrentVersion(newVersion);

      console.log("✅ UPLOAD SUCCESSFUL! Now processing for display...");

      // INLINE PDF PROCESSING - avoid function reference issues
      setUploadProgress("Processing PDF for viewing...");

      let pdfjsLib;

      try {
        console.log("📄 Loading PDF.js...");
        pdfjsLib = await import("pdfjs-dist");

        if (pdfjsLib.GlobalWorkerOptions) {
          // Check environment for worker source
          const isProduction =
            !window.location.hostname.includes("csb.app") &&
            !window.location.hostname.includes("codesandbox.io") &&
            !window.location.hostname.includes("localhost");

          if (isProduction) {
            // Use local worker for production
            pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          } else {
            // Use CDN worker for development
            pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          }
        }

        console.log("✅ PDF.js loaded");
      } catch (npmError) {
        console.log("NPM failed, trying CDN...");

        // Load from CDN
        if (!window.pdfjsLib) {
          const script = document.createElement("script");
          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          document.head.appendChild(script);

          await new Promise((resolve, reject) => {
            script.onload = () => {
              if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
                resolve();
              } else {
                reject(new Error("PDF.js failed to load"));
              }
            };
            script.onerror = reject;
          });
        }
        pdfjsLib = window.pdfjsLib;
      }

      if (!pdfjsLib || !pdfjsLib.getDocument) {
        throw new Error("PDF.js could not be loaded");
      }

      console.log("📖 Loading PDF document...");
      const arrayBuffer = await file.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0,
        disableAutoFetch: true,
        disableStream: true,
      });

      const pdf = await loadingTask.promise;
      console.log("📄 PDF loaded, pages:", pdf.numPages);

      const pages = [];
      const totalPages = pdf.numPages;
      const maxPages = Math.min(totalPages, 25);

      for (let i = 1; i <= maxPages; i++) {
        setUploadProgress(`Processing page ${i} of ${maxPages}...`);

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.3 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

        pages.push({
          pageNumber: i,
          canvas: canvas,
          dataUrl: dataUrl,
          width: viewport.width,
          height: viewport.height,
        });

        if (page.cleanup) {
          page.cleanup();
        }

        console.log(`✅ Page ${i} processed`);

        if (i % 3 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      console.log("🖼️ Setting PDF state...");
      setPdfFile(file);
      setPdfPages(pages);
      setCurrentSpread(0);
      setUploadProgress(null);
      setLoading(false);

      console.log("🎉 UPLOAD AND DISPLAY COMPLETE!");

      // Load comments for this version
      await loadCommentsForVersion(fileName);

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadProgress(null);
      setLoading(false);

      let message = "Upload failed";
      if (error.code === "storage/unauthorized") {
        message = "You don't have permission to upload files.";
      } else if (error.code === "storage/quota-exceeded") {
        message = "Storage quota exceeded.";
      } else if (error.message) {
        message = error.message;
      }

      alert("Upload error: " + message);
    }
  };

  // Load PDF from URL (for existing versions)
  const loadPdfFromUrl = async (url, filename) => {
    try {
      console.log("📥 Loading PDF from URL:", url);
      setUploadProgress("Loading PDF...");

      // Load PDF.js
      let pdfjsLib;
      try {
        pdfjsLib = await loadPdfJsFromCDN();
      } catch (error) {
        console.error("PDF.js loading error:", error);
        throw error;
      }

      console.log("📖 Fetching PDF from URL...");
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log("📄 PDF data received, size:", arrayBuffer.byteLength);

      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0,
        disableAutoFetch: true,
        disableStream: true,
      });

      const pdf = await loadingTask.promise;
      console.log("📄 PDF loaded, pages:", pdf.numPages);

      const pages = [];
      const totalPages = pdf.numPages;
      const maxPages = Math.min(totalPages, 25);

      for (let i = 1; i <= maxPages; i++) {
        try {
          setUploadProgress(`Processing page ${i} of ${maxPages}...`);

          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.3 });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

          pages.push({
            pageNumber: i,
            canvas: canvas,
            dataUrl: dataUrl,
            width: viewport.width,
            height: viewport.height,
          });

          console.log(`Page ${i} processed successfully`);

          // Small delay to keep CodeSandbox responsive
          if (i % 2 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } catch (pageError) {
          console.error(`Error processing page ${i}:`, pageError);

          // Add placeholder for failed pages
          const errorCanvas = document.createElement("canvas");
          const errorCtx = errorCanvas.getContext("2d");
          errorCanvas.width = 450;
          errorCanvas.height = 600;

          // Draw error placeholder
          errorCtx.fillStyle = "#f8f9fa";
          errorCtx.fillRect(0, 0, 450, 600);
          errorCtx.strokeStyle = "#dee2e6";
          errorCtx.strokeRect(0, 0, 450, 600);

          errorCtx.fillStyle = "#dc3545";
          errorCtx.font = "14px Arial";
          errorCtx.textAlign = "center";
          errorCtx.fillText(`Error loading page ${i}`, 225, 290);
          errorCtx.fillText("See console for details", 225, 310);

          pages.push({
            pageNumber: i,
            canvas: errorCanvas,
            dataUrl: errorCanvas.toDataURL(),
            width: 450,
            height: 600,
            error: pageError.message,
          });
        }
      }

      setPdfFile({ name: filename });
      setPdfPages(pages);
      setCurrentSpread(0);
      setComments([]);
      setUploadProgress(null);
      setLoading(false);

      console.log("PDF processing complete:", pages.length, "pages loaded");
    } catch (error) {
      console.error("PDF processing failed:", error);
      setUploadProgress(null);
      setLoading(false);

      let message = "PDF processing failed";
      if (error.message.includes("CDN")) {
        message =
          "Could not load PDF.js library. Check your internet connection.";
      } else if (error.message.includes("Invalid PDF")) {
        message = "Invalid PDF file. Please try a different file.";
      } else {
        message = `PDF error: ${error.message}`;
      }

      alert(message);
    }
  };

  // Load PDF.js from CDN (avoiding npm babel issues)
  const loadPdfJsFromCDN = () => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.pdfjsLib) {
        console.log("PDF.js already loaded from previous attempt");
        resolve(window.pdfjsLib);
        return;
      }

      console.log("Loading PDF.js from CDN...");

      // Create script element
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";

      script.onload = () => {
        console.log("PDF.js script loaded");

        // Wait a moment for initialization
        setTimeout(() => {
          if (window.pdfjsLib && window.pdfjsLib.getDocument) {
            // Set worker source
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

            console.log("PDF.js initialized successfully with worker");
            resolve(window.pdfjsLib);
          } else {
            console.error("PDF.js loaded but not properly initialized");
            reject(new Error("PDF.js initialization failed"));
          }
        }, 100);
      };

      script.onerror = (error) => {
        console.error("Failed to load PDF.js script:", error);
        reject(new Error("Failed to load PDF.js from CDN"));
      };

      // Add to document
      document.head.appendChild(script);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!window.pdfjsLib) {
          reject(new Error("PDF.js loading timeout"));
        }
      }, 10000);
    });
  };

  // Navigate to the page containing a comment
  const navigateToCommentPage = (comment) => {
    const pageNumber = comment.page;

    // Calculate which spread contains this page
    let targetSpread;
    if (pageNumber === 1) {
      targetSpread = 0; // First spread (inside cover + page 1)
    } else {
      // For pages 2 and up, calculate the spread
      targetSpread = Math.floor(pageNumber / 2);
    }

    // Navigate to the spread
    setCurrentSpread(targetSpread);
  };

  // Navigation
  const totalSpreads = Math.ceil((pdfPages.length + 1) / 2); // +1 for blank inside cover

  const goToPreviousSpread = () => {
    setCurrentSpread(Math.max(0, currentSpread - 1));
  };

  const goToNextSpread = () => {
    setCurrentSpread(Math.min(totalSpreads - 1, currentSpread + 1));
  };

  // Get pages for current spread
  const getCurrentSpreadPages = () => {
    if (currentSpread === 0) {
      // First spread: blank cover on left, page 1 on right
      return {
        left: null, // blank inside cover
        right: pdfPages[0] || null,
        leftPageNumber: "Inside Cover",
        rightPageNumber: 1,
      };
    }

    // Calculate page indices for this spread
    const leftPageIndex = currentSpread * 2 - 1; // -1 because first spread uses page 0
    const rightPageIndex = currentSpread * 2;

    return {
      left: pdfPages[leftPageIndex] || null,
      right: pdfPages[rightPageIndex] || null,
      leftPageNumber: leftPageIndex + 1,
      rightPageNumber: rightPageIndex + 1,
    };
  };

  // Comment handling
  const handlePageClick = (event, isRightPage) => {
    // Don't create comment if Ctrl is held (pan mode)
    if (event.ctrlKey || isCtrlPressed) {
      console.log("Ignoring click - Ctrl is pressed (pan mode)");
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    const { leftPageNumber, rightPageNumber } = getCurrentSpreadPages();
    const pageNumber = isRightPage ? rightPageNumber : leftPageNumber;

    if (pageNumber === "Inside Cover") {
      alert("Cannot add comments to the inside cover");
      return;
    }

    console.log("Creating comment at", x, y, "on page", pageNumber);
    setNewComment({ x, y, text: "", page: pageNumber });
    setShowCommentModal(true);
  };

  // Pan handling functions
  const handleMouseDown = useCallback(
    (event) => {
      // Only start panning if Ctrl is held and we're zoomed in
      if (!event.ctrlKey || zoom <= 1) return;

      console.log("Starting Ctrl+pan at zoom:", zoom);
      setIsPanning(true);
      setPanStart({
        x: event.clientX - panOffset.x,
        y: event.clientY - panOffset.y,
      });

      event.preventDefault();
    },
    [zoom, panOffset]
  );

  const handleMouseMove = useCallback(
    (event) => {
      if (!isPanning) return;

      const newOffset = {
        x: event.clientX - panStart.x,
        y: event.clientY - panStart.y,
      };

      // Limit panning bounds
      const maxPan = 400 * zoom;
      newOffset.x = Math.max(-maxPan, Math.min(maxPan, newOffset.x));
      newOffset.y = Math.max(-maxPan, Math.min(maxPan, newOffset.y));

      setPanOffset(newOffset);
    },
    [isPanning, panStart, zoom]
  );

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      console.log("Ending Ctrl+pan");
      setIsPanning(false);
    }
  }, [isPanning]);

  // Add mouse move listener when panning
  useEffect(() => {
    if (isPanning) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isPanning, handleMouseMove, handleMouseUp]);

  // Save comment
  const saveComment = async () => {
    try {
      setSaving(true);
      console.log("💾 Saving comment:", newComment);

      if (!selectedSchool || !currentVersion?.id) {
        throw new Error("Missing school or version information");
      }

      const commentData = {
        ...newComment,
        author: user?.email || "Anonymous",
        timestamp: new Date(),
        resolved: false,
        resolvedAt: null,
        resolvedBy: null,
      };

      // Add to Firestore - FIXED: using 5-segment path
      const commentsRef = collection(
        db,
        "schools",
        selectedSchool,
        "yearbooks",
        currentVersion.id,
        "comments"
      );

      const docRef = await addDoc(commentsRef, commentData);
      console.log("✅ Comment saved with ID:", docRef.id);

      // Update local state
      const savedComment = { id: docRef.id, ...commentData };
      setComments((prev) => [savedComment, ...prev]);

      // Reset form
      setNewComment({ x: 0, y: 0, text: "", page: 0 });
      setShowCommentModal(false);
      setSaving(false);
    } catch (error) {
      console.error("Error saving comment:", error);
      setSaving(false);
      alert("Error saving comment: " + error.message);
    }
  };

  // Toggle comment resolution
  const toggleCommentResolution = async (commentId) => {
    try {
      console.log("🔄 Toggling comment resolution:", commentId);

      if (!selectedSchool || !currentVersion?.id) {
        throw new Error("Missing school or version information");
      }

      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return;

      const newResolvedState = !comment.resolved;

      // Update in Firestore
      const commentRef = doc(
        db,
        "schools",
        selectedSchool,
        "yearbooks",
        currentVersion.id,
        "comments",
        commentId
      );

      await updateDoc(commentRef, {
        resolved: newResolvedState,
        resolvedAt: newResolvedState ? new Date() : null,
        resolvedBy: newResolvedState ? user?.email || "Anonymous" : null,
      });

      // Update local state
      setComments(
        comments.map((c) =>
          c.id === commentId ? { ...c, resolved: newResolvedState } : c
        )
      );

      console.log(
        `✅ Comment ${newResolvedState ? "resolved" : "reopened"} successfully`
      );
    } catch (error) {
      console.error("Error updating comment:", error);
      alert("Error updating comment: " + error.message);
    }
  };

  // Load specific version
  const loadVersion = async (version) => {
    try {
      console.log("Loading version:", version.name, "ID:", version.id);

      // Close the version history modal immediately
      setShowVersionHistory(false);

      // Set loading state
      setLoadingVersion(true);
      setUploadProgress(`Loading ${version.name}...`);

      // Clear current comments first
      setComments([]);

      // Set the version first so loadComments uses the right ID
      setCurrentVersion(version);

      // Load the PDF
      await loadPdfFromUrl(version.downloadURL, version.name);

      // Load comments for this specific version after PDF is loaded
      await loadCommentsForVersion(version.id);

      setLoadingVersion(false);
      setUploadProgress(null);

      console.log("Version loaded successfully with its comments");
    } catch (error) {
      console.error("Error loading version:", error);
      setLoadingVersion(false);
      setUploadProgress(null);
      alert("Error loading version: " + error.message);
    }
  };

  // Get comments for current spread
  const getCurrentSpreadComments = () => {
    const { leftPageNumber, rightPageNumber } = getCurrentSpreadPages();
    return comments.filter(
      (c) => c.page === leftPageNumber || c.page === rightPageNumber
    );
  };

  // Zoom controls
  const zoomIn = () => setZoom(Math.min(3, zoom + 0.2));
  const zoomOut = () => {
    const newZoom = Math.max(0.5, zoom - 0.2);
    setZoom(newZoom);

    // Reset pan when zooming out to 1x or less
    if (newZoom <= 1) {
      setPanOffset({ x: 0, y: 0 });
    }
  };
  const resetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Export comments
  const exportComments = () => {
    const csvContent = [
      [
        "Page",
        "X Position",
        "Y Position",
        "Comment",
        "Author",
        "Timestamp",
        "Status",
      ],
      ...comments.map((c) => [
        c.page,
        c.x.toFixed(2),
        c.y.toFixed(2),
        c.text,
        c.author,
        c.timestamp.toLocaleString(),
        c.resolved ? "Resolved" : "Open",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yearbook_comments_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentSpreadPages = getCurrentSpreadPages();

  if (!selectedSchool && userRole === "studio") {
    return (
      <div className="yearbook-proofing-view">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Yearbook Proofing</h2>
          </div>
          <div className="empty-state">
            <FileText style={{ width: "48px", height: "48px" }} />
            <h3>No School Selected</h3>
            <p>Please select a school to access yearbook proofing tools.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="yearbook-proofing-view">
      <div className="yearbook-header">
        <div className="yearbook-header-left">
          <h1 className="yearbook-title">Yearbook Proofing</h1>
          {pdfFile && (
            <div className="yearbook-info">
              <span className="yearbook-filename">{pdfFile.name}</span>
              <span className="yearbook-pages">{pdfPages.length} pages</span>
            </div>
          )}
        </div>

        <div className="yearbook-header-right">
          {!pdfFile ? (
            <div className="yearbook-controls">
              {allVersions.length > 0 && (
                <button
                  className="button button-outline"
                  onClick={() => setShowVersionHistory(true)}
                >
                  <History style={{ width: "16px", height: "16px" }} />
                  Version History ({allVersions.length})
                </button>
              )}
              <button
                className="button button-primary"
                onClick={() => {
                  console.log("🔘 Upload button clicked!");
                  console.log("File input ref:", fileInputRef.current);
                  fileInputRef.current?.click();
                }}
              >
                <Upload style={{ width: "16px", height: "16px" }} />
                {allVersions.length > 0
                  ? "Upload New Version"
                  : "Upload PDF Proof"}
              </button>
            </div>
          ) : (
            <div className="yearbook-controls">
              <div className="zoom-controls">
                <button
                  className="zoom-button"
                  onClick={zoomOut}
                  title="Zoom Out"
                >
                  <ZoomOut style={{ width: "16px", height: "16px" }} />
                </button>
                <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                <button
                  className="zoom-button"
                  onClick={zoomIn}
                  title="Zoom In"
                >
                  <ZoomIn style={{ width: "16px", height: "16px" }} />
                </button>
                <button
                  className="zoom-button"
                  onClick={resetZoom}
                  title="Reset Zoom"
                >
                  <RotateCcw style={{ width: "16px", height: "16px" }} />
                </button>
                {zoom > 1 && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      marginLeft: "0.5rem",
                      fontWeight: "500",
                    }}
                  >
                    Ctrl+drag to pan
                  </span>
                )}
              </div>

              {currentVersion && (
                <div className="version-info">
                  <span className="version-label">Version:</span>
                  <span className="version-name">{currentVersion.name}</span>
                  <span className="version-date">
                    {currentVersion.uploadDate.toLocaleDateString()}
                  </span>
                </div>
              )}

              {allVersions.length > 0 && (
                <button
                  className="button button-outline"
                  onClick={() => setShowVersionHistory(true)}
                >
                  <History style={{ width: "16px", height: "16px" }} />
                  Versions ({allVersions.length})
                </button>
              )}

              <button
                className="button button-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload style={{ width: "16px", height: "16px" }} />
                Upload New Version
              </button>

              {comments.length > 0 && (
                <button
                  className="button button-outline"
                  onClick={exportComments}
                >
                  <Download style={{ width: "16px", height: "16px" }} />
                  Export Comments
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      {(loading || loadingVersion) && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>{loadingVersion ? "Loading version..." : "Processing PDF..."}</p>
          {uploadProgress && (
            <p
              style={{
                fontSize: "0.875rem",
                marginTop: "0.5rem",
                color: "#64748b",
              }}
            >
              {uploadProgress}
            </p>
          )}
        </div>
      )}

      {pdfFile && pdfPages.length > 0 && (
        <div className="yearbook-content">
          <div className="yearbook-main">
            {/* Modern spread indicator - compact version */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "1rem 0",
                fontSize: "0.875rem",
                color: "#64748b",
                gap: "1rem",
              }}
            >
              <div style={{ fontWeight: "500" }}>
                Spread {currentSpread + 1} of {totalSpreads}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.75rem",
                }}
              >
                {currentSpreadPages.leftPageNumber !== "Inside Cover" && (
                  <span>Page {currentSpreadPages.leftPageNumber}</span>
                )}
                {currentSpreadPages.leftPageNumber === "Inside Cover" && (
                  <span>Inside Cover</span>
                )}
                {currentSpreadPages.right && (
                  <>
                    <span style={{ color: "#cbd5e1" }}>•</span>
                    <span>Page {currentSpreadPages.rightPageNumber}</span>
                  </>
                )}
              </div>
            </div>

            {/* PDF Spread Display */}
            <div className="pdf-spread-container" ref={pdfContainerRef}>
              <div
                className="pdf-spread"
                style={{
                  transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                  cursor:
                    zoom > 1 && (isCtrlPressed || isPanning)
                      ? isPanning
                        ? "grabbing"
                        : "grab"
                      : "default",
                  transition: isPanning ? "none" : "transform 0.1s ease-out",
                  userSelect: "none",
                }}
                onMouseDown={handleMouseDown}
              >
                {/* Left Page */}
                <div
                  ref={leftPageRef}
                  className="pdf-page pdf-page-left"
                  style={{
                    cursor:
                      isCtrlPressed && zoom > 1
                        ? "grab"
                        : 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIxIDEwLjVIMTQuNUwyMSA0VjEwLjVaIiBmaWxsPSJibGFjayIvPgo8cGF0aCBkPSJNOSAyMS41SDE4QzE5LjMgMjEuNSAyMC41IDIwLjMgMjAuNSAxOVY5SDlWMjEuNVoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMS41Ii8+CjxwYXRoIGQ9Ik0xMiAxNkgxNiIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkw0IDRIMTJMMTYgOEwxMiAxMkw4IDEzLjdMNiAxMS43VjEwLjNMNCAxMEwyIDJaIiBmaWxsPSJ3aGl0ZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIwLjc1Ii8+Cjwvc3ZnPgo8L3N2Zz4K") 8 8, pointer',
                  }}
                  onClick={(e) => handlePageClick(e, false)}
                >
                  {currentSpreadPages.left ? (
                    <>
                      <img
                        src={currentSpreadPages.left.dataUrl}
                        alt={`Page ${currentSpreadPages.leftPageNumber}`}
                        draggable={false}
                      />
                      {/* Comments for left page */}
                      {getCurrentSpreadComments()
                        .filter(
                          (c) => c.page === currentSpreadPages.leftPageNumber
                        )
                        .map((comment) => (
                          <div
                            key={comment.id}
                            className={`comment-marker ${
                              comment.resolved ? "resolved" : ""
                            }`}
                            style={{
                              left: `${comment.x}%`,
                              top: `${comment.y}%`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedComment(comment);
                            }}
                          >
                            <MessageSquare
                              style={{ width: "12px", height: "12px" }}
                            />
                          </div>
                        ))}
                    </>
                  ) : (
                    <div className="blank-page">
                      <div className="blank-page-content">
                        <FileText style={{ width: "48px", height: "48px" }} />
                        <span>Inside Cover</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Page */}
                <div
                  ref={rightPageRef}
                  className="pdf-page pdf-page-right"
                  style={{
                    cursor: isCtrlPressed && zoom > 1 ? "grab" : "context-menu",
                  }}
                  onClick={(e) => handlePageClick(e, true)}
                >
                  {currentSpreadPages.right ? (
                    <>
                      <img
                        src={currentSpreadPages.right.dataUrl}
                        alt={`Page ${currentSpreadPages.rightPageNumber}`}
                        draggable={false}
                      />
                      {/* Comments for right page */}
                      {getCurrentSpreadComments()
                        .filter(
                          (c) => c.page === currentSpreadPages.rightPageNumber
                        )
                        .map((comment) => (
                          <div
                            key={comment.id}
                            className={`comment-marker ${
                              comment.resolved ? "resolved" : ""
                            }`}
                            style={{
                              left: `${comment.x}%`,
                              top: `${comment.y}%`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedComment(comment);
                            }}
                          >
                            <MessageSquare
                              style={{ width: "12px", height: "12px" }}
                            />
                          </div>
                        ))}
                    </>
                  ) : (
                    <div className="blank-page">
                      <div className="blank-page-content">
                        <FileText style={{ width: "48px", height: "48px" }} />
                        <span>Back Cover</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Comments Sidebar */}
          <div
            className={`comments-sidebar ${
              sidebarCollapsed ? "collapsed" : ""
            }`}
          >
            <div className="comments-header">
              <button
                className="collapse-toggle"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={
                  sidebarCollapsed ? "Expand comments" : "Collapse comments"
                }
              >
                {sidebarCollapsed ? (
                  <ChevronLeft style={{ width: "16px", height: "16px" }} />
                ) : (
                  <ChevronRight style={{ width: "16px", height: "16px" }} />
                )}
              </button>

              {!sidebarCollapsed && (
                <>
                  <h3>Comments</h3>
                  <div className="comments-summary">
                    <span className="comment-count open">
                      {comments.filter((c) => !c.resolved).length} Open
                    </span>
                    <span className="comment-count resolved">
                      {comments.filter((c) => c.resolved).length} Resolved
                    </span>
                  </div>
                </>
              )}
            </div>

            {sidebarCollapsed && (
              <div className="collapsed-indicator">Comments</div>
            )}

            <div className="comments-content">
              <div className="comments-list">
                {comments.length === 0 ? (
                  <div className="empty-state">
                    <MessageSquare style={{ width: "32px", height: "32px" }} />
                    <p>No comments yet. Click on the PDF to add a comment.</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`comment-item ${
                        comment.resolved ? "resolved" : "open"
                      }`}
                      style={{ cursor: "pointer" }}
                      onClick={() => navigateToCommentPage(comment)}
                    >
                      <div className="comment-header">
                        <div className="comment-meta">
                          <div className="comment-page">
                            Page {comment.page}
                          </div>
                          <div className="comment-author">{comment.author}</div>
                        </div>
                        <div className="comment-actions">
                          <button
                            className={`action-button ${
                              comment.resolved ? "" : "resolve"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCommentResolution(comment.id);
                            }}
                            title={
                              comment.resolved
                                ? "Mark as unresolved"
                                : "Mark as resolved"
                            }
                          >
                            {comment.resolved ? "↶" : "✓"}
                          </button>
                        </div>
                      </div>
                      <div className="comment-text">{comment.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Navigation Buttons - Outside PDF spread but always visible */}
      {pdfFile && pdfPages.length > 0 && (
        <>
          <button
            className="nav-button-modern nav-button-left"
            onClick={goToPreviousSpread}
            disabled={currentSpread === 0}
            style={{
              left: `${buttonPositions.left}px`,
            }}
          >
            <ChevronLeft style={{ width: "24px", height: "24px" }} />
          </button>

          <button
            className="nav-button-modern nav-button-right"
            onClick={goToNextSpread}
            disabled={currentSpread === totalSpreads - 1}
            style={{
              right: `${buttonPositions.right}px`,
            }}
          >
            <ChevronRight style={{ width: "24px", height: "24px" }} />
          </button>
        </>
      )}

      {/* Comment Modal */}
      {showCommentModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCommentModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Comment</h3>
              <button
                className="modal-close"
                onClick={() => setShowCommentModal(false)}
              >
                <X style={{ width: "16px", height: "16px" }} />
              </button>
            </div>

            <div className="comment-form">
              <div className="form-group">
                <label>Page: {newComment.page}</label>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Position: {newComment.x.toFixed(1)}%,{" "}
                  {newComment.y.toFixed(1)}%
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="comment-text">Comment</label>
                <textarea
                  id="comment-text"
                  className="form-textarea"
                  value={newComment.text}
                  onChange={(e) =>
                    setNewComment({ ...newComment, text: e.target.value })
                  }
                  placeholder="Enter your comment..."
                  rows={4}
                  required
                />
              </div>

              <div className="form-actions">
                <button
                  className="button button-outline"
                  onClick={() => setShowCommentModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  onClick={saveComment}
                  disabled={saving || !newComment.text.trim()}
                >
                  {saving ? (
                    <>
                      <Save style={{ width: "14px", height: "14px" }} />
                      Saving...
                    </>
                  ) : (
                    "Save Comment"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comment Detail Modal */}
      {selectedComment && (
        <div className="modal-overlay" onClick={() => setSelectedComment(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Comment Details</h3>
              <button
                className="modal-close"
                onClick={() => setSelectedComment(null)}
              >
                <X style={{ width: "16px", height: "16px" }} />
              </button>
            </div>

            <div className="comment-details">
              <div className="detail-row">
                <strong>Page:</strong>
                <span>{selectedComment.page}</span>
              </div>
              <div className="detail-row">
                <strong>Author:</strong>
                <span>{selectedComment.author}</span>
              </div>
              <div className="detail-row">
                <strong>Date:</strong>
                <span>{selectedComment.timestamp.toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <strong>Status:</strong>
                <span
                  className={`status-badge ${
                    selectedComment.resolved ? "resolved" : "open"
                  }`}
                >
                  {selectedComment.resolved ? "Resolved" : "Open"}
                </span>
              </div>
              <div className="detail-row">
                <strong>Comment:</strong>
                <div className="comment-text-full">{selectedComment.text}</div>
              </div>

              <div className="form-actions">
                <button
                  className="button button-outline"
                  onClick={() => setSelectedComment(null)}
                >
                  Close
                </button>
                <button
                  className={`button ${
                    selectedComment.resolved
                      ? "button-outline"
                      : "button-primary"
                  }`}
                  onClick={() => {
                    toggleCommentResolution(selectedComment.id);
                    setSelectedComment(null);
                  }}
                >
                  {selectedComment.resolved
                    ? "Mark as Unresolved"
                    : "Mark as Resolved"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showVersionHistory && (
        <div
          className="modal-overlay"
          onClick={() => setShowVersionHistory(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Version History</h3>
              <button
                className="modal-close"
                onClick={() => setShowVersionHistory(false)}
              >
                <X style={{ width: "16px", height: "16px" }} />
              </button>
            </div>

            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              {allVersions.map((version) => (
                <div
                  key={version.id}
                  style={{
                    padding: "1rem",
                    borderBottom: "1px solid #e2e8f0",
                    cursor: "pointer",
                    backgroundColor:
                      currentVersion?.id === version.id ? "#f8fafc" : "white",
                  }}
                  onClick={() => loadVersion(version)}
                >
                  <div style={{ fontWeight: "500", marginBottom: "0.25rem" }}>
                    {version.name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    {version.uploadDate.toLocaleString()} • {version.uploadedBy}
                  </div>
                  {currentVersion?.id === version.id && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#3b82f6",
                        marginTop: "0.25rem",
                      }}
                    >
                      Currently viewing
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YearbookProofingView;
