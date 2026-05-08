export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-10">
        <div>
          <p className="text-sm font-semibold text-stone-950">
            Hair Trend Dashboard
          </p>
          <p className="mt-1 text-xs text-stone-500 sm:text-sm">
            美容サロンのトレンド収集と投稿ネタ作成
          </p>
        </div>
        <div className="hidden rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 sm:block">
          Salon MVP
        </div>
      </div>
    </header>
  );
}
