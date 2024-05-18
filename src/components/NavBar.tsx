import { useTheme, useUpdateTheme } from "./ThemeContext/ThemeContext";

import floppy from "../assets/favicon.ico";
import { Link } from "react-router-dom";

const NavBar = () => {
  const theme = useTheme();
  const setTheme = useUpdateTheme();

  return (
    <nav
      className={`flex w-full flex-wrap items-center justify-between gap-4 px-2 py-2 transition-colors duration-300 md:flex-nowrap md:px-0`}
    >
      <Link to={"/ytso/"} className="w-14 max-w-14">
        <img src={floppy} alt="" className="shadow-2xl" />
      </Link>
      <label
        className="flex items-center justify-center gap-2 px-2"
        htmlFor="flexSwitchCheckDefault"
      >
        <input
          className={`relative h-5 w-10 appearance-none rounded-3xl shadow-inner transition-colors duration-500
            after:absolute after:bottom-1/2 after:right-1/2 after:aspect-square after:w-3/5 after:translate-y-1/2 after:rounded-full after:shadow-2xl after:transition-all after:duration-500
            ${theme ? "bg-light after:translate-x-0 after:bg-accent-dark" : "bg-[#1117] after:translate-x-full after:bg-accent-light"}`}
          type="checkbox"
          id="flexSwitchCheckDefault"
          defaultChecked={theme}
          onClick={() => setTheme && setTheme(!theme)}
        />
        Dark&nbsp;Mode
      </label>
    </nav>
  );
};

export default NavBar;
