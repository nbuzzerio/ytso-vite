import NavBar from "../components/NavBar";
import { Outlet } from "react-router-dom";
import { useTheme } from "../components/ThemeContext/ThemeContext";

const Layout = () => {
  const theme = useTheme();
  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${theme ? "bg-dark text-light" : "bg-light text-dark"}`}
    >
      <NavBar />
      <main className="h-full w-full pt-20">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
