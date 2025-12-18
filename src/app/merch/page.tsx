export default function MerchPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-4xl font-bold">4th Line Merch</h1>
        <p className="mt-2 text-slate-600">
          You’re shopping our official store.
        </p>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-10">
        <div className="h-[80vh] w-full overflow-hidden rounded-xl border">
          <iframe
            src="https://shop.4thlinefantasy.com/"
            title="4th Line Fantasy Shop"
            className="h-full w-full"
            loading="lazy"
          />
        </div>

        <div className="mt-4 text-sm text-slate-600">
          If the store doesn’t load here,{" "}
          <a
            href="https://shop.4thlinefantasy.com/"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            open it in a new tab
          </a>
          .
        </div>
      </div>
    </main>
  );
}
