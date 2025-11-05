import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.tsx";
import Layout from "./components/Layout.tsx";
import GamesPage from "./pages/GamesPage.tsx";
import ComparePage from "./pages/ComparePage.tsx";
import "./index.css";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <App /> },
      { path: "/games", element: <GamesPage /> },
      { path: "/compare", element: <ComparePage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
