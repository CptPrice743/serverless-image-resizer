// src/ImageUploader.jsx
import React, { useState, useEffect, useRef } from "react";

function ImageUploader() {
  // ... (Keep all your existing state variables: selectedFile, uploadStatus, isLoading, etc.) ...
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resizedImageUrl, setResizedImageUrl] = useState(null);
  const [lastUploadedKeyWithPath, setLastUploadedKeyWithPath] = useState(null);
  const [quality, setQuality] = useState(85);

  const pollingIntervalRef = useRef(null);
  const pollingAttemptsRef = useRef(0);
  const fileInputRef = useRef(null); // Ref for the hidden file input

  // ---- Keep your Configuration and Functions ----
  // outputBucketName, region, outputFormat, API_BASE_URL, etc.
  // stopPolling, handleFileChange, handleQualityChange, increment/decrementQuality, getOutputKey, handleUpload, useEffect
  const outputBucketName = "vyomuchat-image-resizer-output";
  const region = "eu-north-1";
  const outputFormat = "jpeg"; // Note: Quality primarily affects JPEG
  const API_BASE_URL = "https://13rp2fscr2.execute-api.eu-north-1.amazonaws.com/api";
  const pollingIntervalMs = 2000; // Check every 2 seconds
  const maxPollingAttempts = 15; // Stop after 30 seconds (15 * 2s)

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      pollingAttemptsRef.current = 0;
      console.log("Polling stopped.");
    }
  };

 const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
        setSelectedFile(file);
        setUploadStatus(`Selected: ${file.name}`); // Give feedback on selection
        setResizedImageUrl(null);
        setLastUploadedKeyWithPath(null);
        setIsLoading(false);
        stopPolling();
         // Automatically trigger upload after selection (optional, keep if desired)
         // handleUpload(file); // Pass the file directly if needed by handleUpload
    }
  };

  const handleQualityChange = (newQuality) => {
    const numQuality = Math.max(1, Math.min(100, Number(newQuality)));
    setQuality(isNaN(numQuality) ? 85 : numQuality);
  };

  const incrementQuality = () => { handleQualityChange(quality + 1); };
  const decrementQuality = () => { handleQualityChange(quality - 1); };

  const getOutputKey = (originalKeyWithPath) => {
      const filename = originalKeyWithPath.substring(originalKeyWithPath.indexOf('/') + 1);
      const qualityPrefix = originalKeyWithPath.substring(0, originalKeyWithPath.indexOf('/'));
      const baseName = filename.substring(0, filename.lastIndexOf('.')) || filename;
      const extension = outputFormat.toLowerCase();
      return `resized-${qualityPrefix}/${baseName}.${extension}`;
  };

 const handleUpload = async () => { // Modified slightly if file is passed directly
    const fileToUpload = selectedFile; // Use the state variable

    if (!fileToUpload) {
      setUploadStatus("Please select a file first.");
      return;
    }
    setIsLoading(true);
    setResizedImageUrl(null);
    setUploadStatus("Getting upload URL...");
    setLastUploadedKeyWithPath(null);
    stopPolling();

    try {
      const response = await fetch(
        `${API_BASE_URL}/get-upload-url?fileName=${encodeURIComponent(fileToUpload.name)}&quality=${quality}`
      );
      if (!response.ok) throw new Error(`Failed to get upload URL: ${response.status}`);
      const { uploadUrl, key } = await response.json();

      setUploadStatus("Uploading image...");

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: fileToUpload,
        headers: { "Content-Type": fileToUpload.type }
      });
      if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error("S3 Upload Error Response:", errorText);
          throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      setUploadStatus(`Upload successful (${key})! Waiting for resized version...`);
      setLastUploadedKeyWithPath(key);
      // Clear selection after successful upload start
      setSelectedFile(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = ""; // Reset file input visually
      }
      // Keep isLoading true while polling

    } catch (error) {
      console.error("Error during upload:", error);
      setUploadStatus(`Error: ${error.message}`);
      setIsLoading(false);
      setLastUploadedKeyWithPath(null);
      stopPolling();
    }
  };

  // --- Keep your useEffect for polling ---
  useEffect(() => {
      stopPolling(); // Clear previous interval if key changes

      if (lastUploadedKeyWithPath) {
          const outputKey = getOutputKey(lastUploadedKeyWithPath);
          const publicUrl = `https://${outputBucketName}.s3.${region}.amazonaws.com/${outputKey}`;
          console.log("Starting polling for:", publicUrl);
          pollingAttemptsRef.current = 0;

          pollingIntervalRef.current = setInterval(async () => {
              pollingAttemptsRef.current += 1;
              console.log(`Polling attempt #${pollingAttemptsRef.current}`);

              if (pollingAttemptsRef.current > maxPollingAttempts) {
                  console.error("Polling timed out for:", publicUrl);
                  setUploadStatus("Image processing timed out. Please check logs or try again.");
                  setIsLoading(false);
                  stopPolling();
                  return;
              }

              try {
                  const headResponse = await fetch(publicUrl, { method: 'HEAD', cache: 'no-store' });
                  if (headResponse.ok) {
                      console.log("Polling successful! Image found at:", publicUrl);
                      stopPolling();
                      setResizedImageUrl(`${publicUrl}?t=${Date.now()}`); // Set URL + cache bust
                      setUploadStatus("Resized image loaded.");
                      setIsLoading(false);
                  } else {
                      console.log(`Polling attempt failed with status: ${headResponse.status}`);
                  }
              } catch (error) {
                  console.error("Polling network error (CORS issue likely):", error);
              }
          }, pollingIntervalMs);
      }
      return () => { stopPolling(); };
  }, [lastUploadedKeyWithPath]);


  // Trigger file input click when the custom button is clicked
  const handleSelectImageClick = () => {
    fileInputRef.current?.click();
  };

  return (
    // The outer div now acts as the dashed box area
    <div className="image-uploader-box">

      {/* Hidden actual file input */}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        ref={fileInputRef} // Assign the ref
        style={{ display: 'none' }} // Hide the default input
        disabled={isLoading}
      />

      {/* Custom "Select Image" button */}
      <button
        className="select-image-button"
        onClick={handleSelectImageClick} // Trigger the hidden input
        disabled={isLoading}
      >
        🖼️ Select Image {/* Use an icon or text */}
      </button>

      {/* Controls shown *after* selection or during processing */}
      {(selectedFile || isLoading || resizedImageUrl) && (
        <div className="controls-and-status">
          {/* Quality Controls */}
          {!isLoading && !resizedImageUrl && selectedFile && ( // Show quality only when a file is selected but not yet processing/done
            <div className="quality-control">
              <label htmlFor="qualityInput">Quality (%): </label>
              <button onClick={decrementQuality} disabled={isLoading || quality <= 1}>-</button>
              <input
                type="number"
                id="qualityInput"
                min="1"
                max="100"
                value={quality}
                onChange={(e) => handleQualityChange(e.target.value)}
                disabled={isLoading}
              />
              <button onClick={incrementQuality} disabled={isLoading || quality >= 100}>+</button>
            </div>
          )}

           {/* Upload Button - Show only if file selected and not loading */}
           {selectedFile && !isLoading && !resizedImageUrl && (
             <button
               className="upload-button" // Style this button if needed
               onClick={handleUpload}
               disabled={!selectedFile || isLoading}
             >
               {isLoading ? "Processing..." : "Upload & Resize Image"}
             </button>
           )}

          {/* Display status message */}
          {uploadStatus && <p className="status">{uploadStatus}</p>}

          {/* Display result image */}
          {isLoading && !resizedImageUrl && <p className="status">Processing, please wait...</p>}
          {resizedImageUrl && (
            <div className="result">
              <h3>Resized Image:</h3>
              <img
                key={resizedImageUrl} // Use URL as key for re-renders
                src={resizedImageUrl}
                alt="Resized"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ImageUploader;