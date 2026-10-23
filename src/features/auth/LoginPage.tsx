import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Feedback } from "../../shared/ui/Feedback";
import { useSession } from "./auth-context";
import { loginSchema, type LoginValues } from "./login-schema";
import { isSessionValid } from "./session";

export default function LoginPage() {
  const [params] = useSearchParams();
  const signUp = params.get("signup") === "true";
  const location = useLocation();
  const session = useSession();
  const [requestError, setRequestError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: yupResolver(loginSchema),
    context: { signUp },
    defaultValues: { email: "", password: "", name: "", confirmPassword: "" },
  });
  useEffect(() => {
    reset({
      email: getValues("email"),
      name: "",
      password: "",
      confirmPassword: "",
    });
    setRequestError("");
    setShowPassword(false);
  }, [signUp, reset, getValues]);

  const requested = location.state?.from;
  const destination =
    typeof requested === "string" &&
    /^\/ytso\/(channels|categories)(\/|\?|$)/.test(requested)
      ? requested
      : "/ytso/channels";
  if (session.token) return <Navigate to={destination} replace />;

  const submit = async (values: LoginValues) => {
    setRequestError("");
    try {
      const result = await api<{ token: string }>(signUp ? "/users" : "/auth", {
        method: "POST",
        body: {
          email: values.email,
          password: values.password,
          ...(signUp ? { name: values.name } : {}),
        },
      });
      if (!isSessionValid(result.token))
        throw new Error(
          "We couldn't start your session. Please sign in again.",
        );
      session.update(result.token);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "We couldn't sign you in. Please try again.",
      );
    }
  };

  return (
    <section className="page auth-page" aria-labelledby="login-title">
      <div className="page-header">
        <p className="eyebrow">Your channels, thoughtfully organized</p>
        <h1 id="login-title">
          {signUp ? "Create your account" : "Welcome back"}
        </h1>
        <p>
          {signUp
            ? "Make a little room for what you love to watch."
            : "Sign in to your channels and categories."}
        </p>
      </div>
      {session.expired && (
        <Feedback>Your session has expired. Sign in to continue.</Feedback>
      )}
      <div className="panel auth-panel">
        <form onSubmit={handleSubmit(submit)} noValidate>
          <fieldset disabled={isSubmitting} className="stack">
            <legend className="sr-only">
              {signUp ? "Create an account" : "Sign in"}
            </legend>
            {signUp && (
              <div className="field">
                <label className="field-label" htmlFor="name">
                  Name
                </label>
                <input
                  className="input"
                  id="name"
                  autoComplete="name"
                  maxLength={50}
                  {...register("name")}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                />
                {errors.name && (
                  <p className="field-error" id="name-error">
                    {errors.name.message}
                  </p>
                )}
              </div>
            )}
            <div className="field">
              <label className="field-label" htmlFor="email">
                Email address
              </label>
              <input
                className="input"
                id="email"
                type="email"
                autoComplete="email"
                maxLength={255}
                {...register("email")}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p className="field-error" id="email-error">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <div className="password-field">
                <input
                  className="input"
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={signUp ? "new-password" : "current-password"}
                  maxLength={signUp ? 72 : 255}
                  {...register("password")}
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((show) => !show)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && (
                <p className="field-error" id="password-error">
                  {errors.password.message}
                </p>
              )}
            </div>
            {signUp && (
              <div className="field">
                <label className="field-label" htmlFor="confirmPassword">
                  Confirm password
                </label>
                <input
                  className="input"
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  maxLength={72}
                  {...register("confirmPassword")}
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={
                    errors.confirmPassword ? "confirm-error" : undefined
                  }
                />
                {errors.confirmPassword && (
                  <p className="field-error" id="confirm-error">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            )}
            {requestError && <Feedback tone="error">{requestError}</Feedback>}
            <button className="btn btn-primary w-full" type="submit">
              {isSubmitting
                ? "Please wait…"
                : signUp
                  ? "Create account"
                  : "Sign in"}
            </button>
          </fieldset>
        </form>
        <p className="auth-switch">
          {signUp ? "Already have an account?" : "New to YTSO?"}{" "}
          <Link
            to={signUp ? "/ytso/login" : "/ytso/login?signup=true"}
            state={location.state}
            replace
          >
            {signUp ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
      <p className="auth-note">
        YTSO organizes channels you save here. Your YouTube subscriptions stay
        in your YouTube account.
      </p>
    </section>
  );
}
