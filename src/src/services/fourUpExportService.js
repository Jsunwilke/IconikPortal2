import { findPhotoForStudent } from "../utils/photoUtils";

export const exportToFourUp = async (
  students,
  photos,
  selectedSchool,
  schools,
  exportCancelledRef,
  setUploadProgress,
  setUploadStats,
  sortOptions
) => {
  if (students.length === 0) {
    return {
      type: "fourup_export",
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

  exportCancelledRef.current = false;

  try {
    const schoolName =
      schools.find((s) => s.id === selectedSchool)?.name || "School";
    const timestamp = new Date().toISOString().split("T")[0];

    setUploadProgress("Preparing 4-Up export...");
    setUploadStats({
      current: 0,
      total: students.length + 1,
      percentage: 0,
      operation: "Creating 4-Up PDF",
    });

    return await processFourUpExport(
      students,
      photos,
      schoolName,
      timestamp,
      sortOptions,
      exportCancelledRef,
      setUploadProgress,
      setUploadStats
    );

  } catch (error) {
    console.error("4-Up export error:", error);
    return {
      type: "fourup_export",
      success: false,
      title: "4-Up Export Failed",
      message: "An error occurred while creating your 4-Up PDF.",
      details: [`Error: ${error.message}`, "Please try the export again"],
    };
  }
};

const sortStudents = (students, sortOptions) => {
  return [...students].sort((a, b) => {
    for (const field of sortOptions) {
      if (!field) continue;
      
      let aValue = (a[field] || "").toString().toLowerCase();
      let bValue = (b[field] || "").toString().toLowerCase();
      
      // Handle numeric sorting for grades
      if (field === "Grade") {
        aValue = parseInt(a[field] || "0");
        bValue = parseInt(b[field] || "0");
      }
      
      if (aValue < bValue) return -1;
      if (aValue > bValue) return 1;
    }
    return 0;
  });
};

const processFourUpExport = async (
  students,
  photos,
  schoolName,
  timestamp,
  sortOptions,
  exportCancelledRef,
  setUploadProgress,
  setUploadStats
) => {
  // Sort students according to user preferences
  const sortedStudents = sortStudents(students, sortOptions);
  
  // Filter students with photos
  const studentsWithPhotos = sortedStudents.filter(student => 
    findPhotoForStudent(student, photos)
  );

  if (studentsWithPhotos.length === 0) {
    return {
      type: "fourup_export",
      success: false,
      title: "No Photos Available",
      message: "No students have photos available for the 4-Up export.",
      details: [
        "Upload photos to create 4-Up labels",
        "Photos must match student names",
      ],
    };
  }

  setUploadProgress("Creating 4-Up PDF...");
  setUploadStats({
    current: 0,
    total: studentsWithPhotos.length,
    percentage: 0,
    operation: "Generating 4-Up PDF",
  });

  try {
    // Try to load jsPDF - use CDN fallback for CodeSandbox
    let jsPDF;
    try {
      const jsPDFModule = await import("jspdf");
      jsPDF = jsPDFModule.jsPDF;
    } catch (importError) {
      // Fallback: Load jsPDF from CDN
      if (!window.jsPDF) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        document.head.appendChild(script);
        
        // Wait for script to load
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          setTimeout(reject, 10000); // 10 second timeout
        });
      }
      jsPDF = window.jsPDF;
    }
    
    if (!jsPDF) {
      throw new Error("jsPDF could not be loaded");
    }
    
    // Create PDF with 8.5x11 inch dimensions (612x792 points)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "in",
      format: [8.5, 11]
    });

    // Layout constants (all in inches) - CORRECTED for 7 rows
    const squareSize = 1.5;
    const marginLeft = 0.5;
    const marginTop = 0.25; // Reduced top margin for 7 rows
    const rowsPerPage = 7; // FIXED: 7 rows per page

    let currentRow = 0;
    let pageCount = 1;

    for (let i = 0; i < studentsWithPhotos.length; i++) {
      if (exportCancelledRef.current) {
        setUploadProgress("Export cancelled by user");
        setTimeout(() => {
          setUploadProgress(null);
          setUploadStats(null);
        }, 1500);
        return;
      }

      const student = studentsWithPhotos[i];
      const photo = findPhotoForStudent(student, photos);

      setUploadProgress(`Processing student ${i + 1}/${studentsWithPhotos.length}: ${student["First Name"]} ${student["Last Name"]}`);
      setUploadStats({
        current: i + 1,
        total: studentsWithPhotos.length,
        percentage: Math.round(((i + 1) / studentsWithPhotos.length) * 100),
        operation: "Generating 4-Up PDF",
      });

      // Check if we need a new page
      if (currentRow >= rowsPerPage) {
        pdf.addPage();
        currentRow = 0;
        pageCount++;
      }

      const rowY = marginTop + (currentRow * squareSize);

      try {
        // Load and process the image with HIGH RESOLUTION
        const img = await loadImageFromURL(photo.url);
        if (exportCancelledRef.current) throw new Error("Export cancelled");

        // Create high-resolution canvas for image processing
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        // Use 300 DPI for print quality (1.5 inches * 300 DPI = 450 pixels)
        const imgSize = 450; 
        
        canvas.width = imgSize;
        canvas.height = imgSize;
        
        // Fill with white background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, imgSize, imgSize);
        
        // Calculate scaling to fill the square (crop to fit)
        const scale = Math.max(imgSize / img.width, imgSize / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const offsetX = (imgSize - scaledWidth) / 2;
        const offsetY = (imgSize - scaledHeight) / 2;
        
        // Draw the image
        ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
        
        if (exportCancelledRef.current) throw new Error("Export cancelled");
        
        // Get image data as high-quality JPEG
        const imageData = canvas.toDataURL("image/jpeg", 0.95);
        
        // Add 4 copies of the photo
        for (let col = 0; col < 4; col++) {
          const x = marginLeft + (col * squareSize);
          pdf.addImage(imageData, "JPEG", x, rowY, squareSize, squareSize);
        }
        
        // Add info square (5th column) - FIXED: Right next to the photos
        const infoX = marginLeft + (4 * squareSize); // This should be immediately after the 4th photo
        
        // Draw border for info square
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.01);
        pdf.rect(infoX, rowY, squareSize, squareSize);
        
        // Add text content with AUTO-SIZING
        addAutoSizedText(pdf, student, schoolName, infoX, rowY, squareSize);

      } catch (error) {
        if (exportCancelledRef.current || error.message === "Export cancelled") {
          setUploadProgress("Export cancelled by user");
          setTimeout(() => {
            setUploadProgress(null);
            setUploadStats(null);
          }, 1500);
          return;
        }
        console.error(`Error processing student ${student["First Name"]} ${student["Last Name"]}:`, error);
      }

      currentRow++;
    }

    if (exportCancelledRef.current) {
      setUploadProgress("Export cancelled by user");
      setTimeout(() => {
        setUploadProgress(null);
        setUploadStats(null);
      }, 1500);
      return;
    }

    // Save the PDF as a blob and download it (memory-based)
    const pdfBlob = pdf.output("blob");
    const fileName = `4-Up_Labels_${schoolName.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.pdf`;
    
    // Create download link and trigger download
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setUploadProgress(null);
    setUploadStats(null);

    return {
      type: "fourup_export",
      success: true,
      title: "4-Up Export Complete",
      message: "Your 4-Up label PDF has been successfully created and downloaded!",
      stats: {
        totalCount: studentsWithPhotos.length,
        successCount: studentsWithPhotos.length,
        failedCount: 0,
      },
      details: [
        `Created PDF with ${studentsWithPhotos.length} student labels`,
        `File: ${fileName}`,
        `Pages: ${pageCount}`,
        `Layout: 7 rows × 5 columns (4 photos + 1 info per row)`,
        `Sort order: ${sortOptions.filter(Boolean).join(" → ")}`,
        `Resolution: 300 DPI for print quality`,
        "Ready for printing on Uline sticker sheets",
      ],
    };

  } catch (error) {
    console.error("Error creating PDF:", error);
    setUploadProgress(null);
    setUploadStats(null);

    return {
      type: "fourup_export",
      success: false,
      title: "4-Up Export Failed",
      message: "Failed to create the PDF file.",
      details: [`Error: ${error.message}`],
    };
  }
};

// Helper function to add auto-sized text to info square
const addAutoSizedText = (pdf, student, schoolName, x, y, squareSize) => {
  const padding = 0.08; // Padding in inches
  const maxWidthInches = squareSize - (padding * 2); // Available width in inches
  
  console.log(`=== TEXT SIZING DEBUG ===`);
  console.log(`Square size: ${squareSize}" | Padding: ${padding}" | Max width: ${maxWidthInches}"`);
  
  // Get all text lines
  const textLines = [];
  if (student["First Name"]) textLines.push({ text: student["First Name"], isName: true });
  if (student["Last Name"]) textLines.push({ text: student["Last Name"], isName: true });
  if (schoolName) textLines.push({ text: schoolName, isName: false });
  if (student.Grade) textLines.push({ text: `Grade: ${student.Grade}`, isName: false });
  if (student.Teacher) textLines.push({ text: `Teacher: ${student.Teacher}`, isName: false });
  
  const studentId = student["Student ID"] || student["Subject ID"] || student["SASID"] || student["Student Number"];
  if (studentId) textLines.push({ text: `ID: ${studentId}`, isName: false });
  
  if (textLines.length === 0) return;
  
  // Size each line independently - ONLY caring about width
  const processedLines = [];
  
  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i];
    let fontSize = line.isName ? 14 : 9; // Names start at 14pt, other info starts at 9pt
    
    console.log(`Processing line ${i}: "${line.text}" (starting at ${fontSize}pt)`);
    
    // Test this specific line at this specific font size
    pdf.setFontSize(fontSize);
    pdf.setFont("helvetica", line.isName ? "bold" : "normal");
    
    // jsPDF getTextWidth() returns inches when unit is "in"
    let textWidthInches = pdf.getTextWidth(line.text);
    
    console.log(`Initial width: ${textWidthInches.toFixed(4)}" | Max: ${maxWidthInches.toFixed(4)}"`);
    
    // Reduce font size until text fits within available width
    let iterations = 0;
    while (textWidthInches > maxWidthInches && fontSize > 0.1 && iterations < 200) {
      fontSize -= 0.1;
      pdf.setFontSize(fontSize);
      pdf.setFont("helvetica", line.isName ? "bold" : "normal");
      textWidthInches = pdf.getTextWidth(line.text);
      iterations++;
      
      if (iterations <= 5 || iterations % 10 === 0) {
        console.log(`  Iteration ${iterations}: ${fontSize}pt | Width: ${textWidthInches.toFixed(4)}"`);
      }
    }
    
    console.log(`FINAL: "${line.text}" = ${fontSize}pt (width: ${textWidthInches.toFixed(4)}")`);
    
    // This line is now sized to fit - add it to the list
    processedLines.push({ 
      ...line, 
      fontSize: fontSize
    });
  }
  
  console.log("\n=== FINAL TEXT RESULTS ===");
  for (let i = 0; i < processedLines.length; i++) {
    console.log(`${i}: "${processedLines[i].text}" = ${processedLines[i].fontSize}pt`);
  }
  
  // Render the text - simple top-to-bottom, left-aligned
  pdf.setTextColor(0, 0, 0);
  
  let currentY = y + 0.2; // Start near top with some margin
  
  for (const line of processedLines) {
    currentY += line.fontSize / 72; // Move down by font size converted to inches
    
    if (line.fontSize > 0.1) {
      pdf.setFontSize(line.fontSize);
      pdf.setFont("helvetica", line.isName ? "bold" : "normal");
      
      // Left-aligned at padding distance from left edge
      const textX = x + padding;
      
      console.log(`Rendering "${line.text}" at (${textX.toFixed(4)}", ${currentY.toFixed(4)})`);
      pdf.text(line.text, textX, currentY);
    }
    
    // Add small gap between lines
    currentY += 0.05;
  }
};

// Helper function to load image from URL
const loadImageFromURL = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    const timeout = setTimeout(() => {
      reject(new Error("Image load timeout"));
    }, 10000);
    
    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Image load failed"));
    };
    
    img.src = url;
  });
};