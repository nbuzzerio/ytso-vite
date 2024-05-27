import { useEffect, useState } from "react";
import Category from "../interfaces/Category";
import { useAuth } from "./AuthContext/AuthContext";
import { useSubs, useUpdateSubs } from "./SubsContext/SubsContext";
import { useLocation } from "react-router-dom";

interface SubsListProps {
  category: Category | null;
  setCategory: (category: Category | null) => void;
}

const SubsList: React.FC<SubsListProps> = ({ category, setCategory }) => {
  const [deleteSubs, setDeleteSubs] = useState(false);
  const [showSubs, setShowSubs] = useState(false);
  const auth = useAuth();
  const subs = useSubs();
  const setSubs = useUpdateSubs();
  const location = useLocation();

  useEffect(() => {
    return () => {};
  }, [auth]);

  const handleDelete = (e: React.MouseEvent<HTMLDivElement>) => {
    const deleteSub = subs.find(
      (sub) =>
        sub?.channelId === subs[Number(e.currentTarget.id.slice(4))]?.channelId,
    );

    if (deleteSub) {
      fetch(`${window.location.origin}/ytso/api/subs`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": auth!,
        },
        body: JSON.stringify({
          channelId: deleteSub.channelId,
        }),
      })
        .then((res) => {
          if (!res.ok) console.log("Response status: ", res.status, res);
          return res.json();
        })
        .then((data) => {
          if (data.error) console.error(data.error);
          else {
            setSubs(data);
          }
        })
        .catch((er) => console.log(er));
    }
  };

  const handleAddSub = (e: React.MouseEvent<HTMLDivElement>) => {
    const addSub = subs.find(
      (sub) =>
        sub?.channelId === subs[Number(e.currentTarget.id.slice(4))]?.channelId,
    );

    if (addSub && category) {
      fetch(`${window.location.origin}/ytso/api/categories`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": auth!,
        },
        body: JSON.stringify({
          sub: addSub,
          categoryId: category._id,
        }),
      })
        .then((res) => {
          if (!res.ok) console.log("Response status: ", res.status, res);
          return res.json();
        })
        .then((data) => {
          if (data.error) console.error(data.error);
          else {
            setCategory({ ...category, subs: data.subs });
          }
        })
        .catch((er) => console.log(er));
    }
  };

  const subsList = subs
    .sort((a, b) => {
      if (a.subName < b.subName) return -1;
      if (a.subName > b.subName) return 1;
      return 0;
    })
    .map((sub, i) => {
      return (
        <div
          className={`sub-wrapper bg-gray group relative my-10 flex flex-col items-center gap-12 border border-black bg-white p-5 text-dark/50 drop-shadow-2xl transition duration-200 ${
            deleteSubs || category
              ? "cursor-pointer  border-2 border-red-600 hover:bg-black hover:text-red-600"
              : ""
          }`}
          key={i}
          id={`sub-${i}`}
          onClick={(e) => {
            if (deleteSubs) handleDelete(e);
            if (category) handleAddSub(e);
          }}
        >
          <div
            className={`delete-overlay absolute left-0 top-0 hidden h-full w-full cursor-pointer bg-black/75 capitalize ${
              deleteSubs || category ? "group-hover:flex" : ""
            } pointer-events-none items-center justify-center text-3xl text-red-600`}
          >
            {deleteSubs ? "unsubscribe" : "Subscribe"}
          </div>
          <img
            src={sub.channelThumbnails.medium}
            alt="sub thumbnail"
            className="pointer-events-none h-[240px] w-[240px] min-w-[240px]"
            width="240px"
            height="240px"
          />
          <div className="sub-info pointer-events-none flex flex-col gap-5">
            <h2 className="sub-title text-red text-center text-3xl">
              {sub.subName}
            </h2>
          </div>
        </div>
      );
    });

  return (
    <div className="subs-container flex flex-col items-start gap-5 px-10">
      <div className="btn-wrapper flex w-full gap-10">
        <button
          className={`show-sub mx-auto w-8/12 rounded-2xl p-5 uppercase transition duration-1000 ${
            showSubs
              ? "bg-white text-dark  text-red-600"
              : "bg-red-600  text-white"
          } ${subs.length > 0 ? "" : "hidden"}`}
          onClick={() => setShowSubs(!showSubs)}
        >
          {location.pathname === "/subs"
            ? "Show Subs"
            : !showSubs
              ? "Show All Subs"
              : "Hide All Subs"}
        </button>

        {location.pathname === "/subs" && (
          <button
            className={`delete-sub  rounded-2xl p-5 uppercase transition duration-1000 ${
              deleteSubs ? " bg-black  text-red-600" : "bg-red-600  text-white "
            } ${subs.length > 0 ? "" : "hidden"}`}
            onClick={() => setDeleteSubs(!deleteSubs)}
          >
            <img
              src="/images/recycling-bin-black.svg"
              alt="recycling bin icon"
              className={`${deleteSubs && "invert transition duration-1000"}`}
            />
          </button>
        )}
      </div>
      {/* {location.pathname.includes("/categories") && (
        <button
          className={`add-sub  transition duration-1000 p-5 rounded-2xl uppercase ${
            deleteSubs ? " bg-black  text-red-600" : "bg-red-600  text-white "
          } ${subs.length > 0 ? "" : "hidden"}`}
          onClick={(e) => handleAddSub(e)}
        >
          Add Subs
        </button>
      )} */}
      <div
        className={`subs-wrapper mb-10 flex h-full w-full gap-10 overflow-x-auto transition-all duration-500 ${showSubs ? "h-full w-full" : "max-h-0 max-w-0"}`}
      >
        {subsList}
      </div>
    </div>
  );
};

export default SubsList;
