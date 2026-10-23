import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Feedback } from "../../shared/ui/Feedback";
import { useCategories } from "../categories/queries";
import ChannelCard from "./ChannelCard";
import ChannelSearch from "./ChannelSearch";
import { useChannels, useChannelActions } from "./queries";

export default function ChannelsPage() {
  const channels = useChannels();
  const categories = useCategories();
  const { remove, pending } = useChannelActions();
  const [filter, setFilter] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const searchSection = useRef<HTMLDivElement>(null);
  const visibleChannels = [...(channels.data || [])]
    .filter((channel) =>
      channel.subName
        .toLocaleLowerCase()
        .includes(filter.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => a.subName.localeCompare(b.subName));
  function focusSearch() {
    searchSection.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    searchSection.current
      ?.querySelector<HTMLInputElement>("input")
      ?.focus({ preventScroll: true });
  }

  return (
    <section className="page stack" aria-labelledby="channels-heading">
      <header className="page-header">
        <div>
          <p className="eyebrow">Your collection</p>
          <h1 id="channels-heading">Channels</h1>
          <p>
            Keep your favorite channels together, then organize them into
            categories.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={focusSearch}>
          Find channels
        </button>
      </header>
      <p className="text-sm">
        Saving a channel here does not change your YouTube subscriptions.
      </p>
      {notice && <Feedback tone="success">{notice}</Feedback>}
      {remove.isError && (
        <Feedback tone="error">{remove.error.message}</Feedback>
      )}
      <section className="stack" aria-labelledby="saved-channels-title">
        <div className="toolbar">
          <h2 id="saved-channels-title" className="text-2xl font-semibold">
            Saved channels {channels.data ? `(${channels.data.length})` : ""}
          </h2>
          {!!channels.data?.length && (
            <div className="field">
              <label htmlFor="channel-filter" className="field-label">
                Filter saved channels
              </label>
              <input
                id="channel-filter"
                type="search"
                className="input"
                placeholder="Filter by name"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </div>
          )}
        </div>
        {channels.isPending && (
          <Feedback tone="info">Loading your channels…</Feedback>
        )}
        {channels.isError && (
          <Feedback tone="error" onRetry={() => void channels.refetch()}>
            {channels.error.message}
          </Feedback>
        )}
        {channels.isSuccess && channels.data.length === 0 && (
          <EmptyState
            title="Start your collection"
            description="Find a few channels you enjoy, then save them here."
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={focusSearch}
              >
                Find your first channel
              </button>
            }
          />
        )}
        {channels.isSuccess &&
          channels.data.length > 0 &&
          visibleChannels.length === 0 && (
            <EmptyState
              title="No matching saved channels"
              action={
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFilter("")}
                >
                  Clear filter
                </button>
              }
            />
          )}
        <div className="card-grid">
          {visibleChannels.map((channel) => (
            <ChannelCard
              key={channel._id || channel.channelId || channel.subName}
              channel={channel}
              badges={categories.data
                ?.filter((category) =>
                  category.subs.some(
                    (sub) => sub.channelId === channel.channelId,
                  ),
                )
                .map((category) => (
                  <Link
                    className="badge"
                    key={category._id}
                    to={`/ytso/categories/${category._id}`}
                  >
                    {category.categoryName}
                  </Link>
                ))}
              actions={
                confirmId === channel.channelId ? (
                  <div
                    className="stack"
                    role="group"
                    aria-label={`Confirm removal of ${channel.subName}`}
                  >
                    <p className="text-sm">
                      Remove this channel from your saved channels and all
                      categories?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn btn-danger"
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          remove.mutate(channel.channelId, {
                            onSuccess: () => {
                              setConfirmId(null);
                              setNotice(
                                `${channel.subName} removed from your collection.`,
                              );
                            },
                          })
                        }
                      >
                        {remove.isPending ? "Removing…" : "Confirm removal"}
                      </button>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        disabled={pending}
                        onClick={() => setConfirmId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={pending || !channel.channelId}
                    aria-label={`Remove ${channel.subName} from saved channels`}
                    onClick={() => {
                      remove.reset();
                      setNotice("");
                      setConfirmId(channel.channelId);
                    }}
                  >
                    Remove
                  </button>
                )
              }
            />
          ))}
        </div>
        {!!channels.data?.length && (
          <p className="text-sm">
            <Link to="/ytso/categories" className="underline">
              Organize channels into categories
            </Link>{" "}
            to build separate feeds.
          </p>
        )}
      </section>
      <div ref={searchSection} className="scroll-mt-24 border-t pt-8">
        <ChannelSearch
          channels={channels.data || []}
          canSave={channels.isSuccess}
        />
      </div>
    </section>
  );
}
