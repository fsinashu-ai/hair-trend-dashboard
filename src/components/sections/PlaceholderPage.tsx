type PlaceholderPageProps = {
  title: string;
  description: string;
  editHint: string;
};

export function PlaceholderPage({
  title,
  description,
  editHint,
}: PlaceholderPageProps) {
  return (
    <main className="mx-auto w-full max-w-4xl px-0 py-6">
      <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-teal-700">準備中の画面</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-stone-950">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
          {description}
        </p>
        <div className="mt-6 rounded-md bg-stone-50 p-4">
          <p className="text-sm text-stone-500">編集するファイル</p>
          <code className="mt-2 block text-sm font-semibold text-teal-700">
            {editHint}
          </code>
        </div>
      </section>
    </main>
  );
}
