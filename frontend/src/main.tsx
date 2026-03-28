import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Traces from "./pages/Traces";
import Personas from "./pages/Personas";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Traces />} />
          <Route path="/personas" element={<Personas />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
