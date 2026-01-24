import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async"; // <--- Nieuwe import
import App from "./App.jsx";
import "./styles/main.scss";
import "./app.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HelmetProvider> 
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider> 
  </StrictMode>,
);