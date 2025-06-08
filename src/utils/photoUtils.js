// Helper function to find photo for student
export const findPhotoForStudent = (student, photos) => {
  if (!student || !photos || photos.length === 0) return null;

  const firstName = student["First Name"]?.toLowerCase().trim() || "";
  const lastName = student["Last Name"]?.toLowerCase().trim() || "";

  if (!firstName || !lastName) return null;

  // Try different matching strategies
  const strategies = [
    // Strategy 1: Exact filename match if Images column exists
    () => {
      if (student["Images"]) {
        return photos.find((p) => p.name === student["Images"]);
      }
      return null;
    },

    // Strategy 2: FirstName_LastName.jpg format
    () => {
      const expectedName = (firstName + "_" + lastName + ".jpg").replace(
        /\s+/g,
        "_"
      );
      return photos.find((p) => p.name.toLowerCase() === expectedName);
    },

    // Strategy 3: LastName_FirstName.jpg format
    () => {
      const expectedName = (lastName + "_" + firstName + ".jpg").replace(
        /\s+/g,
        "_"
      );
      return photos.find((p) => p.name.toLowerCase() === expectedName);
    },

    // Strategy 4: Loose matching - both names appear in filename
    () => {
      return photos.find((p) => {
        const photoName = p.name.toLowerCase();
        return photoName.includes(firstName) && photoName.includes(lastName);
      });
    },

    // Strategy 5: Very loose matching - either name appears
    () => {
      return photos.find((p) => {
        const photoName = p.name.toLowerCase();
        return (
          (firstName.length > 2 && photoName.includes(firstName)) ||
          (lastName.length > 2 && photoName.includes(lastName))
        );
      });
    },
  ];

  // Try each strategy until we find a match
  for (const strategy of strategies) {
    const photo = strategy();
    if (photo) {
      return photo;
    }
  }

  return null;
};
