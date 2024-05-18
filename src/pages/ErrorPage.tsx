import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import NavBar from "../components/NavBar";
import { useTheme } from "../components/ThemeContext/ThemeContext";

const ErrorPage = () => {
  const error = useRouteError();
  const theme = useTheme();
  return (
    <section
      className={`min-h-screen px-10 transition-colors duration-300 md:px-5 xl:px-10 ${theme ? "bg-dark text-light" : "bg-light text-dark"}`}
    >
      <NavBar />
      <h1 className="text-2xl md:text-7xl">Sorry...</h1>
      <p>
        {isRouteErrorResponse(error)
          ? "This page does not exist."
          : "An unexpected error occured."}
      </p>
    </section>
  );
};

export default ErrorPage;
