import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth, useUpdateAuth } from "./AuthContext/AuthContext";
import logo from "../assets/favicon.ico";

import jwt from "jsonwebtoken";

const NavBar = () => {
  const [dropDown, setDropDown] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [userName, setUserName] = useState("");
  const auth = useAuth();
  const setAuth = useUpdateAuth();
  const location = useLocation();

  const checkAuthToken = async () => {
    const cookies = document.cookie.split(";");
    cookies.forEach((cookie) => {
      if (cookie.includes("x-auth-token=")) {
        const token = cookie.trim().slice(13);
        setAuth(token);

        if (token) {
          const decoded = jwt.decode(token);
          if (decoded && typeof decoded !== "string" && "name" in decoded) {
            setUserName(decoded.name);
          }
        }
      }
    });
  };

  useEffect(() => {
    checkAuthToken();

    document
      ?.querySelector(".menu-btn-wrapper")
      ?.addEventListener("click", () => {
        document?.querySelector(".menu-btn")?.classList.add("clicked");
      });

    if (dropDown && !loaded) setLoaded(true);
  }, [dropDown, auth]);

  const handleDropDown = () => {
    if (!dropDown) {
      document.body.style.height = "100vh";
      document.body.style.width = "100%";
    } else {
      document?.querySelector(".menu-btn")?.classList.remove("clicked");
    }

    setDropDown(!dropDown);
  };

  const handleLogOut = () => {
    document.cookie = "x-auth-token=";
    setAuth("");
  };

  return (
    <>
      <div className="navbar absolute z-50 flex h-[80px] w-full justify-center lg:h-[140px]">
        <nav
          className={`wrapper max-w-bg absolute z-10 mx-auto flex h-[80px] w-full items-center justify-between bg-red-600 lg:h-[140px]`}
        >
          <div className="logo-wrapper nav-item z-10 hidden px-10 lg:flex">
            <Link to="/">
              <img
                className="h-32 cursor-pointer px-2"
                src={logo}
                alt="logo image"
              />
            </Link>
          </div>

          <div className="home-wrapper flex justify-center px-5 sm:px-10 lg:absolute lg:w-full">
            <Link
              to="/"
              title="home"
              className="text-logo whitespace-nowrap text-4xl font-extrabold uppercase text-white md:text-6xl lg:text-7xl"
            >
              Y T S O
            </Link>
          </div>

          <div className="right-header-wrapper nav-item z-10 flex items-center px-10">
            <div className="login-wrapper flex">
              {!auth && location.pathname !== "/login" && (
                <>
                  <Link
                    to="/login"
                    className="sign-in mx-2 hidden bg-white px-3 shadow-inner md:flex"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/login?signup=true"
                    className="sign-in mx-2 hidden bg-white px-3 shadow-inner md:flex"
                  >
                    Sign Up
                  </Link>
                </>
              )}
              {auth && (
                <>
                  <div className="loggedIn-wrapper flex flex-col items-center">
                    {userName && (
                      <div className="userName mb-2 text-sm uppercase">
                        Hi, {userName}
                      </div>
                    )}
                    <button
                      className="sign-in mx-2 flex bg-white px-3 shadow-inner"
                      onClick={handleLogOut}
                    >
                      Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
            <div
              className="menu-btn-wrapper flex items-center"
              onClick={handleDropDown}
            >
              <div className="hidden text-2xl uppercase tracking-[0.07rem] text-black sm:block lg:text-3xl"></div>
              <div className="menu-btn flex w-[40px] cursor-pointer flex-col sm:w-[50px]">
                <span className="line1 w-1/2"></span>
                <span className="line2 w-full"></span>
                <span className="line3 w-9/12"></span>
              </div>
            </div>
          </div>
          {loaded && (
            <div
              className={`dropdown-wrapper ${
                dropDown ? "animate-open" : "animate-close"
              } hd:right-[calc((100vw-1937px)/2)] fixed top-[80px] flex h-[calc(100vh-80px)] w-full justify-end lg:top-[140px] lg:h-[calc(100vh-140px)]`}
            >
              <div
                className="dropdown-overlay w-0 lg:w-7/12"
                onClick={handleDropDown}
              ></div>
              <ul
                className={
                  "flex h-full w-full flex-col justify-evenly overflow-hidden bg-white bg-cover px-20 py-10 text-right lg:w-[56%] xl:w-5/12"
                }
              >
                <li className="xs:text-2xl pb-10 text-xl uppercase tracking-[.2rem] text-black lg:text-3xl">
                  Menu
                </li>
                {!auth && location.pathname !== "/login" && (
                  <>
                    <li onClick={handleDropDown}>
                      <Link
                        to="/login"
                        className="sign-in mx-2 w-20 bg-white px-3 shadow-inner md:hidden"
                      >
                        Sign In
                      </Link>
                    </li>
                    <li onClick={handleDropDown}>
                      <Link
                        to="/login?signup=true"
                        className="sign-in mx-2 bg-white px-3 shadow-inner md:hidden"
                      >
                        Sign Up
                      </Link>
                    </li>
                  </>
                )}
                <li className="uppercase tracking-[.2rem]">
                  <Link
                    to="/subs"
                    className="xs:text-3xl text-2xl text-black hover:text-red-700 lg:text-4xl"
                    onClick={handleDropDown}
                  >
                    Subs
                  </Link>
                </li>
                <li className="uppercase tracking-[.2rem]">
                  <Link
                    to="/categories"
                    className="xs:text-3xl text-2xl text-black hover:text-red-700 lg:text-4xl"
                    onClick={handleDropDown}
                  >
                    Categories
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </nav>
      </div>
    </>
  );
};

export default NavBar;
