import { useState } from "react";
import ImageUploader from "./ImageUploader";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      {/* Changed from default Vite structure slightly */}
      <h1>Serverless Image Resizer (Vite)</h1>
      <ImageUploader /> {/* Use the uploader component */}
    </div>
  );
}

export default App;
