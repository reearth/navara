import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PageListProps = {
  pages: string[];
};

export const PageList = ({ pages }: PageListProps) => {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {pages.map((p) => {
        const href = `/${p}`;
        const src = `/screenshots/${p}.png`;
        const title = p.replace(/-/g, " ");
        return (
          <a key={p} href={href} aria-label={`Open ${title}`} className="no-underline">
            <Card className="overflow-hidden transition-colors hover:bg-accent">
              <CardContent className="p-0">
                <img
                  src={src}
                  alt={title}
                  className="block h-[150px] w-full object-cover bg-muted"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                  }}
                />
              </CardContent>
              <CardHeader className="border-t p-3">
                <CardTitle className="text-sm font-medium capitalize">{title}</CardTitle>
              </CardHeader>
            </Card>
          </a>
        );
      })}
    </div>
  );
};
