import React, { useState, useEffect, useRef, useCallback } from "react";
import { MoreVertical } from "lucide-react";

const VirtualizedFileGrid = ({
  files,
  viewMode,
  selectedFileIds,
  draggedFile,
  dragOverFolder,
  movingFiles,
  renamingFile,
  renameValue,
  canMove,
  onFileSelect,
  onFolderClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onRenameChange,
  onRenameBlur,
  onRenameKeyPress,
  getFileTypeIcon,
  getThumbnailUrl, // New prop for thumbnail generation
}) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const [itemHeight, setItemHeight] = useState(viewMode === "grid" ? 200 : 48);
  const [columnCount, setColumnCount] = useState(1);

  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  // Calculate grid layout
  useEffect(() => {
    const calculateLayout = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const padding = 24; // 1.5rem padding
      const gap = 16; // 1rem gap

      if (viewMode === "grid") {
        const minItemWidth = 240;
        const availableWidth = containerWidth - padding * 2;
        const cols = Math.floor((availableWidth + gap) / (minItemWidth + gap));
        setColumnCount(Math.max(1, cols));
        setItemHeight(200);
      } else {
        setColumnCount(1);
        setItemHeight(48);
      }
    };

    calculateLayout();
    window.addEventListener("resize", calculateLayout);
    return () => window.removeEventListener("resize", calculateLayout);
  }, [viewMode]);

  // Handle scroll with debouncing
  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const scrollTop = container.scrollTop;
      const containerHeight = container.offsetHeight;

      // Calculate visible range with buffer
      const buffer = 5; // Render 5 extra rows above and below
      const rowHeight = viewMode === "grid" ? itemHeight + 16 : itemHeight + 8;
      const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
      const endRow =
        Math.ceil((scrollTop + containerHeight) / rowHeight) + buffer;

      const start = startRow * columnCount;
      const end = Math.min(files.length, endRow * columnCount);

      setVisibleRange({ start, end });
    }, 50); // Debounce scroll events
  }, [files.length, itemHeight, columnCount, viewMode]);

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial calculation

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll]);

  // Calculate total height for virtual scrolling
  const totalHeight =
    viewMode === "grid"
      ? Math.ceil(files.length / columnCount) * (itemHeight + 16)
      : files.length * (itemHeight + 8);

  // Get visible files
  const visibleFiles = files.slice(visibleRange.start, visibleRange.end);

  // Calculate position for each visible item
  const getItemStyle = (index) => {
    const actualIndex = visibleRange.start + index;

    if (viewMode === "grid") {
      const row = Math.floor(actualIndex / columnCount);
      const col = actualIndex % columnCount;
      const gap = 16;
      const itemWidth = `calc((100% - ${
        (columnCount - 1) * gap
      }px) / ${columnCount})`;

      return {
        position: "absolute",
        top: row * (itemHeight + gap),
        left: `calc(${col} * (${itemWidth} + ${gap}px))`,
        width: itemWidth,
        height: itemHeight,
      };
    } else {
      return {
        position: "absolute",
        top: actualIndex * (itemHeight + 8),
        left: 0,
        right: 0,
        height: itemHeight,
      };
    }
  };

  return (
    <div
      ref={containerRef}
      className={`files-grid ${viewMode}`}
      style={{
        position: "relative",
        overflowY: "auto",
        height: "100%",
        minHeight: "400px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onFileSelect(null, e);
        }
      }}
    >
      {/* Virtual scroll spacer */}
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleFiles.map((file, index) => {
          const actualIndex = visibleRange.start + index;

          return (
            <div
              key={file.id}
              data-file-id={file.id}
              className={`file-item ${
                selectedFileIds.has(file.id) ? "file-item-selected" : ""
              } ${dragOverFolder === file.id ? "drag-over-folder" : ""} ${
                movingFiles.has(file.id) ? "moving" : ""
              }`}
              style={getItemStyle(index)}
              draggable={canMove() && !renamingFile}
              onDragStart={(e) => onDragStart(e, file)}
              onDragOver={(e) => onDragOver(e, file)}
              onDragLeave={(e) => onDragLeave(e, file)}
              onDrop={(e) => onDrop(e, file)}
              onDragEnd={onDragEnd}
              onClick={(e) => {
                if (draggedFile) {
                  e.preventDefault();
                  return;
                }

                if (file.type === "folder" && e.detail === 2) {
                  onFolderClick(file.name);
                } else {
                  onFileSelect(file, e);
                }
              }}
              onContextMenu={(e) => onContextMenu(e, file)}
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
                          onChange={(e) => onRenameChange(e.target.value)}
                          onBlur={onRenameBlur}
                          onKeyPress={(e) =>
                            e.key === "Enter" && onRenameKeyPress()
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
                      <LazyImage
                        src={
                          getThumbnailUrl
                            ? getThumbnailUrl(file.downloadURL, 200)
                            : file.downloadURL
                        }
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
                      <LazyImage
                        src={
                          getThumbnailUrl
                            ? getThumbnailUrl(file.downloadURL, 32)
                            : file.downloadURL
                        }
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
                        onChange={(e) => onRenameChange(e.target.value)}
                        onBlur={onRenameBlur}
                        onKeyPress={(e) =>
                          e.key === "Enter" && onRenameKeyPress()
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
                  onContextMenu(e, file);
                }}
              >
                <MoreVertical style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Lazy loading image component
const LazyImage = ({ src, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.01 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={imgRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {isInView && (
        <>
          {!isLoaded && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "#f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                color: "#9ca3af",
              }}
            >
              Loading...
            </div>
          )}
          <img
            src={src}
            alt={alt}
            className={className}
            onLoad={() => setIsLoaded(true)}
            style={{ opacity: isLoaded ? 1 : 0, transition: "opacity 0.3s" }}
          />
        </>
      )}
    </div>
  );
};

export default VirtualizedFileGrid;
