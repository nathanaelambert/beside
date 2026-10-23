"use client";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="loading">
      <h1>The experiment could not open</h1>
      <p>
        Try loading the view again. Your browser’s stored data has not been
        reset.
      </p>
      <button className="button primary" onClick={retry}>
        Try again
      </button>
    </main>
  );
}
