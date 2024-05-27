import { useEffect, useState } from "react";
import { useAuth } from "../components/AuthContext/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CategoriesForm from "../components/CategoriesForm";

interface Category {
  categoryName: string;
  _id: string;
}

const Categories: React.FC = () => {
  const [deleteCategories, setDeleteCategories] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!auth) navigate("/ytso/login");

    fetch(`${window.location.origin}/ytso/api/categories`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-auth-token": auth!,
      },
    })
      .then((res) => {
        if (!res.ok) {
          console.log("Response status: ", res.status, res);
        }
        return res.json();
      })
      .then((data) => {
        if (data.error) {
          console.error(data.error);
        } else {
          setCategories(data);
        }
      })
      .catch((er) => console.log(er));

    return () => {};
  }, [auth, navigate]);

  const handleDelete = (e: React.MouseEvent<HTMLDivElement>) => {
    const deleteCategory = categories.find(
      (category) =>
        category.categoryName ===
        categories[Number(e.currentTarget.id.slice(11))]?.categoryName,
    );

    if (deleteCategory) {
      fetch(`${window.location.origin}/ytso/api/categories`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": auth!,
        },
        body: JSON.stringify({
          categoryName: deleteCategory.categoryName,
        }),
      })
        .then((res) => {
          if (!res.ok) {
            console.log("Response status: ", res.status, res);
          }
          return res.json();
        })
        .then((data) => {
          if (data.error) {
            console.error(data.error);
          } else {
            setCategories(data);
          }
        })
        .catch((er) => console.log(er));
    }
  };

  const categoriesList = categories.map((category, i) => (
    <div
      key={i}
      className={`categories-wrapper bg-gray group relative my-2 flex cursor-pointer flex-col items-center rounded-2xl border border-2 border-black bg-white p-5 text-dark/50 transition duration-200 ${
        deleteCategories
          ? "pointer-events-auto z-10 border-red-600 hover:bg-black hover:text-red-600"
          : ""
      }`}
    >
      <div
        className={`delete-overlay absolute left-0 top-0 hidden h-full w-full cursor-pointer bg-black/75 capitalize ${
          deleteCategories ? "rounded-2xl group-hover:flex" : ""
        } items-center justify-center text-3xl text-red-600`}
        id={`categories-${i}`}
        onClick={(e) => {
          if (deleteCategories) handleDelete(e);
        }}
      >
        delete
      </div>
      <h2 className="sub-title text-red text-3xl">{category.categoryName}</h2>
      <Link
        to={{
          pathname: `/categories/${category.categoryName.toLowerCase().replace(/ /g, "-")}`,
          search: `?id=${category._id}`,
        }}
        className={`${
          deleteCategories ? "hidden" : ""
        } absolute left-0 top-0 h-full w-full`}
      ></Link>
    </div>
  ));

  return (
    <div className="h-full bg-blue-200">
      <main className="main">
        <h1 className="py-10 text-center text-7xl text-red-600">Categories</h1>
        <div className="categories-container flex flex-col items-center gap-5 px-10 lg:items-start">
          {location.pathname === "/categories" && (
            <button
              className={`delete-category w-full rounded-2xl p-5 uppercase transition duration-1000 md:w-auto ${
                deleteCategories
                  ? " bg-black  text-red-600"
                  : "bg-red-600  text-white "
              } ${categories.length > 0 ? "" : "hidden"}`}
              onClick={() => setDeleteCategories(!deleteCategories)}
            >
              Delete Categories
            </button>
          )}
          <div className="flex w-full flex-col overflow-x-auto md:flex-row md:gap-10">
            {categoriesList}
          </div>
        </div>
        <div className="form-wrapper mx-auto flex flex-col items-center">
          <CategoriesForm
            categories={categories}
            setCategories={setCategories}
          />
        </div>
      </main>
    </div>
  );
};

export default Categories;
