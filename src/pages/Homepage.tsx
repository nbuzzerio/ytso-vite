import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/auth-context";

const LibraryOverview = lazy(() => import("../app/LibraryOverview"));

export default function Homepage() {
  const auth = useAuth();
  if (auth)
    return (
      <Suspense
        fallback={
          <div className="page" role="status">
            Loading your library…
          </div>
        }
      >
        <LibraryOverview />
      </Suspense>
    );
  return (
    <div className="page home-page">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">YouTube Subscription Organizer</p>
          <h1>
            Good channels.
            <br />
            <span>A place for each.</span>
          </h1>
          <p className="hero-description">
            Keep the channels you love together. Sort them into your own
            categories and catch up on what matters to you.
          </p>
          <div className="toolbar">
            <Link className="btn btn-primary" to="/ytso/login?signup=true">
              Get started
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="btn btn-secondary" to="/ytso/login">
              I already have an account
            </Link>
          </div>
          <p className="hero-note">
            Your personal library. No changes to your YouTube subscriptions.
          </p>
        </div>
        <div
          className="organizer-preview"
          aria-label="Example categories: Learn something, Make something, and Just for fun"
        >
          <div className="preview-label">
            <span className="status-dot" />A little order for your interests
          </div>
          {[
            {
              title: "Learn something",
              note: "Curiosity, collected",
              count: "06",
              style: "preview-learn",
            },
            {
              title: "Make something",
              note: "Your next spark of inspiration",
              count: "04",
              style: "preview-make",
            },
            {
              title: "Just for fun",
              note: "Because you deserve a break",
              count: "08",
              style: "preview-fun",
            },
          ].map((category) => (
            <div
              className={`preview-category ${category.style}`}
              key={category.title}
            >
              <span className="folder-mark" aria-hidden="true" />
              <div>
                <h2>{category.title}</h2>
                <p>{category.note}</p>
              </div>
              <span className="preview-count">{category.count}</span>
            </div>
          ))}
          <p className="preview-footer">
            Example categories. Make yours your own.
          </p>
        </div>
      </section>
      <section className="how-it-works" aria-label="How it works">
        {[
          {
            number: "01",
            title: "Find your favorites",
            text: "Search YouTube and save the channels worth coming back to.",
          },
          {
            number: "02",
            title: "Give them a home",
            text: "Create categories for your interests, projects, and moods.",
          },
          {
            number: "03",
            title: "Catch up with purpose",
            text: "See recent videos from the channels in each category.",
          },
        ].map((step) => (
          <div key={step.number}>
            <span className="step-number">{step.number}</span>
            <h2>{step.title}</h2>
            <p>{step.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
