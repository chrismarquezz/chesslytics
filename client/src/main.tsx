import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { UserProvider } from "./context/UserContext";

import App from "./App"; // Profile page
import ComparePage from "./pages/ComparePage"; // Compare page (future)
import ReviewPage from "./pages/ReviewPage"; // Game review page
import "./index.css";

// ✅ Define routes
const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/compare", element: <ComparePage /> },
  { path: "/review", element: <ReviewPage /> },
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
