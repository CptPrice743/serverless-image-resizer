import React, { useState, useEffect } from "react";

function ImageUploader() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resizedImageUrl, setResizedImageUrl] = useState(null);
  const [quality, setQuality] = useState(85);
  
  // Configuration
  const outputBucketName = "vyomuchat-image-resizer-output";
  const region = "eu-north-1";
  const outputFormat = "jpeg";
  const API_BASE_URL = "https://13rp2fscr2.execute-api.eu-north-1.amazonaws.com/api";

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus("");
      setResizedImageUrl(null);
    }
  };

  const handleQualityChange = (e) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1 && value <= 100) {
      setQuality(value);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus("Please select a file first.");
      return;
    }

    setIsLoading(true);
    setUploadStatus("Uploading...");

    try {
      // Step 1: Get pre-signed URL
      const response = await fetch(
        `${API_BASE_URL}/get-upload-url?fileName=${encodeURIComponent(selectedFile.name)}&quality=${quality}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get upload URL: ${response.status}`);
      }
      
      const { uploadUrl, key } = await response.json();
      
      // Step 2: Upload to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type }
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }
      
      setUploadStatus("Processing image...");
      
      // Step 3: Generate output key and URL
      const keyParts = key.split('/');
      const filename = keyParts[1];
      const qualityPrefix = keyParts[0];
      const baseName = filename.split('.')[0];
      const outputKey = `resized-${qualityPrefix}/${baseName}.${outputFormat}`;
      const publicUrl = `https://${outputBucketName}.s3.${region}.amazonaws.com/${outputKey}`;
      
      // Step 4: Poll for the processed image
      await checkForProcessedImage(publicUrl);
      
    } catch (error) {
      console.error("Error:", error);
      setUploadStatus(`Error: ${error.message}`);
      setIsLoading(false);
    }
  };

  const checkForProcessedImage = async (imageUrl) => {
    let attempts = 0;
    const maxAttempts = 15;
    const interval = 2000;
    
    const pollImage = () => {
      return new Promise((resolve, reject) => {
        const checkImage = async () => {
          if (attempts >= maxAttempts) {
            clearInterval(timer);
            reject(new Error("Image processing timed out"));
            return;
          }
          
          try {
            const response = await fetch(imageUrl, { method: 'HEAD', cache: 'no-store' });
            if (response.ok) {
              clearInterval(timer);
              resolve(imageUrl);
              return;
            }
          } catch (error) {
            console.log("Still processing...");
          }
          
          attempts++;
        };
        
        const timer = setInterval(checkImage, interval);
        checkImage(); // Check immediately on first call
      });
    };
    
    try {
      const finalUrl = await pollImage();
      setResizedImageUrl(`${finalUrl}?t=${Date.now()}`); // Cache busting
      setUploadStatus("Image processed successfully!");
      setSelectedFile(null);
    } catch (error) {
      setUploadStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="image-uploader">
      <h2>Upload an Image</h2>
      
      <div className="upload-controls">
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileChange} 
          disabled={isLoading} 
        />
        
        <div className="quality-control">
          <label htmlFor="quality">Quality: {quality}%</label>
          <input
            type="range"
            id="quality"
            min="1"
            max="100"
            value={quality}
            onChange={handleQualityChange}
            disabled={isLoading}
          />
        </div>
        
        <button 
          onClick={handleUpload} 
          disabled={!selectedFile || isLoading}
        >
          {isLoading ? "Processing..." : "Upload Image"}
        </button>
      </div>
      
      {uploadStatus && <p className="status">{uploadStatus}</p>}
      
      {resizedImageUrl && (
        <div className="result">
          <h3>Resized Image:</h3>
          <img
            src={resizedImageUrl}
            alt="Resized"
            style={{ maxWidth: "400px" }}
          />
        </div>
      )}
    </div>
  );
}

export default ImageUploader;