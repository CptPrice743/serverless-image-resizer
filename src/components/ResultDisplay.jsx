import React from 'react';
import ImagePreview from './ImagePreview'; // Import the preview component

function ResultDisplay({
  originalPreviewUrl,
  resizedImageUrl,
  width,
  height,
  onDownload,
  onReset,
  isLoading,
}) {
  if (!resizedImageUrl || !originalPreviewUrl) return null;

  return (
    <div className="result comparison-container">
      <ImagePreview
        src={originalPreviewUrl}
        alt="Original Preview"
        title="Original:"
        maxWidth="100%" // Allow original preview to scale better
        maxHeight="250px"
      />
       <ImagePreview
        src={resizedImageUrl}
        alt="Resized Image"
        title="Resized:"
        maxWidth={`${width}px`} // Use state for max dimensions
        maxHeight={`${height}px`}
      />

      {/* Action Buttons Container */}
      <div className="result-actions comparison-actions">
        <button
          className="download-button"
          onClick={onDownload}
          disabled={isLoading}
        >
          💾 Download Resized
        </button>
        <button
          className="select-image-button secondary"
          onClick={onReset}
          disabled={isLoading}
        >
          Resize Another Image
        </button>
      </div>
    </div>
  );
}

export default ResultDisplay;