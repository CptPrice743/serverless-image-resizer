import React, { useState, useEffect, useRef } from "react";

function ImageUploader() {
  // State Variables
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resizedImageUrl, setResizedImageUrl] = useState(null);
  const [lastUploadedKey, setLastUploadedKey] = useState(null);
  const [quality, setQuality] = useState(85);
  const [width, setWidth] = useState(128); 
  const [height, setHeight] = useState(128); 

  // Refs for polling and file input
  const pollingIntervalRef = useRef(null);
  const pollingAttemptsRef = useRef(0);
  const fileInputRef = useRef(null);

  // Configuration Constants
  const outputBucketName = "vyomuchat-image-resizer-output"; 
  const region = "eu-north-1"; 
  const outputFormat = "jpeg"; 
  const API_BASE_URL = "https://13rp2fscr2.execute-api.eu-north-1.amazonaws.com/api"; 
  const pollingIntervalMs = 2000; 
  const maxPollingAttempts = 15; 


  // Stop the polling interval
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      pollingAttemptsRef.current = 0;
      console.log("Polling stopped.");
    }
  };

  // Handle file selection from input
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
        setSelectedFile(file);
        setUploadStatus(`Selected: ${file.name}`);
        setResizedImageUrl(null); // Clear previous result
        setLastUploadedKey(null); // Clear previous key
        setIsLoading(false);      // Reset loading state
        stopPolling();            // Stop any previous polling
    }
  };

  // Update quality state, ensuring it's within 1-100
  const handleQualityChange = (newQuality) => {
    const numQuality = Math.max(1, Math.min(100, Number(newQuality)));
    setQuality(isNaN(numQuality) ? 85 : numQuality);
  };

  // Update dimension state (width/height), ensuring positive integers
  const handleDimensionChange = (value, type) => {
    const numValue = Math.max(1, Number(value)); 
    const finalValue = isNaN(numValue) || numValue === 0 ? 128 : numValue;
    if (type === 'width') {
      setWidth(finalValue);
    } else if (type === 'height') {
      setHeight(finalValue);
    }
  };

  // Increment/Decrement quality via buttons
  const incrementQuality = () => { handleQualityChange(quality + 1); };
  const decrementQuality = () => { handleQualityChange(quality - 1); };

  // Construct the expected output S3 key based on the input key format
  const getOutputKey = (baseKey) => {
      // Tries to match the new format: qXX_wXX_hXX/filename.ext
      const prefixMatch = baseKey.match(/^(q\d+_w\d+_h\d+)\/(.*)/);
      if (prefixMatch) {
          const prefixPart = prefixMatch[1];
          const filenamePart = prefixMatch[2];
          const baseName = filenamePart.substring(0, filenamePart.lastIndexOf('.')) || filenamePart;
          const extension = outputFormat.toLowerCase();
          // Example output: resized-q85_w128_h128/myphoto.jpeg
          return `resized-${prefixPart}/${baseName}.${extension}`;
      }

      // Fallback for old format: qualityXX/filename.ext
      const oldPrefixMatch = baseKey.match(/^(quality\d+)\/(.*)/);
      if(oldPrefixMatch){
        console.warn("Detected old key format, generating compatible output key.");
        const filenamePart = oldPrefixMatch[2];
        const baseName = filenamePart.substring(0, filenamePart.lastIndexOf('.')) || filenamePart;
        const extension = outputFormat.toLowerCase();
        // Example output: resized-quality85/myphoto.jpeg
        return `resized-${oldPrefixMatch[1]}/${baseName}.${extension}`;
      }

      // Fallback if no known prefix is found
      console.error("Could not parse prefix from base key:", baseKey);
      return `resized-unknown/${baseKey}`; // Or some other default/error handling
  };

  // Extract original filename from the structured key
  const getOriginalFilenameFromKey = (key) => {
      if (!key) return `resized_image.${outputFormat.toLowerCase()}`;
      const parts = key.split('/');
      // Assumes format prefix/filename.ext
      return parts.length > 1 ? parts[parts.length - 1] : `resized_${key}.${outputFormat.toLowerCase()}`;
  };



  // Function to handle the download button click
  const handleDownloadClick = async () => {
    if (!resizedImageUrl) return;
    setUploadStatus('Preparing download...'); // Feedback message
    try {
        // Fetch the image data as a blob
        const response = await fetch(`${resizedImageUrl}?t=${Date.now()}`); // Add timestamp to bypass cache
        if (!response.ok) {
            throw new Error(`Failed to fetch image for download: ${response.statusText}`);
        }
        const blob = await response.blob();

        // Create a temporary URL for the blob
        const url = window.URL.createObjectURL(blob);

        // Create a temporary link element
        const link = document.createElement('a');
        link.href = url;

        // Set the download attribute with a meaningful filename
        const originalFilename = getOriginalFilenameFromKey(lastUploadedKey);
        const baseName = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
        link.setAttribute('download', `resized_${baseName}.${outputFormat.toLowerCase()}`);

        // Append link to the body, click it, and remove it
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Revoke the temporary URL to free up memory
        window.URL.revokeObjectURL(url);
        setUploadStatus('Download started.');
    } catch (error) {
        console.error('Download error:', error);
        setUploadStatus(`Error preparing download: ${error.message}`);
    }
  };

  // Handle the image upload process
  const handleUpload = async () => {
    const fileToUpload = selectedFile;
    if (!fileToUpload) {
      setUploadStatus("Please select a file first.");
      return;
    }

    // Reset states before upload
    setIsLoading(true);
    setResizedImageUrl(null);
    setUploadStatus("Getting upload URL...");
    setLastUploadedKey(null);
    stopPolling();

    try {
      // Get content type hint for the backend
      const contentType = fileToUpload.type || 'application/octet-stream';

      // 1. Get pre-signed URL from backend Lambda
      const apiUrl = `${API_BASE_URL}/get-upload-url?fileName=${encodeURIComponent(fileToUpload.name)}&quality=${quality}&width=${width}&height=${height}&contentType=${encodeURIComponent(contentType)}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          throw new Error(`Failed to get upload URL: ${errorData.error || response.statusText} (${response.status})`);
      }
      const { uploadUrl, key } = await response.json(); // Key includes quality & dimensions

      // 2. Upload the file directly to S3 using the pre-signed URL
      setUploadStatus("Uploading image...");
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: fileToUpload,
        headers: { "Content-Type": contentType } // Use actual content type
      });

      if (!uploadResponse.ok) {
          // Attempt to get error details from S3 response (might be XML)
          const errorText = await uploadResponse.text();
          console.error("S3 Upload Error Response:", errorText);
          throw new Error(`Upload failed: ${uploadResponse.statusText} (${uploadResponse.status})`);
      }

      // 3. Upload successful, start polling for resized image
      setUploadStatus(`Upload successful! Waiting for resized version...`);
      setLastUploadedKey(key); // Store the key used for upload (contains params)
      setSelectedFile(null); // Clear selection state
      if (fileInputRef.current) {
          fileInputRef.current.value = ""; // Reset file input visually
      }
      // Note: setIsLoading remains true while polling

    } catch (error) {
      console.error("Error during upload:", error);
      setUploadStatus(`Error: ${error.message}`);
      setIsLoading(false); // Stop loading on error
      setLastUploadedKey(null);
      stopPolling(); // Ensure polling stops on error
    }
  };

  // --- useEffect for Polling ---
  useEffect(() => {
    // Stop any previous polling interval when the key changes or component unmounts
    stopPolling();

    if (lastUploadedKey) {
        // Calculate the expected key in the output bucket
        const outputKey = getOutputKey(lastUploadedKey);
        // Construct the public URL (ensure bucket allows public reads or use signed GET URLs)
        const publicUrl = `https://${outputBucketName}.s3.${region}.amazonaws.com/${outputKey}`;

        console.log("Starting polling for expected output key:", outputKey);
        console.log("Polling URL:", publicUrl);
        pollingAttemptsRef.current = 0; // Reset attempts counter

        // Start interval to check if the resized image exists
        pollingIntervalRef.current = setInterval(async () => {
            pollingAttemptsRef.current += 1;
            console.log(`Polling attempt #${pollingAttemptsRef.current} for ${outputKey}`);

            // Stop polling after reaching max attempts
            if (pollingAttemptsRef.current > maxPollingAttempts) {
                console.error("Polling timed out for:", publicUrl);
                setUploadStatus("Image processing timed out. Please check Lambda logs or try again.");
                setIsLoading(false); // Stop loading indicator
                stopPolling();
                return;
            }

            try {
                // Check if the object exists using a HEAD request
                // Use cache: 'no-store' and add timestamp to prevent browser caching during polling
                const headResponse = await fetch(`${publicUrl}?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });

                if (headResponse.ok) {
                    // Image found!
                    console.log("Polling successful! Image found at:", publicUrl);
                    stopPolling(); // Stop polling
                    setResizedImageUrl(`${publicUrl}?t=${Date.now()}`); // Set URL + cache bust
                    setUploadStatus("Resized image loaded.");
                    setIsLoading(false); // Stop loading indicator
                } else if (headResponse.status === 403 || headResponse.status === 404) {
                   // File not found yet, continue polling
                   console.log(`Polling attempt failed with status: ${headResponse.status} (Image not ready yet?)`);
                } else {
                   // Log other errors but continue polling for a bit
                   console.warn(`Polling attempt failed with status: ${headResponse.status}. Will keep trying.`);
                }
            } catch (error) {
                // Network errors might be temporary, log and continue polling unless max attempts reached
                console.error("Polling network error:", error);
            }
        }, pollingIntervalMs);
    }

    // Cleanup function: Stop polling when component unmounts or key changes
    return () => { stopPolling(); };
  }, [lastUploadedKey, outputBucketName, region]); // Dependencies for the effect

  // --- Render Logic ---

  // Trigger the hidden file input when the custom button is clicked
  const handleSelectImageClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="image-uploader-box">

      <input
        type="file"
        accept="image/jpeg, image/png, image/gif, image/webp" // Specify accepted types
        onChange={handleFileChange}
        ref={fileInputRef}
        style={{ display: 'none' }}
        disabled={isLoading}
      />

      {/* Show "Select Image" button only when no file is selected/processing/shown */}
      {!selectedFile && !isLoading && !resizedImageUrl && (
        <button
            className="select-image-button"
            onClick={handleSelectImageClick}
            disabled={isLoading}
        >
            🖼️ Select Image
        </button>
      )}

      {/* Show controls and status/results area if needed */}
      {(selectedFile || isLoading || resizedImageUrl) && (
        <div className="controls-and-status">

          {/* Show controls only when a file is selected and not loading/finished */}
          {!isLoading && !resizedImageUrl && selectedFile && (
            <>
              {/* Quality Controls */}
              <div className="quality-control">
                <label htmlFor="qualityInput">Quality (%): </label>
                <button onClick={decrementQuality} disabled={isLoading || quality <= 1}>-</button>
                <input
                  type="number" id="qualityInput" min="1" max="100" value={quality}
                  onChange={(e) => handleQualityChange(e.target.value)}
                  disabled={isLoading}
                />
                <button onClick={incrementQuality} disabled={isLoading || quality >= 100}>+</button>
              </div>

              {/* Dimension Controls */}
              <div className="dimension-control">
                <label htmlFor="widthInput">Max Width: </label>
                <input
                  type="number" id="widthInput" min="1" value={width}
                  onChange={(e) => handleDimensionChange(e.target.value, 'width')}
                  disabled={isLoading}
                />
                <label htmlFor="heightInput">Max Height: </label>
                <input
                  type="number" id="heightInput" min="1" value={height}
                  onChange={(e) => handleDimensionChange(e.target.value, 'height')}
                  disabled={isLoading}
                />
              </div>

              {/* Upload Button */}
              <button
                className="upload-button"
                onClick={handleUpload}
                disabled={!selectedFile || isLoading}
              >
                Upload & Resize Image
              </button>
            </>
          )}

          {/* Status Message Area */}
          {uploadStatus && <p className="status">{uploadStatus}</p>}

          {/* Loading Indicator during processing */}
          {isLoading && !resizedImageUrl && <p className="status">Processing, please wait...</p>}

          {/* Result Image and Action Buttons */}
          {resizedImageUrl && (
            <div className="result">
              <h3>Resized Image:</h3>
              <img
                key={resizedImageUrl} // Force re-render if URL changes slightly (cache busting)
                src={resizedImageUrl}
                alt="Resized"
                // Optional: constrain display size visually using the max dimensions
                style={{ maxWidth: `${width}px`, maxHeight: `${height}px`}}
              />
              {/* Action Buttons Container */}
              <div className="result-actions">
                  {/* Download Button */}
                  <button
                      className="download-button"
                      onClick={handleDownloadClick}
                      disabled={isLoading} // Disable if somehow loading state is still true
                  >
                      💾 Download Image
                  </button>

                  {/* Button to select another image */}
                  <button
                      className="select-image-button secondary"
                      onClick={() => {
                          // Reset all relevant states to start fresh
                          setResizedImageUrl(null);
                          setUploadStatus('');
                          setLastUploadedKey(null);
                          setSelectedFile(null);
                          setIsLoading(false);
                          stopPolling(); // Ensure polling is stopped
                          if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input visually
                          // Optionally re-open file dialog automatically: handleSelectImageClick();
                      }}
                  >
                      Resize Another Image
                  </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ImageUploader;