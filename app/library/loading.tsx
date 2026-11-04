// A light placeholder while a Books page loads on a slow connection.
export default function LibraryLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <div className="h-8 w-40 animate-pulse rounded-[14px] bg-paper-dim motion-reduce:animate-none" />
      <div className="h-12 w-full animate-pulse rounded-[14px] bg-paper-dim motion-reduce:animate-none" />
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-28 w-full animate-pulse rounded-[14px] bg-card shadow-warm motion-reduce:animate-none" />
      ))}
    </div>
  );
}
