import React, { useRef } from 'react';

function FileInput({ onFileSelect, isLoading }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    onFileSelect(file); // Pass the selected file up to the parent
    // Clear the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        type="file"
        accept="image/jpeg, image/png, image/gif, image/webp"
        onChange={handleFileChange}
        ref={fileInputRef}
        style={{ display: 'none' }}
        disabled={isLoading}
      />
      <button
        className="select-image-button"
        onClick={handleSelectClick}
        disabled={isLoading}
      >
        🖼️ Select Image
      </button>
    </>
  );
}

export default FileInput;