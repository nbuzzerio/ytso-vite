import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Feedback } from "../../shared/ui/Feedback";
import CategoryForm from "./CategoryForm";
import { useCategories, useCategoryActions } from "./queries";

export default function CategoriesPage() {
  const categories = useCategories();
  const { create, rename, remove, pending } = useCategoryActions();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const sorted = [...(categories.data || [])].sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName),
  );

  return (
    <section className="page stack" aria-labelledby="categories-heading">
      <header className="page-header">
        <div>
          <p className="eyebrow">Make room for your interests</p>
          <h1 id="categories-heading">Categories</h1>
          <p>
            Group your channels by topic, mood, or whatever makes sense to you.
            Each category has its own video feed.
          </p>
        </div>
      </header>
      {notice && <Feedback tone="success">{notice}</Feedback>}
      {categories.isPending && (
        <Feedback tone="info">Loading your categories…</Feedback>
      )}
      {categories.isError && (
        <Feedback tone="error" onRetry={() => void categories.refetch()}>
          {categories.error.message}
        </Feedback>
      )}
      {remove.isError && (
        <Feedback tone="error">{remove.error.message}</Feedback>
      )}
      {categories.isSuccess && categories.data.length === 0 && (
        <EmptyState
          title="A place for every interest"
          description="Create your first category below, then add channels from your collection."
        />
      )}
      {sorted.length > 0 && (
        <section className="stack" aria-labelledby="categories-title">
          <h2 id="categories-title" className="text-2xl font-semibold">
            Your categories ({sorted.length})
          </h2>
          <div className="card-grid">
            {sorted.map((category) => (
              <article className="panel stack" key={category._id}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="break-words text-xl font-semibold">
                    <Link
                      className="hover:underline"
                      to={`/ytso/categories/${category._id}`}
                    >
                      {category.categoryName}
                    </Link>
                  </h3>
                  <span className="badge shrink-0">
                    {category.subs.length} channel
                    {category.subs.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-sm">
                  {category.subs.length
                    ? category.subs
                        .slice(0, 3)
                        .map((channel) => channel.subName)
                        .join(" · ") +
                      (category.subs.length > 3
                        ? ` · +${category.subs.length - 3} more`
                        : "")
                    : "Add channels to start this feed."}
                </p>
                {editingId === category._id ? (
                  <>
                    {rename.isError && (
                      <Feedback tone="error">{rename.error.message}</Feedback>
                    )}
                    <CategoryForm
                      initialName={category.categoryName}
                      existingNames={sorted
                        .filter((item) => item._id !== category._id)
                        .map((item) => item.categoryName)}
                      submitLabel="Save name"
                      pending={rename.isPending}
                      disabled={pending}
                      onCancel={() => setEditingId(null)}
                      onSubmit={async (categoryName) => {
                        await rename.mutateAsync({
                          categoryId: category._id,
                          categoryName,
                        });
                        setEditingId(null);
                        setNotice("Category renamed.");
                      }}
                    />
                  </>
                ) : deletingId === category._id ? (
                  <div
                    className="stack"
                    role="group"
                    aria-label={`Confirm deletion of ${category.categoryName}`}
                  >
                    <p className="text-sm">
                      Delete “{category.categoryName}”? Saved channels will stay
                      in your collection.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={pending}
                        onClick={() =>
                          remove.mutate(category._id, {
                            onSuccess: () => {
                              setDeletingId(null);
                              setNotice(`“${category.categoryName}” deleted.`);
                            },
                          })
                        }
                      >
                        {remove.isPending ? "Deleting…" : "Delete category"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={pending}
                        onClick={() => setDeletingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Link
                      className="btn btn-primary"
                      to={`/ytso/categories/${category._id}`}
                    >
                      Open category
                    </Link>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={pending}
                      aria-label={`Rename ${category.categoryName}`}
                      onClick={() => {
                        setEditingId(category._id);
                        setDeletingId(null);
                        setNotice("");
                        rename.reset();
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={pending}
                      aria-label={`Delete ${category.categoryName}`}
                      onClick={() => {
                        setDeletingId(category._id);
                        setEditingId(null);
                        setNotice("");
                        remove.reset();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      <section
        className="panel stack max-w-2xl"
        aria-labelledby="create-category-title"
      >
        <div>
          <h2 id="create-category-title" className="text-2xl font-semibold">
            Create a category
          </h2>
          <p className="text-sm">Choose a short name you’ll recognize later.</p>
        </div>
        {create.isError && (
          <Feedback tone="error">{create.error.message}</Feedback>
        )}
        <CategoryForm
          existingNames={sorted.map((category) => category.categoryName)}
          submitLabel="Create category"
          pending={create.isPending}
          disabled={!categories.isSuccess || pending}
          onSubmit={async (name) => {
            setNotice("");
            await create.mutateAsync(name);
            setNotice(`“${name}” created. Open it to add channels.`);
          }}
        />
      </section>
    </section>
  );
}
