import { useEffect, useState } from "react";
import { useAuth } from "../components/AuthContext/AuthContext";
import { useSubs, useUpdateSubs } from "../components/SubsContext/SubsContext";
import { useNavigate } from "react-router-dom";
import SubsList from "../components/SubsList";
import SubsForm from "../components/SubsForm";

interface Sub {
  id: {
    channelId: string;
  };
  snippet: {
    channelTitle: string;
    description: string;
    thumbnails: {
      default: {
        url: string;
      };
      medium: {
        url: string;
      };
      high: {
        url: string;
      };
    };
  };
}

export default function Subs() {
  const [subsSearch, setSubsSearch] = useState<Sub[]>([]);

  const auth = useAuth();
  const subs = useSubs();
  const setSubs = useUpdateSubs();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth) navigate("/login");

    const lastChannelObserver = new IntersectionObserver((channels) => {
      const lastChannel = channels[0];
      if (!lastChannel.isIntersecting) return;

      const search = document.querySelector("#subs-search") as HTMLInputElement;
      search.click();
    }, {});

    if (subsSearch.length > 0) {
      lastChannelObserver.observe(
        document.querySelector(".searchSub-wrapper:last-child")!,
      );
    }

    return () => {};
  }, [subsSearch, auth, navigate]);

  const handleSubscribe = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      subs.length === 0 ||
      !subs.some(
        (sub) =>
          sub?.channelId ===
          subsSearch[Number(e.currentTarget.id.slice(10))]?.id?.channelId,
      )
    ) {
      const sub = subsSearch[Number(e.currentTarget.id.slice(10))];

      fetch(`${window.location.origin}/ytso/api/subs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": auth!,
        },
        body: JSON.stringify({
          subName: sub.snippet.channelTitle,
          channelId: sub.id.channelId,
          channelDesc: sub.snippet.description,
          channelThumbnails: {
            default: sub.snippet.thumbnails.default.url,
            medium: sub.snippet.thumbnails.medium.url,
            high: sub.snippet.thumbnails.high.url,
          },
        }),
      })
        .then((res) => {
          if (!res.ok) {
            console.log("Response status: ", res.status, res);
            return res.json().then((data) => ({ error: data.error }));
          }
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

  const searchSubsList = subsSearch.map((sub, i) => {
    return (
      <div
        className={`searchSub-wrapper bg-gray group relative my-10 flex w-8/12 justify-start gap-12 border border-black bg-white/50 p-5 drop-shadow-2xl ${
          subs.some(
            (existingSub) =>
              existingSub?.channelId === subsSearch[i]?.id?.channelId,
          )
            ? "hidden"
            : ""
        }`}
        key={i}
        id={`searchSub-${i}`}
        onClick={handleSubscribe}
      >
        <div className="subscribe-overlay pointer-events-none absolute left-0 top-0 hidden h-full w-full cursor-pointer items-center justify-center bg-red-600/75 text-5xl capitalize text-white group-hover:flex">
          subscribe
        </div>
        <img
          src={sub.snippet.thumbnails.medium.url}
          alt="searchSub thumbnail"
          className="pointer-events-none"
        />
        <div className="searchSub-info pointer-events-none flex flex-col gap-5">
          <h2 className="searchSub-title text-red text-3xl">
            {sub.snippet.channelTitle}
          </h2>
          <p className="searchSub-desc">{sub.snippet.description}</p>
        </div>
      </div>
    );
  });

  return (
    <div className="min-h-[calc(100vh-80px)] bg-blue-200">
      <h1 className="py-10 text-center text-5xl text-red-600 lg:text-7xl">
        Subscriptions
      </h1>
      <SubsList category={null} setCategory={() => {}} />
      <div className="form-wrapper mx-auto flex flex-col items-center">
        <SubsForm subsSearch={subsSearch} setSearch={setSubsSearch} />
        {searchSubsList}
      </div>
    </div>
  );
}
