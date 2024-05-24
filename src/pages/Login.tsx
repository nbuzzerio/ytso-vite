import LoginForm from "../components/LoginForm";

export default function Login() {
  return (
    <div className="h-screen bg-blue-200">
      <main className="main">
        <h1 className="py-10 text-center text-7xl text-red-600">Log In</h1>
        <div className="form-wrapper flex justify-center">
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
