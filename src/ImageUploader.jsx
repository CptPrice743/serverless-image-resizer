import React, { useState, useEffect, useRef } from "react";
import FileInput from "./components/FileInput";
import ImagePreview from "./components/ImagePreview";
import ResizeControls from "./components/ResizeControls";
import StatusDisplay from "./components/StatusDisplay";
import ResultDisplay from "./components/ResultDisplay";

function ImageUploader() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resizedImageUrl, setResizedImageUrl] = useState(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState(null);
  const [lastUploadedKey, setLastUploadedKey] = useState(null);
  const [quality, setQuality] = useState(85);
  const [width, setWidth] = useState(128);
  const [height, setHeight] = useState(128);

  // Refs for polling
  const pollingIntervalRef = useRef(null);
  const pollingAttemptsRef = useRef(0);

  // Configuration Constants (remain the same)
  const outputBucketName = "vyomuchat-image-resizer-output";
  const region = "eu-north-1";
  const outputFormat = "jpeg";
  const API_BASE_URL =
    "https://13rp2fscr2.execute-api.eu-north-1.amazonaws.com/api";
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

  // Handle file selection (now receives file from FileInput component)
  const handleFileSelect = (file) => {
    if (file) {
      setSelectedFile(file);
      setUploadStatus(`Selected: ${file.name}`);
      setResizedImageUrl(null); // Clear previous result
      setLastUploadedKey(null); // Clear previous key
      setIsLoading(false); // Reset loading state
      stopPolling(); // Stop any previous polling

      // Generate preview for the selected file
      setOriginalPreviewUrl(null); // Clear previous original preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalPreviewUrl(reader.result); // Set the preview URL
      };
      reader.onerror = () => {
        console.error("Error reading file for preview.");
        setUploadStatus("Error generating preview.");
      };
      reader.readAsDataURL(file);
    } else {
      // Clear states if no file is selected
      setOriginalPreviewUrl(null);
      setSelectedFile(null);
      setUploadStatus("");
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
    // Keep the existing value if the input is invalid or becomes 0, default to 1 if current value is also invalid
    const finalValue =
      isNaN(numValue) || numValue === 0
        ? type === "width"
          ? isNaN(width) || width === 0
            ? 1
            : width
          : isNaN(height) || height === 0
          ? 1
          : height
        : numValue;

    if (type === "width") {
      setWidth(finalValue);
    } else if (type === "height") {
      setHeight(finalValue);
    }
  };

  // Construct the expected output S3 key based on the input key format
  const getOutputKey = (baseKey) => {
    if (!baseKey) return null; // Handle case where key is not set yet

    // Updated format: q{quality}_w{width}_h{height}/filename.ext
    const prefixMatch = baseKey.match(/^(q\d+_w\d+_h\d+)\/(.*)/);
    if (prefixMatch) {
      const prefixPart = prefixMatch[1];
      const filenamePart = prefixMatch[2];
      const baseName =
        filenamePart.substring(0, filenamePart.lastIndexOf(".")) ||
        filenamePart;
      const extension = outputFormat.toLowerCase();
      return `resized-${prefixPart}/${baseName}.${extension}`; // e.g., resized-q85_w128_h128/myphoto.jpeg
    }

    // Fallback for older format: quality{quality}/filename.ext
    const oldPrefixMatch = baseKey.match(/^(quality\d+)\/(.*)/);
    if (oldPrefixMatch) {
      console.warn(
        "Detected old key format, generating compatible output key."
      );
      const filenamePart = oldPrefixMatch[2];
      const baseName =
        filenamePart.substring(0, filenamePart.lastIndexOf(".")) ||
        filenamePart;
      const extension = outputFormat.toLowerCase();
      // Construct a key simulating the new format based on old quality and current dimensions
      return `resized-q${oldPrefixMatch[1]}_w${width}_h${height}/${baseName}.${extension}`;
    }

    console.error("Could not parse prefix from base key:", baseKey);
    // Provide a default/error key structure if parsing fails
    const safeBaseKey = baseKey.split("/").pop() || "unknown_file"; // Get filename part or default
    const errorBaseName =
      safeBaseKey.substring(0, safeBaseKey.lastIndexOf(".")) || safeBaseKey;
    return `resized-error/${errorBaseName}.${outputFormat.toLowerCase()}`;
  };

  // Extract original filename from the structured key for download
  const getOriginalFilenameFromKey = (key) => {
    if (!key) return `resized_image.${outputFormat.toLowerCase()}`;
    // Assumes key format is prefix/filename.ext
    const parts = key.split("/");
    return parts.length > 1
      ? parts[parts.length - 1]
      : `resized_${key}.${outputFormat.toLowerCase()}`; // Fallback if no slash
  };

  // Function to handle the download button click
  const handleDownloadClick = async () => {
    if (!resizedImageUrl) return;
    setUploadStatus("Preparing download...");
    try {
      // Append timestamp to URL to bypass browser cache for the download fetch
      const response = await fetch(`${resizedImageUrl}?t=${Date.now()}`);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch image for download: ${response.statusText}`
        );
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const originalFilename = getOriginalFilenameFromKey(lastUploadedKey); // Use the stored key
      const baseName =
        originalFilename.substring(0, originalFilename.lastIndexOf(".")) ||
        originalFilename;
      // Construct a more descriptive download filename
      link.setAttribute(
        "download",
        `resized_${baseName}_${width}x${height}_q${quality}.${outputFormat.toLowerCase()}`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setUploadStatus("Download started.");
    } catch (error) {
      console.error("Download error:", error);
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

    setIsLoading(true);
    setResizedImageUrl(null); // Clear previous resized image, keep original preview
    setUploadStatus("Getting upload URL...");
    setLastUploadedKey(null);
    stopPolling();

    try {
      const contentType = fileToUpload.type || "application/octet-stream";
      // Construct API URL with all parameters
      const apiUrl = `${API_BASE_URL}/get-upload-url?fileName=${encodeURIComponent(
        fileToUpload.name
      )}&quality=${quality}&width=${width}&height=${height}&contentType=${encodeURIComponent(
        contentType
      )}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: response.statusText }));
        throw new Error(
          `Failed to get upload URL: ${
            errorData.error || response.statusText
          } (${response.status})`
        );
      }
      const { uploadUrl, key } = await response.json();

      setUploadStatus("Uploading image...");
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: fileToUpload,
        headers: { "Content-Type": contentType },
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("S3 Upload Error Response:", errorText);
        throw new Error(
          `Upload failed: ${uploadResponse.statusText} (${uploadResponse.status})`
        );
      }

      setUploadStatus(`Upload successful! Processing image...`); // Updated status
      setLastUploadedKey(key); // Store the key returned by the backend (e.g., q85_w128_h128/myphoto.jpg)
      setSelectedFile(null); // Clear selection state after starting upload
      // setIsLoading remains true while polling
    } catch (error) {
      console.error("Error during upload:", error);
      setUploadStatus(`Error: ${error.message}`);
      setIsLoading(false);
      setLastUploadedKey(null);
      stopPolling();
    }
  };

  // --- useEffect for Polling ---
  useEffect(() => {
    stopPolling(); // Ensure no previous polling is running

    if (lastUploadedKey) {
      // Derive the expected output key using the stored input key and format
      const outputKey = getOutputKey(lastUploadedKey);
      if (!outputKey) {
        console.error("Could not determine output key. Stopping polling.");
        setUploadStatus(
          "Error: Could not determine where to find the resized image."
        );
        setIsLoading(false);
        return;
      }

      const publicUrl = `https://${outputBucketName}.s3.${region}.amazonaws.com/${outputKey}`;

      console.log("Starting polling for expected output key:", outputKey);
      console.log("Polling URL:", publicUrl);
      pollingAttemptsRef.current = 0; // Reset attempts counter

      pollingIntervalRef.current = setInterval(async () => {
        pollingAttemptsRef.current += 1;
        console.log(
          `Polling attempt #${pollingAttemptsRef.current} for ${outputKey}`
        );
        setUploadStatus(
          `Processing... Checking for result (${pollingAttemptsRef.current}/${maxPollingAttempts})`
        ); // Update status during polling

        if (pollingAttemptsRef.current > maxPollingAttempts) {
          console.error("Polling timed out for:", publicUrl);
          setUploadStatus(
            "Image processing timed out. Please try again or check logs."
          );
          setIsLoading(false);
          stopPolling();
          return;
        }

        try {
          // Add cache-busting query parameter
          const headResponse = await fetch(`${publicUrl}?t=${Date.now()}`, {
            method: "HEAD",
            cache: "no-store",
          });

          if (headResponse.ok) {
            console.log("Polling successful! Image found at:", publicUrl);
            stopPolling();
            setResizedImageUrl(`${publicUrl}?t=${Date.now()}`); // Add cache buster to display URL too
            setUploadStatus("Resized image loaded.");
            setIsLoading(false);
          } else if (
            headResponse.status === 403 ||
            headResponse.status === 404
          ) {
            // These statuses are expected while the image is processing
            console.log(
              `Polling attempt failed with status: ${headResponse.status} (Image not ready yet?)`
            );
          } else {
            // Log unexpected statuses but continue polling
            console.warn(
              `Polling attempt failed with unexpected status: ${headResponse.status}. Will keep trying.`
            );
            // Potentially add more specific error handling here if needed
          }
        } catch (error) {
          // Network errors during polling
          console.error("Polling network error:", error);
          // Optionally update status, e.g., setUploadStatus("Polling error, retrying...");
          // Consider stopping polling after several consecutive network errors
        }
      }, pollingIntervalMs);
    }

    // Cleanup function for useEffect
    return () => {
      stopPolling();
    };
  }, [lastUploadedKey, outputBucketName, region, width, height]); // Added width/height as deps in case they affect outputKey logic

  // Reset state for resizing another image
  const handleReset = () => {
    setResizedImageUrl(null);
    setOriginalPreviewUrl(null);
    setUploadStatus("");
    setLastUploadedKey(null);
    setSelectedFile(null);
    setIsLoading(false);
    stopPolling();
    // Note: FileInput component handles clearing its own input value now
  };

  // --- Render Logic ---
  const showInitialButton =
    !selectedFile && !isLoading && !resizedImageUrl && !originalPreviewUrl;
  const showControls = selectedFile && !isLoading && !resizedImageUrl;
  const showOriginalPreview =
    originalPreviewUrl && !isLoading && !resizedImageUrl && selectedFile;
  const showUploadButton = showControls; // Show upload button when controls are shown
  const showResults = resizedImageUrl && originalPreviewUrl;
  const showProcessingMessage = isLoading && !resizedImageUrl; // Show "Processing..." only when loading and no result yet

  return (
    <div className="image-uploader-box">
      {showInitialButton && (
        <FileInput onFileSelect={handleFileSelect} isLoading={isLoading} />
      )}

      {!showInitialButton && (
        <div className="controls-and-status">
          {showOriginalPreview && (
            <ImagePreview
              src={originalPreviewUrl}
              alt="Selected Preview"
              title="Preview:"
            />
          )}

          {showControls && (
            <ResizeControls
              quality={quality}
              width={width}
              height={height}
              onQualityChange={handleQualityChange}
              onDimensionChange={handleDimensionChange}
              isLoading={isLoading}
            />
          )}

          {showUploadButton && (
            <button
              className="upload-button"
              onClick={handleUpload}
              disabled={!selectedFile || isLoading}
            >
              Upload & Resize Image
            </button>
          )}

          <StatusDisplay
            status={uploadStatus}
            isLoading={isLoading}
            showProcessingMessage={showProcessingMessage}
          />

          {showResults && (
            <ResultDisplay
              originalPreviewUrl={originalPreviewUrl}
              resizedImageUrl={resizedImageUrl}
              width={width}
              height={height}
              onDownload={handleDownloadClick}
              onReset={handleReset}
              isLoading={isLoading}
            />
          )}

          {originalPreviewUrl &&
            !selectedFile &&
            !isLoading &&
            !resizedImageUrl && (
              <button
                className="select-image-button secondary"
                style={{ marginTop: "20px" }} // Add some space
                onClick={handleReset}
                disabled={isLoading}
              >
                Select Different Image
              </button>
            )}
        </div>
      )}
    </div>
  );
}

export default ImageUploader;
