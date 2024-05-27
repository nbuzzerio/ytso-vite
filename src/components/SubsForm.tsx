import { useForm } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import searchSchema from "../validations/searchSchema";
import { useAuth } from "./AuthContext/AuthContext";

type Props = yup.InferType<typeof searchSchema>;

interface SearchFormProps {
  subsSearch: any[];
  setSearch: (searchResults: any[]) => void;
}

const SearchForm: React.FC<SearchFormProps> = ({ subsSearch, setSearch }) => {
  const auth = useAuth();
  const [subsNextPageToken, setSubsNextPageToken] = useState<string>("");

  const onSubmit = (data: Props) => {
    fetch(
      `${window.location.origin}/ytso/api/search?q=${data.search}${
        subsNextPageToken ? `&&nextPageToken=${subsNextPageToken}` : ""
      }`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": auth!,
        },
      },
    )
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
          setSearch([...subsSearch, ...data.items]);
          setSubsNextPageToken(data.nextPageToken);
        }
      })
      .catch((er) => console.log(er));
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Props>({
    resolver: yupResolver(searchSchema),
  });

  return (
    <div className="form-type my-4 w-10/12 bg-zinc-400 lg:my-20 lg:w-6/12">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col px-10 py-5"
      >
        <div className="form-input-wrapper my-3 flex flex-col">
          <input
            type="text"
            id="search"
            minLength={0}
            maxLength={255}
            placeholder="Search"
            {...register("search")}
            onChange={() => {
              setSubsNextPageToken("");
              setSearch([]);
            }}
            className={`p-3 text-dark ${errors["search"] ? "bg-red-100" : ""}`}
          />
          <input
            type="submit"
            value="Submit"
            className="my-5 bg-light p-3 text-dark hover:bg-gray-800 hover:text-light"
            id="subs-search"
          />
          <span className="text-center text-sm text-red-600">
            {errors["search"]?.message}
          </span>
        </div>
      </form>
    </div>
  );
};

export default SearchForm;
