import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { UserProvider } from "./context/UserContext";

import App from "./App"; // Home page
import ComparePage from "./pages/ComparePage"; // Compare page (future)
import ReviewPage from "./pages/ReviewPage"; // Game review page
import ExplorerPage from "./pages/ExplorerPage"; // Free-play explorer
import "./index.css";

// ✅ Define routes
const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/profile", element: <App /> },
  { path: "/compare", element: <ComparePage /> },
  { path: "/review", element: <ReviewPage /> },
  { path: "/explorer", element: <ExplorerPage /> },
]);

// ✅ Mount app
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <UserProvider>
      <RouterProvider router={router} />
    </UserProvider>
  </StrictMode>
);
