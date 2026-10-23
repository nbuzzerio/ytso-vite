import { Link } from "react-router-dom";
import { useSession } from "../features/auth/auth-context";
import { useChannels } from "../features/channels/queries";
import { useCategories } from "../features/categories/queries";
import { EmptyState, Feedback } from "../shared/ui/Feedback";

export default function LibraryOverview() {
  const { name } = useSession();
  const channels = useChannels();
  const categories = useCategories();
  const sorted = [...(categories.data ?? [])].sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName),
  );
  return (
    <section className="page stack" aria-labelledby="library-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {name ? `Welcome back, ${name}` : "Welcome back"}
          </p>
          <h1 id="library-title">Your library</h1>
          <p>
            A little space for your interests. Pick a category and catch up.
          </p>
        </div>
        <Link className="btn btn-primary" to="/ytso/channels">
          Find channels
        </Link>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link className="panel library-stat" to="/ytso/channels">
          <span className="eyebrow">Saved channels</span>
          <strong>{channels.isSuccess ? channels.data.length : "—"}</strong>
          <span>
            Browse your collection <span aria-hidden="true">→</span>
          </span>
        </Link>
        <Link className="panel library-stat" to="/ytso/categories">
          <span className="eyebrow">Categories</span>
          <strong>{categories.isSuccess ? categories.data.length : "—"}</strong>
          <span>
            Organize your interests <span aria-hidden="true">→</span>
          </span>
        </Link>
      </div>
      {channels.isError && (
        <Feedback tone="error" onRetry={() => void channels.refetch()}>
          {channels.error.message}
        </Feedback>
      )}
      {categories.isPending && <Feedback>Loading your categories…</Feedback>}
      {categories.isError && (
        <Feedback tone="error" onRetry={() => void categories.refetch()}>
          {categories.error.message}
        </Feedback>
      )}
      {categories.isSuccess && !sorted.length && (
        <EmptyState
          title="Make yourself at home"
          description="Start with a few favorite channels, then create categories for the things you love."
          action={
            <div className="toolbar justify-center">
              <Link className="btn btn-primary" to="/ytso/channels">
                Save your first channels
              </Link>
              <Link className="btn btn-secondary" to="/ytso/categories">
                Create a category
              </Link>
            </div>
          }
        />
      )}
      {!!sorted.length && (
        <section className="stack" aria-labelledby="library-categories">
          <div className="toolbar justify-between">
            <h2 id="library-categories">Pick a category</h2>
            <Link
              className="text-sm font-semibold underline"
              to="/ytso/categories"
            >
              Manage categories
            </Link>
          </div>
          <div className="card-grid">
            {sorted.slice(0, 6).map((category) => (
              <Link
                key={category._id}
                to={`/ytso/categories/${category._id}`}
                className="panel category-preview"
              >
                <span className="folder-mark" aria-hidden="true" />
                <h3>{category.categoryName}</h3>
                <p>
                  {category.subs.length}{" "}
                  {category.subs.length === 1 ? "channel" : "channels"}
                </p>
                <span className="text-sm font-semibold">
                  Open feed <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
