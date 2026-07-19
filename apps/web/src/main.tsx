import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.js";
import { HomePage } from "./pages/HomePage.js";
import { RoomPage } from "./pages/RoomPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { VideoDetailPage } from "./pages/VideoDetailPage.js";
import { VideoLibraryPage } from "./pages/VideoLibraryPage.js";
import "./styles/app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/library" element={<VideoLibraryPage />} />
          <Route path="/videos/:videoId" element={<VideoDetailPage />} />
          <Route path="/rooms/:roomId" element={<RoomPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
