import { createBrowserRouter } from "react-router-dom";
import Layout from "./pages/Layout";
import Homepage from "./pages/Homepage";
import DetailPage from "./pages/DetailPage";
import ErrorPage from "./pages/ErrorPage";
import Login from "./pages/Login";

const router = createBrowserRouter([
  {
    path: "/ytso/",
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Homepage /> },
      { path: "/ytso/login", element: <Login /> },
      { path: "/ytso/:slug", element: <DetailPage /> },
    ],
  },
]);

export default router;
