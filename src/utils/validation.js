// Helper function to validate student IDs
export const validateStudentIds = (students, idField) => {
  const missingIds = students.filter(
    (student) => !student[idField] || student[idField].trim() === ""
  );
  return {
    isValid: missingIds.length === 0,
    missingIds: missingIds,
    fieldName: idField,
  };
};
