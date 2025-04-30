import React from 'react';

function ResizeControls({
  quality,
  width,
  height,
  onQualityChange,
  onDimensionChange,
  isLoading,
}) {
  const handleQualityInputChange = (e) => {
    onQualityChange(e.target.value);
  };

  const incrementQuality = () => onQualityChange(quality + 1);
  const decrementQuality = () => onQualityChange(quality - 1);

  return (
    <>
      {/* Quality Controls */}
      <div className="quality-control">
        <label htmlFor="qualityInput">Quality (%): </label>
        <button onClick={decrementQuality} disabled={isLoading || quality <= 1}>
          -
        </button>
        <input
          type="number"
          id="qualityInput"
          min="1"
          max="100"
          value={quality}
          onChange={handleQualityInputChange}
          disabled={isLoading}
        />
        <button onClick={incrementQuality} disabled={isLoading || quality >= 100}>
          +
        </button>
      </div>

      {/* Dimension Controls */}
      <div className="dimension-control">
        <label htmlFor="widthInput">Max Width: </label>
        <input
          type="number"
          id="widthInput"
          min="1"
          value={width}
          onChange={(e) => onDimensionChange(e.target.value, 'width')}
          disabled={isLoading}
        />
        <label htmlFor="heightInput">Max Height: </label>
        <input
          type="number"
          id="heightInput"
          min="1"
          value={height}
          onChange={(e) => onDimensionChange(e.target.value, 'height')}
          disabled={isLoading}
        />
      </div>
    </>
  );
}

export default ResizeControls;