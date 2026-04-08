import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { Results } from "./pages/Results";
import { Sitemap } from "./pages/Sitemap";
import { Audit } from "./pages/Audit";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/results/:id" element={<Results />} />
        <Route path="/sitemap" element={<Sitemap />} />
        <Route path="/audit" element={<Audit />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
