import React from 'react';

function StatusDisplay({ status, isLoading, showProcessingMessage }) {
  if (!status && !(isLoading && showProcessingMessage)) return null;

  let message = status;
  if (isLoading && showProcessingMessage && !status.toLowerCase().includes('processing')) {
      message = "Processing, please wait...";
  }

  return <p className="status">{message}</p>;
}

export default StatusDisplay;