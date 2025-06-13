import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

// Cache for thumbnail URLs
const thumbnailCache = new Map();

// Generate a thumbnail URL with size parameters
export const getThumbnailUrl = (originalUrl, size = 200) => {
  if (!originalUrl) return null;

  // Check cache first
  const cacheKey = `${originalUrl}_${size}`;
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey);
  }

  // For Firebase Storage URLs with flat structure
  if (originalUrl.includes("firebasestorage.googleapis.com")) {
    // Extract school ID and filename from URL
    // URL format: .../schools%2F[schoolId]%2F[filename]?...
    const urlMatch = originalUrl.match(/schools%2F([^%]+)%2F([^?]+)/);
    if (urlMatch) {
      const [, schoolId, fileName] = urlMatch;

      // First, try to use pre-generated thumbnail
      const decodedFileName = decodeURIComponent(fileName);
      const nameParts = decodedFileName.split(".");
      const ext = nameParts.pop();
      const baseName = nameParts.join(".");
      const thumbnailFileName = `${baseName}_thumb_${size}.${ext}`;

      // Build thumbnail URL
      const baseUrl = originalUrl.split("/o/")[0];
      const thumbnailPath = `schools%2F${schoolId}%2Fthumbnails%2F${encodeURIComponent(
        thumbnailFileName
      )}`;

      // Extract token from original URL
      const tokenMatch = originalUrl.match(/token=([^&]+)/);
      if (tokenMatch) {
        const token = tokenMatch[1];
        const thumbnailUrl = `${baseUrl}/o/${thumbnailPath}?alt=media&token=${token}`;
        thumbnailCache.set(cacheKey, thumbnailUrl);
        return thumbnailUrl;
      }

      // Fallback: Use Cloud Function for on-demand generation
      const functionUrl = `https://us-central1-iconik-portal.cloudfunctions.net/getImageWithSize`;
      const onDemandUrl = `${functionUrl}?school=${schoolId}&file=${decodedFileName}&w=${size}&h=${size}`;
      thumbnailCache.set(cacheKey, onDemandUrl);
      return onDemandUrl;
    }
  }

  // For other URLs, return as-is
  return originalUrl;
};

// Extract token from Firebase Storage URL
const getTokenFromUrl = (url) => {
  const match = url.match(/token=([^&]+)/);
  return match ? match[1] : "";
};

// Create thumbnail on upload (server-side function would be better)
export const createThumbnail = async (file, schoolId) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Create canvas for thumbnail
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Calculate thumbnail dimensions (max 200x200)
        const maxSize = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw thumbnail
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          async (blob) => {
            try {
              // Upload thumbnail
              const thumbnailName = `thumb_${file.name}`;
              const thumbnailRef = ref(
                storage,
                `schools/${schoolId}/thumbnails/${thumbnailName}`
              );
              await uploadBytes(thumbnailRef, blob);
              const thumbnailUrl = await getDownloadURL(thumbnailRef);

              resolve({
                thumbnail: thumbnailUrl,
                original: e.target.result,
              });
            } catch (error) {
              reject(error);
            }
          },
          "image/jpeg",
          0.8
        );
      };

      img.onerror = reject;
      img.src = e.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Preload images in batches
export const preloadImages = (urls, batchSize = 10) => {
  const batches = [];

  for (let i = 0; i < urls.length; i += batchSize) {
    batches.push(urls.slice(i, i + batchSize));
  }

  return batches.reduce((promise, batch) => {
    return promise.then(() => {
      return Promise.all(
        batch.map((url) => {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve; // Continue even if error
            img.src = url;
          });
        })
      );
    });
  }, Promise.resolve());
};
