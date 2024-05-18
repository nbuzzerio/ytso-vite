import { useTheme } from "../components/ThemeContext/ThemeContext";
const DetailPage = () => {
  const theme = useTheme();
  const isLoading = true;

  return (
    <>
      {isLoading && (
        <div
          className={`spinner-border m-5 ${!theme ? "text-dark" : "text-light"}`}
          role="status"
        >
          <span className="visually-hidden">Loading...</span>
        </div>
      )}
    </>
  );
};

export default DetailPage;
