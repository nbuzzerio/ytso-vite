import { useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { Category, Channel } from "../../lib/types";
import { EmptyState, Feedback } from "../../shared/ui/Feedback";
import ChannelCard from "../channels/ChannelCard";
import { useChannels } from "../channels/queries";
import CategoryFeed from "./CategoryFeed";
import { useCategory, useCategoryChannels } from "./queries";

function CategoryContent({ category }: { category: Category }) {
  const channels = useChannels();
  const { add, remove, pending } = useCategoryChannels(category._id);
  const [tab, setTab] = useState<"feed" | "channels">("feed");
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [removed, setRemoved] = useState<Channel | null>(null);
  const addPanel = useRef<HTMLElement>(null);
  const available = [...(channels.data || [])]
    .filter(
      (channel) =>
        !!channel.channelId &&
        !category.subs.some((sub) => sub.channelId === channel.channelId) &&
        channel.subName
          .toLocaleLowerCase()
          .includes(filter.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => a.subName.localeCompare(b.subName));

  function openAdd() {
    setTab("channels");
    setShowAdd(true);
    window.requestAnimationFrame(() => {
      addPanel.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      addPanel.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus({ preventScroll: true });
    });
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Category</p>
          <h1>{category.categoryName}</h1>
          <p>
            {category.subs.length} channel
            {category.subs.length === 1 ? "" : "s"} in this collection
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={openAdd}>
          Add channels
        </button>
      </header>
      {notice && (
        <Feedback tone="success">
          {notice}
          {removed && (
            <button
              className="ml-3 font-semibold underline"
              type="button"
              disabled={pending}
              onClick={() =>
                add.mutate(removed, {
                  onSuccess: () => {
                    setNotice(`${removed.subName} restored to this category.`);
                    setRemoved(null);
                  },
                })
              }
            >
              {add.isPending ? "Restoring…" : "Undo"}
            </button>
          )}
        </Feedback>
      )}
      {add.isError && <Feedback tone="error">{add.error.message}</Feedback>}
      {remove.isError && (
        <Feedback tone="error">{remove.error.message}</Feedback>
      )}
      <div className="tabs" role="group" aria-label="Category view">
        <button
          type="button"
          className={`btn ${tab === "feed" ? "btn-primary" : "btn-secondary"}`}
          aria-pressed={tab === "feed"}
          onClick={() => setTab("feed")}
        >
          Feed
        </button>
        <button
          type="button"
          className={`btn ${tab === "channels" ? "btn-primary" : "btn-secondary"}`}
          aria-pressed={tab === "channels"}
          onClick={() => setTab("channels")}
        >
          Channels ({category.subs.length})
        </button>
      </div>
      {tab === "feed" ? (
        <CategoryFeed channels={category.subs} onAddChannels={openAdd} />
      ) : (
        <div className="stack">
          <section className="stack" aria-labelledby="category-channels-title">
            <div>
              <h2
                id="category-channels-title"
                className="text-2xl font-semibold"
              >
                Channels in this category
              </h2>
              <p className="text-sm">
                Removing a channel here keeps it in your saved collection.
              </p>
            </div>
            {category.subs.length === 0 && (
              <EmptyState
                title="No channels here yet"
                description="Add some of your saved channels to bring this category to life."
                action={
                  !showAdd ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={openAdd}
                    >
                      Add channels
                    </button>
                  ) : undefined
                }
              />
            )}
            <div className="card-grid">
              {[...category.subs]
                .sort((a, b) => a.subName.localeCompare(b.subName))
                .map((channel) => (
                  <ChannelCard
                    key={channel._id || channel.channelId || channel.subName}
                    channel={channel}
                    actions={
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={pending || !channel.channelId}
                        aria-label={`Remove ${channel.subName} from this category`}
                        onClick={() => {
                          add.reset();
                          setNotice("");
                          setRemoved(null);
                          remove.mutate(channel, {
                            onSuccess: () => {
                              setNotice(
                                `${channel.subName} removed from this category.`,
                              );
                              setRemoved(channel);
                            },
                          });
                        }}
                      >
                        {remove.isPending &&
                        remove.variables?.channelId === channel.channelId
                          ? "Removing…"
                          : "Remove from category"}
                      </button>
                    }
                  />
                ))}
            </div>
          </section>
          {showAdd && (
            <section
              className="panel stack scroll-mt-24"
              ref={addPanel}
              aria-labelledby="add-channels-title"
            >
              <div className="toolbar">
                <div>
                  <h2
                    id="add-channels-title"
                    className="text-2xl font-semibold"
                  >
                    Add saved channels
                  </h2>
                  <p className="text-sm">
                    A channel can belong to more than one category.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAdd(false)}
                >
                  Close
                </button>
              </div>
              {channels.isPending && (
                <Feedback tone="info">Loading your saved channels…</Feedback>
              )}
              {channels.isError && (
                <Feedback tone="error" onRetry={() => void channels.refetch()}>
                  {channels.error.message}
                </Feedback>
              )}
              {!!channels.data?.length && (
                <div className="field">
                  <label htmlFor="add-channel-filter" className="field-label">
                    Filter saved channels
                  </label>
                  <input
                    id="add-channel-filter"
                    type="search"
                    className="input"
                    value={filter}
                    placeholder="Filter by name"
                    onChange={(event) => setFilter(event.target.value)}
                  />
                </div>
              )}
              {channels.isSuccess && available.length === 0 && (
                <EmptyState
                  title={
                    filter
                      ? "No matching channels"
                      : channels.data.length
                        ? "All saved channels are already here"
                        : "Save some channels first"
                  }
                  description={
                    filter
                      ? "Try a different name or clear the filter."
                      : "Find more channels to expand your collection."
                  }
                  action={
                    filter ? (
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => setFilter("")}
                      >
                        Clear filter
                      </button>
                    ) : (
                      <Link className="btn btn-primary" to="/ytso/channels">
                        Find channels
                      </Link>
                    )
                  }
                />
              )}
              <div className="card-grid">
                {available.map((channel) => (
                  <ChannelCard
                    key={channel.channelId}
                    channel={channel}
                    actions={
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={pending}
                        aria-label={`Add ${channel.subName} to this category`}
                        onClick={() => {
                          remove.reset();
                          setNotice("");
                          setRemoved(null);
                          add.mutate(channel, {
                            onSuccess: () =>
                              setNotice(
                                `${channel.subName} added to this category.`,
                              ),
                          });
                        }}
                      >
                        {add.isPending &&
                        add.variables?.channelId === channel.channelId
                          ? "Adding…"
                          : "Add to category"}
                      </button>
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

export default function CategoryPage() {
  const params = useParams<{ categoryId: string }>();
  const [search] = useSearchParams();
  const id = search.get("id") || params.categoryId || "";
  const category = useCategory(id);
  return (
    <div className="page stack">
      <nav aria-label="Breadcrumb">
        <Link to="/ytso/categories" className="text-sm font-semibold underline">
          ← All categories
        </Link>
      </nav>
      {!id ? (
        <EmptyState
          title="Choose a category"
          description="Open one of your categories to see its channels and feed."
          action={
            <Link to="/ytso/categories" className="btn btn-primary">
              View categories
            </Link>
          }
        />
      ) : category.isPending ? (
        <Feedback tone="info">Loading your category…</Feedback>
      ) : category.isError ? (
        <Feedback tone="error" onRetry={() => void category.refetch()}>
          {category.error.message}
        </Feedback>
      ) : (
        category.data && <CategoryContent key={id} category={category.data} />
      )}
    </div>
  );
}
