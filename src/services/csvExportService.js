export const exportToCSV = (students, selectedSchool, schools) => {
  if (students.length === 0) {
    return {
      success: false,
      title: "Export Not Available",
      message:
        "There are no students to export. Please upload student data first.",
      details: [
        "No student records found in the database",
        "Upload a CSV file to add student data",
        "Then try exporting again",
      ],
    };
  }

  try {
    const headers = Object.keys(students[0]).filter(
      (key) => !["id", "createdAt", "updatedAt"].includes(key)
    );
    const csvContent = [
      headers.join(","),
      ...students.map((student) =>
        headers.map((header) => '"' + (student[header] || "") + '"').join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName =
      "students_" +
      selectedSchool +
      "_" +
      new Date().toISOString().split("T")[0] +
      ".csv";
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);

    const schoolName =
      schools.find((s) => s.id === selectedSchool)?.name || "School";

    return {
      success: true,
      title: "CSV Export Complete",
      message:
        "Your student data has been successfully exported and downloaded to your computer.",
      stats: {
        totalCount: students.length,
        successCount: students.length,
        failedCount: 0,
      },
      details: [
        `Exported ${students.length} student records`,
        `File name: ${fileName}`,
        `School: ${schoolName}`,
        `Export includes: ${headers.join(", ")}`,
      ],
    };
  } catch (error) {
    return {
      success: false,
      title: "CSV Export Failed",
      message: "There was an error creating your CSV export file.",
      details: [
        `Error: ${error.message}`,
        "Please try the export again",
        "Contact support if the problem persists",
      ],
    };
  }
};
