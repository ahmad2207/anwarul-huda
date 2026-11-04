// A light placeholder while a member page loads on a slow connection.
export default function AccountLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <div className="h-8 w-56 animate-pulse rounded-[14px] bg-paper-dim motion-reduce:animate-none" />
      <div className="h-40 w-full animate-pulse rounded-[14px] bg-navy-900/15 motion-reduce:animate-none" />
      {[0, 1].map((key) => (
        <div key={key} className="h-20 w-full animate-pulse rounded-[14px] bg-card shadow-warm motion-reduce:animate-none" />
      ))}
    </div>
  );
}
