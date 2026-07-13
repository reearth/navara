type PageListProps = {
  pages: PageInfo[];
};

export const PageList = ({ pages }: PageListProps) => {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-5 gap-y-8">
      {pages.map((page) => {
        // Convert nested path to URL-safe format: "styling/geojson-billboard" -> "styling-geojson-billboard".
        // A trailing "/index" collapses to its parent so "dev/index" -> "dev" (kept in sync with vite.config.example.ts).
        const urlName = page.name.replace(/\/index$/, "").replace(/\//g, "-");
        const href = `/${urlName}`;
        const src = `/screenshots/${urlName}.avif`;
        const title = page.displayName.replace(/-/g, " ");
        return (
          <a
            key={page.name}
            href={href}
            aria-label={`Open ${title}`}
            className="group block no-underline"
          >
            {/* Flat tile: bordered thumbnail with a plain label below. */}
            <div className="overflow-hidden rounded-lg border bg-muted">
              <img
                src={src}
                alt={title}
                className="block aspect-[16/10] w-full object-cover transition-opacity group-hover:opacity-90"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                }}
              />
            </div>
            <h3 className="mt-3 text-sm font-medium capitalize">{title}</h3>
          </a>
        );
      })}
    </div>
  );
};
