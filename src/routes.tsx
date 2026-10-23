import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "./pages/Layout";
import Homepage from "./pages/Homepage";
import ErrorPage from "./pages/ErrorPage";
import RequireAuth from "./features/auth/RequireAuth";
import RootRedirect from "./app/RootRedirect";

const router = createBrowserRouter([
  {
    path: "/ytso",
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Homepage /> },
      {
        path: "login",
        lazy: async () => ({
          Component: (await import("./features/auth/LoginPage")).default,
        }),
      },
      {
        element: <RequireAuth />,
        children: [
          { path: "subs", element: <Navigate to="/ytso/channels" replace /> },
          {
            path: "channels",
            lazy: async () => ({
              Component: (await import("./features/channels/ChannelsPage"))
                .default,
            }),
          },
          {
            path: "categories",
            lazy: async () => ({
              Component: (await import("./features/categories/CategoriesPage"))
                .default,
            }),
          },
          {
            path: "categories/:categoryId",
            lazy: async () => ({
              Component: (await import("./features/categories/CategoryPage"))
                .default,
            }),
          },
        ],
      },
    ],
  },
  { path: "/", element: <RootRedirect /> },
]);

export default router;
