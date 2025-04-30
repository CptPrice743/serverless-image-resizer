import React from 'react';

function ImagePreview({ src, alt, title, maxWidth = '300px', maxHeight = '300px' }) {
  if (!src) return null;

  return (
    <div className="image-container" style={{ marginBottom: '20px' }}>
      <h3>{title}</h3>
      <img
        src={src}
        alt={alt}
        style={{
          maxWidth: maxWidth,
          maxHeight: maxHeight,
          border: '1px solid #eee',
          borderRadius: '4px',
          display: 'inline-block', // Ensure image behaves as expected
        }}
      />
    </div>
  );
}

export default ImagePreview;