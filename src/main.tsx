import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import ThemeContext from "./components/ThemeContext/index.ts";
import "./style.scss";
import { RouterProvider } from "react-router-dom";
import router from "./routes.tsx";
import AuthContext from "./components/AuthContext/AuthContext.tsx";
import SubsContext from "./components/SubsContext/SubsContext.tsx";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeContext>
        <AuthContext>
          <SubsContext>
            <RouterProvider router={router} />
            <ReactQueryDevtools />
          </SubsContext>
        </AuthContext>
      </ThemeContext>
    </QueryClientProvider>
  </React.StrictMode>,
);
