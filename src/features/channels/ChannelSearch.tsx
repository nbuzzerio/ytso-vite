import { useState, type FormEvent } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/auth-context";
import { api } from "../../lib/api";
import type { Channel, SearchChannel } from "../../lib/types";
import { EmptyState, Feedback } from "../../shared/ui/Feedback";
import ChannelCard from "./ChannelCard";
import { useChannelActions } from "./queries";

interface SearchResponse {
  items: SearchChannel[];
  nextPageToken?: string;
}

function toChannel(result: SearchChannel): Channel {
  return {
    channelId: result.id.channelId,
    subName: result.snippet.channelTitle,
    channelDesc: result.snippet.description,
    channelThumbnails: {
      default: result.snippet.thumbnails.default?.url || "",
      medium: result.snippet.thumbnails.medium?.url || "",
      high: result.snippet.thumbnails.high?.url || "",
    },
  };
}

export default function ChannelSearch({
  channels,
  canSave,
}: {
  channels: Channel[];
  canSave: boolean;
}) {
  const token = useAuth();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [validation, setValidation] = useState("");
  const [notice, setNotice] = useState("");
  const { save, pending } = useChannelActions();
  const search = useInfiniteQuery({
    queryKey: ["channel-search", token, query],
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ q: query });
      if (pageParam) params.set("nextPageToken", pageParam);
      return api<SearchResponse>(`/search?${params}`, { token, signal });
    },
    initialPageParam: "",
    getNextPageParam: (lastPage, _pages, _lastParam, params) =>
      lastPage.nextPageToken && !params.includes(lastPage.nextPageToken)
        ? lastPage.nextPageToken
        : undefined,
    enabled: !!token && !!query,
    retry: 1,
    staleTime: 60_000,
  });
  const results = Array.from(
    new Map(
      (search.data?.pages.flatMap((page) => page.items) || [])
        .filter((result) => result?.id?.channelId)
        .map((result) => [result.id.channelId, toChannel(result)]),
    ).values(),
  );
  const savedIds = new Set(channels.map((channel) => channel.channelId));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setValidation("Enter a channel name or topic to search.");
      return;
    }
    if (trimmed === query && search.isFetching) return;
    setValidation("");
    setNotice("");
    save.reset();
    if (trimmed === query) void search.refetch();
    else setQuery(trimmed);
  }

  return (
    <section className="stack" aria-labelledby="find-channels-title">
      <div>
        <h2 id="find-channels-title" className="text-2xl font-semibold">
          Find channels
        </h2>
        <p>Search YouTube and save channels to your collection.</p>
      </div>
      <form onSubmit={submit} className="panel stack" role="search">
        <div className="field">
          <label className="field-label" htmlFor="youtube-search">
            Channel name or topic
          </label>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row">
            <input
              id="youtube-search"
              className="input min-w-0 flex-1"
              type="search"
              value={input}
              maxLength={200}
              required
              placeholder="e.g. cooking, science, music"
              onChange={(event) => {
                setInput(event.target.value);
                setValidation("");
              }}
              aria-invalid={!!validation}
              aria-describedby={validation ? "youtube-search-error" : undefined}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={search.isFetching && input.trim() === query}
            >
              Search YouTube
            </button>
          </div>
          {validation && (
            <p
              id="youtube-search-error"
              className="text-sm text-red-700"
              role="alert"
            >
              {validation}
            </p>
          )}
        </div>
      </form>
      {notice && <Feedback tone="success">{notice}</Feedback>}
      {save.isError && <Feedback tone="error">{save.error.message}</Feedback>}
      {query && search.isPending && (
        <Feedback tone="info">Searching YouTube…</Feedback>
      )}
      {query && search.isError && (
        <Feedback
          tone="error"
          onRetry={() => {
            void search.refetch();
          }}
        >
          {search.error.message}
        </Feedback>
      )}
      {query && search.isSuccess && results.length === 0 && (
        <EmptyState
          title="No channels found"
          description="Try a different name or a broader topic."
        />
      )}
      {results.length > 0 && (
        <>
          <p className="text-sm" role="status">
            {results.length} result{results.length === 1 ? "" : "s"} for “
            {query}”
          </p>
          <div className="card-grid">
            {results.map((channel) => (
              <ChannelCard
                key={channel.channelId}
                channel={channel}
                actions={
                  <button
                    className={`btn ${savedIds.has(channel.channelId) ? "btn-secondary" : "btn-primary"}`}
                    type="button"
                    disabled={
                      !canSave || savedIds.has(channel.channelId) || pending
                    }
                    aria-label={
                      savedIds.has(channel.channelId)
                        ? `${channel.subName} is saved`
                        : `Save ${channel.subName}`
                    }
                    onClick={() => {
                      setNotice("");
                      save.mutate(channel, {
                        onSuccess: () => setNotice(`${channel.subName} saved.`),
                      });
                    }}
                  >
                    {savedIds.has(channel.channelId)
                      ? "Saved"
                      : save.isPending &&
                          save.variables?.channelId === channel.channelId
                        ? "Saving…"
                        : "Save channel"}
                  </button>
                }
              />
            ))}
          </div>
          {search.hasNextPage ? (
            <div>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={search.isFetching}
                onClick={() => {
                  if (search.hasNextPage && !search.isFetching)
                    void search.fetchNextPage();
                }}
              >
                {search.isFetchingNextPage ? "Loading…" : "Load more channels"}
              </button>
            </div>
          ) : (
            !search.isFetching && (
              <p className="text-sm">
                You’ve reached the end of these results.
              </p>
            )
          )}
        </>
      )}
    </section>
  );
}
