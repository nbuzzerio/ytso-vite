import { useForm } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import categorySchema from "../validations/categorySchema";
import { useAuth } from "./AuthContext/AuthContext";

type Props = yup.InferType<typeof categorySchema>;

interface CategoriesFormProps {
  categories: Array<{ categoryName: string }>;
  setCategories: (categories: any) => void;
}

const CategoriesForm: React.FC<CategoriesFormProps> = ({
  categories,
  setCategories,
}) => {
  const [dupWarning, setDupWarning] = useState(false);
  const auth = useAuth();

  const onSubmit = (data: Props) => {
    if (
      !categories.some((category) => category.categoryName === data.category)
    ) {
      fetch(`${window.location.origin}/ytso/api/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": auth!,
        },
        body: JSON.stringify({
          category: data.category,
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
    } else {
      setDupWarning(true);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Props>({
    resolver: yupResolver(categorySchema),
  });

  return (
    <div className="form-type my-3 w-10/12 rounded-2xl bg-zinc-400 shadow-2xl lg:my-20 lg:w-6/12">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col px-10 py-5"
      >
        <div className="form-input-wrapper my-3 flex flex-col">
          <input
            type="text"
            id="category"
            minLength={0}
            maxLength={50}
            placeholder="Category"
            {...register("category")}
            className={`p-3 ${errors["category"] ? "bg-red-100" : ""}`}
            onChange={() => setDupWarning(false)}
          />
          <input
            type="submit"
            value="Submit"
            className="my-5 bg-white p-3 text-dark hover:bg-gray-800 hover:text-white"
          />
          <span className="text-center text-sm text-red-600">
            {errors["category"]?.message}
          </span>
          {dupWarning && (
            <span className="text-center text-sm text-red-600">
              Category already exists
            </span>
          )}
        </div>
      </form>
    </div>
  );
};

export default CategoriesForm;
