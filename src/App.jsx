// src/App.jsx
import React from 'react';
import ImageUploader from "./ImageUploader";
import './App.css'; // Make sure CSS is imported

// --- Navbar Component ---
// (Simplified: Only shows Website Name on the left)
function Navbar() {
  // You can replace "Image Resizer" with your actual site name
  const websiteName = "Image Resizer";

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Left side: Website Name */}
        <div className="navbar-left">
          <span className="navbar-brand">{websiteName}</span>
        </div>

        {/* Right side is now empty */}
        <div className="navbar-right">
           {/* No items here */}
        </div>
      </div>
    </nav>
  );
}

// --- Features Component (Keep as is from previous response) ---
function Features() {
  const featuresData = [
    { icon: "🖼️", title: "Perfect quality", description: "The best online image resizer to resize your images at the highest quality." },
    { icon: "👍", title: "Easy To Use", description: "Simply upload your image and enter a target size. It's as easy as that!" },
    { icon: "💡", title: "Works Anywhere", description: "ImageResizer.com is browser-based (no software to install). It works on any platform (Windows, Linux, Mac)." },
  ];

  return (
    <section className="features-section">
      <div className="features-grid">
        {featuresData.map((feature, index) => (
          <div className="feature-item" key={index}>
            <div className="feature-icon">{feature.icon}</div>
            <h3 className="feature-title">{feature.title}</h3>
            <p className="feature-description">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- Main App Component (Keep as is from previous response) ---
function App() {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <header className="main-header">
          <h1>Image Resizer</h1>
          <p>Easily resize images online for free.</p>
        </header>
        <ImageUploader />
        <Features />
      </main>
    </div>
  );
}

export default App;