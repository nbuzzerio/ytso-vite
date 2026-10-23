import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useAuth } from "../auth/auth-context";
import { api } from "../../lib/api";
import type { Channel, Video } from "../../lib/types";
import { EmptyState, Feedback } from "../../shared/ui/Feedback";
import placeholder from "../../assets/no-image-placeholder.webp";

export default function CategoryFeed({
  channels,
  onAddChannels,
}: {
  channels: Channel[];
  onAddChannels: () => void;
}) {
  const token = useAuth();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const validChannels = channels.filter((channel) => !!channel.channelId);
  const feeds = useQueries({
    queries: validChannels.map((channel) => ({
      queryKey: ["channel-videos", token, channel.channelId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api<{ items: Video[] }>(
          `/search/subVideos?channelId=${encodeURIComponent(channel.channelId)}`,
          { token, signal },
        ),
      enabled: !!token,
      retry: 1,
      staleTime: 5 * 60_000,
    })),
  });
  const videos = Array.from(
    new Map(
      feeds
        .flatMap((feed) => feed.data?.items || [])
        .filter((video) => video?.contentDetails?.videoId && video.snippet)
        .map((video) => [video.contentDetails.videoId, video]),
    ).values(),
  ).sort(
    (a, b) =>
      new Date(b.snippet.publishedAt).valueOf() -
      new Date(a.snippet.publishedAt).valueOf(),
  );
  const failed = feeds.filter((feed) => feed.isError);
  const failedNames = validChannels
    .filter((_, index) => feeds[index].isError)
    .map((channel) => channel.subName);
  const pending = feeds.some((feed) => feed.isPending);
  const fetching = feeds.some((feed) => feed.isFetching);

  if (!channels.length)
    return (
      <EmptyState
        title="Build your first feed"
        description="Add saved channels to this category to see their latest videos here."
        action={
          <button
            className="btn btn-primary"
            type="button"
            onClick={onAddChannels}
          >
            Add channels
          </button>
        }
      />
    );

  return (
    <div className="stack">
      {validChannels.length < channels.length && (
        <Feedback tone="info">
          Some saved channel records are missing their YouTube link and cannot
          load videos.
        </Feedback>
      )}
      <div className="toolbar">
        <div>
          <h2 className="text-2xl font-semibold">Latest videos</h2>
          <p className="text-sm">
            Up to 10 recent uploads per channel, newest first.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={fetching}
          onClick={() => {
            feeds.forEach((feed) => void feed.refetch());
          }}
        >
          {fetching ? "Refreshing…" : "Refresh feed"}
        </button>
      </div>
      {pending && (
        <Feedback tone="info">Loading videos from your channels…</Feedback>
      )}
      {!!failed.length && (
        <Feedback
          tone="error"
          onRetry={() => {
            failed.forEach((feed) => void feed.refetch());
          }}
        >
          Couldn’t load {failedNames.join(", ")}.{" "}
          {videos.length > 0
            ? "Videos from your other channels are still available."
            : "Try again in a moment."}
        </Feedback>
      )}
      {!pending && !failed.length && !videos.length && (
        <EmptyState
          title="No recent videos"
          description="These channels do not have any available uploads yet."
        />
      )}
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        {videos.map((video) => {
          const id = video.contentDetails.videoId;
          const date = new Date(video.snippet.publishedAt);
          const validDate = !Number.isNaN(date.valueOf());
          return (
            <article className="panel min-w-0 overflow-hidden" key={id}>
              {playingId === id ? (
                <>
                  <iframe
                    className="aspect-video min-h-[200px] w-full rounded-lg"
                    referrerPolicy="strict-origin-when-cross-origin"
                    title={`Play ${video.snippet.title}`}
                    src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1`}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                  <button
                    type="button"
                    className="btn btn-secondary my-3"
                    onClick={() => setPlayingId(null)}
                  >
                    Close player
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="group relative block aspect-video w-full overflow-hidden rounded-lg bg-slate-900"
                  aria-label={`Play ${video.snippet.title}`}
                  onClick={() => setPlayingId(id)}
                >
                  <img
                    className="h-full w-full object-cover"
                    src={
                      video.snippet.thumbnails.high?.url ||
                      video.snippet.thumbnails.medium?.url ||
                      video.snippet.thumbnails.default?.url ||
                      placeholder
                    }
                    alt=""
                    loading="lazy"
                    width="480"
                    height="270"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/25">
                    <span
                      className="rounded-full bg-black/80 px-5 py-3 text-sm font-semibold text-white"
                      aria-hidden="true"
                    >
                      ▶ Play video
                    </span>
                  </span>
                </button>
              )}
              <div className="stack mt-4">
                <h3 className="break-words text-lg font-semibold">
                  <a
                    className="hover:underline"
                    href={`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {video.snippet.title}
                    <span className="sr-only">
                      {" "}
                      (opens YouTube in a new tab)
                    </span>
                  </a>
                </h3>
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <p>{video.snippet.channelTitle}</p>
                  {validDate && (
                    <time dateTime={date.toISOString()}>
                      {date.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </time>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
