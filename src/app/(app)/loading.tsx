export default function Loading() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="h-8 w-56 animate-pulse rounded-lg bg-line/70" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-card bg-white" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-card bg-white" />
    </div>
  );
}
