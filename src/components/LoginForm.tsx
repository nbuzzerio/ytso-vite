import { useForm } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useEffect, useState } from "react";
import signInSchema from "../validations/signInSchema";
import signUpSchema from "../validations/signUpSchema";
import { useUpdateAuth } from "./AuthContext/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";

type Props = yup.InferType<typeof signInSchema | typeof signUpSchema>;
type User = {
  name?: string;
  email: string;
  password: string;
};

const LoginForm = () => {
  const [signUp, setSignUp] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCnfrmPw, setShowCnfrmPw] = useState(false);

  const setAuth = useUpdateAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get("signup")) setSignUp(true);
  }, [location.search]);

  const onSubmit = (data: any) => {
    const user: User = {
      email: data.email,
      password: data.password,
    };
    if (signUp) user.name = data.name;

    fetch(`${window.location.origin}/api/${signUp ? "users" : "auth"}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    })
      .then((res) => {
        if (!res.ok) console.log("Response status: ", res.status, res);
        return res.json();
      })
      .then((data) => {
        if (data.error) setLoginError(data.error);
        else if (data.token) {
          document.cookie = `x-auth-token=${data.token}; expires=${new Date(
            new Date().setDate(new Date().getDate() + 30),
          ).toUTCString()}`;
          setAuth(data.token);
          navigate("/ytso");
        }
      })
      .catch((er) => {
        console.log(er);
        setLoginError("Server Error. Please try again later.");
      });
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Props>({
    resolver: yupResolver(signUp ? signUpSchema : signInSchema),
  });

  return (
    <div className="form-type my-20 w-10/12 bg-zinc-400 lg:w-6/12">
      <div className="header flex w-full items-center justify-center py-10 text-5xl">
        {signUp ? "Sign Up" : "Sign In"}
      </div>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col px-10 py-5"
      >
        {signUp && (
          <div className="form-input-wrapper my-3 flex flex-col">
            <input
              type="text"
              id="name"
              minLength={3}
              maxLength={50}
              placeholder="Name"
              {...register("name")}
              className={`p-3 ${(errors as any)["name"] ? "bg-red-100" : ""}`}
            />
            <span className="text-center text-sm text-red-600">
              {(errors as any)["name"]?.message}
            </span>
          </div>
        )}
        <div className="form-input-wrapper my-3 flex flex-col">
          <input
            type="text"
            id="email"
            minLength={3}
            maxLength={50}
            placeholder="Email"
            {...register("email")}
            className={`p-3 ${errors["email"] ? "bg-red-100" : ""}`}
          />
          <span className="text-center text-sm text-red-600">
            {errors["email"]?.message}
          </span>
        </div>
        <div className="form-input-wrapper relative my-3 flex flex-col">
          <input
            type={showPw ? "text" : "password"}
            id="password"
            minLength={3}
            maxLength={50}
            placeholder="Password"
            {...register("password")}
            className={`p-3 ${errors["password"] ? "bg-red-100" : ""}`}
          />
          <img
            src={`/images/eye-${showPw ? "" : "off-"}filled.svg`}
            alt="eye-icon"
            className="eye-icon absolute right-3 w-8 py-2"
            onClick={() => {
              setShowPw(!showPw);
            }}
          />
          <span className="text-center text-sm text-red-600">
            {errors["password"]?.message}
          </span>
        </div>
        {signUp && (
          <div className="form-input-wrapper relative my-3 flex flex-col">
            <input
              type={showCnfrmPw ? "text" : "password"}
              id="confirmPassword"
              minLength={3}
              maxLength={50}
              placeholder="Confirm Password"
              {...register("confirmPassword")}
              className={`p-3 ${(errors as any)["confirmPassword"] ? "bg-red-100" : ""}`}
            />
            <img
              src={`/images/eye-${showCnfrmPw ? "" : "off-"}filled.svg`}
              alt="eye-icon"
              className="eye-icon absolute right-3 w-8 stroke-orange-900 py-2"
              onClick={() => {
                setShowCnfrmPw(!showCnfrmPw);
              }}
            />
            <span className="text-center text-sm text-red-600">
              {(errors as any)["confirmPassword"]?.message}
            </span>
          </div>
        )}
        <span className="text-center text-sm text-red-600">{loginError}</span>
        <input
          type="submit"
          value="submit"
          className="my-5 bg-white p-3 hover:bg-gray-800 hover:text-white"
        />
      </form>
      <div className="signup-wrapper flex justify-center">
        <input
          type="button"
          className={`signIn flex w-full items-center justify-center border-transparent p-10 ${
            !signUp
              ? "pointer-events-none border-r-2"
              : "cursor-pointer border-t-2 shadow-[inset_3px_0px_7px_#ccc8,inset_-4px_5px_5px_#ccc8]"
          }`}
          value="Sign In"
          onClick={() => {
            setSignUp(false);
          }}
        />
        <input
          type="button"
          className={`signUp flex w-full items-center justify-center border-transparent p-10 ${
            signUp
              ? "pointer-events-none border-l-2"
              : "cursor-pointer border-t-2 shadow-[inset_4px_5px_5px_#ccc8,inset_-3px_0px_7px_#ccc8]"
          }`}
          value="Sign Up"
          onClick={() => {
            setSignUp(true);
          }}
        />
      </div>
    </div>
  );
};

export default LoginForm;
