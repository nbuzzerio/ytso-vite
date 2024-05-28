import { useEffect, useState } from "react";
import { useAuth } from "../components/AuthContext/AuthContext";
import { Link, useNavigate, useLocation } from "react-router-dom";
import CategoryInterface from "../interfaces/Category";
import SubsList from "../components/SubsList";

interface Video {
  snippet: {
    publishedAt: string;
    title: string;
    channelTitle: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
  };
  contentDetails: {
    videoId: string;
  };
}

const Category: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [subsFeed, setSubsFeed] = useState<Video[]>([]);
  const [category, setCategory] = useState<CategoryInterface | null>(null);
  const [showSubs, setShowSubs] = useState(false);

  useEffect(() => {
    if (!auth) {
      navigate("/ytso/login");
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    const categoryId = searchParams.get("id");

    fetch(
      `${window.location.origin}/ytso/api/categories/subs?id=${categoryId}`,
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
          setCategory(data);
        }
      })
      .catch((er) => console.log(er));

    return () => {};
  }, [auth, navigate, location]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    if (category) {
      const videos = category.subs.map((sub) => {
        return fetch(
          `${window.location.origin}/ytso/api/search/subVideos?channelId=${sub.channelId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-auth-token": auth!,
            },
            signal,
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
              return data;
            }
          })
          .catch((er) => console.log(er));
      });

      Promise.all(videos).then((videoData) => {
        setSubsFeed(videoData.flatMap((data) => data.items));
      });
    }

    return () => {
      controller.abort();
    };
  }, [category, auth]);

  const handleDelete = (e: React.MouseEvent<HTMLDivElement>) => {
    const deleteSub = category?.subs.find(
      (sub) =>
        sub?.channelId ===
        category?.subs[Number(e.currentTarget.id.slice(4))]?.channelId,
    );

    if (deleteSub && category) {
      fetch(`${window.location.origin}/ytso/api/categories/sub`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": auth!,
        },
        body: JSON.stringify({
          channelId: deleteSub.channelId,
          categoryId: category._id,
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
            setCategory({ ...category, subs: data });
          }
        })
        .catch((er) => console.log(er));
    }
  };

  const categorySubList = category?.subs.map((sub, i) => (
    <div
      className={`sub-wrapper bg-gray group relative my-10 flex flex-col items-center gap-12 border border-black bg-white/50 p-5 drop-shadow-2xl transition duration-200 ${
        showSubs
          ? "cursor-pointer  border-2 border-red-600 hover:bg-black hover:text-red-600"
          : ""
      }`}
      key={i}
      id={`sub-${i}`}
      onClick={handleDelete}
    >
      <div
        className={`delete-overlay absolute left-0 top-0 hidden h-full w-full cursor-pointer bg-black/75 capitalize ${
          showSubs ? "group-hover:flex" : ""
        } pointer-events-none items-center justify-center text-3xl text-red-600`}
      >
        unsubscribe
      </div>
      <img
        src={sub.channelThumbnails.medium}
        alt="sub thumbnail"
        className="pointer-events-none h-[240px] w-[240px] min-w-[240px]"
        width="240px"
        height="240px"
      />
      <div className="sub-info pointer-events-none flex flex-col gap-5">
        <h3 className="sub-title text-red text-center text-3xl">
          {sub.subName}
        </h3>
      </div>
    </div>
  ));

  const handleOpenVid = (i: number) => {
    const imgWrapper = document.querySelector(`#thumbnail-wrapper-${i}`);
    imgWrapper?.classList.add("hidden");

    const iframe = document.querySelector(`#iframe-${i}`);
    iframe?.classList.remove("hidden");
  };

  const subFeedVidsList = subsFeed.map((video, i) => (
    <div
      className="video-wrapper flex max-h-screen w-full flex-col overflow-hidden md:w-10/12"
      key={i}
    >
      <div className="video-header flex w-full justify-between">
        <div className="video-titles-wrapper flex flex-col">
          <a
            href={`https://www.youtube.com/watch?v=${video.contentDetails.videoId}`}
            target="_blank"
            rel="noreferrer"
          >
            <h3 className="video-title max-w-[25ch] overflow-hidden text-ellipsis whitespace-nowrap text-3xl text-dark hover:text-red-600 md:max-w-prose">
              {video.snippet.title}
            </h3>
          </a>
          <a
            href={`https://www.youtube.com/c/${video.snippet.channelTitle}`}
            target="_blank"
            rel="noreferrer"
          >
            <h4 className="video-channelTitle overflow-hidden text-ellipsis whitespace-nowrap text-2xl text-dark hover:text-red-600 md:max-w-prose">
              {video.snippet.channelTitle}
            </h4>
          </a>
        </div>
        <time
          dateTime={`${new Date(video.snippet.publishedAt).toLocaleDateString()}`}
          className="video-date italics text-xl text-dark"
        >
          {new Date(video.snippet.publishedAt).toLocaleDateString()}
        </time>
      </div>
      <div
        className="aspect-video w-full overflow-hidden"
        id={`thumbnail-wrapper-${i}`}
      >
        <img
          src={video.snippet.thumbnails.default.url}
          alt=""
          className="h-full w-full cursor-pointer object-contain object-center sm:hidden md:object-cover"
          onClick={() => handleOpenVid(i)}
        />
        <img
          src={video.snippet.thumbnails.medium.url}
          alt=""
          className="hidden h-full w-full cursor-pointer object-contain object-center sm:block md:object-cover lg:hidden"
          onClick={() => handleOpenVid(i)}
        />
        <img
          src={video.snippet.thumbnails.high.url}
          alt=""
          className="hidden h-full w-full cursor-pointer object-contain object-center md:object-cover lg:block"
          onClick={() => handleOpenVid(i)}
        />
      </div>
      <iframe
        src={`https://www.youtube.com/embed/${video.contentDetails.videoId}`}
        frameBorder="0"
        allowFullScreen
        className="hidden aspect-video h-full w-full"
        id={`iframe-${i}`}
      ></iframe>
    </div>
  ));

  return (
    <div className="bg-blue-200">
      <main className="main min-h-[85vh]">
        <Link to="/ytso/categories">
          <nav className="breadcrumbs p-5 uppercase text-red-600 transition duration-500 hover:font-extrabold hover:underline">
            categories
          </nav>
        </Link>
        <h1 className="py-10 text-center text-7xl text-red-600">
          {category?.categoryName}
        </h1>
        <hr />
        <div className="sub-hub flex flex-col p-1 sm:p-10">
          <SubsList category={category} setCategory={setCategory} />
          <button
            className={`show-sub mx-auto mb-5 w-7/12 rounded-2xl p-5 uppercase transition duration-100 ${
              showSubs ? "bg-white  text-red-600" : "bg-red-600  text-white"
            }`}
            onClick={() => setShowSubs(!showSubs)}
          >
            {showSubs ? "Hide" : "Show"} Category Subs
          </button>
          <div
            className={`subs-wrapper flex w-full gap-10 overflow-x-auto transition-all duration-500 ${
              showSubs ? "h-full w-full" : "h-0 w-0"
            }`}
          >
            {categorySubList}
          </div>
          <h2 className="py-3 text-center text-5xl uppercase text-red-600">
            {category?.categoryName} Feed
          </h2>
          <div className="videos-wrapper flex w-full flex-col items-center justify-center gap-10 overflow-x-auto">
            {subFeedVidsList}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Category;
