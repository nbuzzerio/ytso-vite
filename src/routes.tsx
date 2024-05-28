import { createBrowserRouter } from "react-router-dom";
import Layout from "./pages/Layout";
import Homepage from "./pages/Homepage";
import ErrorPage from "./pages/ErrorPage";
import Login from "./pages/Login";
import Subs from "./pages/Subs";
import Categories from "./pages/Categories";
import Category from "./pages/Category";

const router = createBrowserRouter([
  {
    path: "/ytso/",
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Homepage /> },
      { path: "/ytso/login", element: <Login /> },
      { path: "/ytso/subs", element: <Subs /> },
      { path: "/ytso/categories", element: <Categories /> },
      { path: "/ytso/categories/:category", element: <Category /> },
    ],
  },
]);

export default router;
