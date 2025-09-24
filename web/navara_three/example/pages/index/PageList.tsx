import type React from "react";

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  overflow: "hidden",
  textDecoration: "none",
  color: "inherit",
  background: "#fff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const imgStyle: React.CSSProperties = {
  width: "100%",
  height: 150,
  objectFit: "cover",
  background: "#f3f4f6",
  display: "block",
};

const titleStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 14,
  borderTop: "1px solid #f3f4f6",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 16,
};

const pageStyle: React.CSSProperties = {
  height: "100vh",
  overflow: "auto",
  boxSizing: "border-box",
  padding: 16,
  background: "#fafafa",
};

const headerStyle: React.CSSProperties = {
  margin: "0 0 12px 0",
  fontSize: 18,
  fontWeight: "bold",
};

export const PageList = () => {
  const pages = (PAGES || [])
    .filter((p) => p !== "index")
    .sort((a, b) => a.localeCompare(b));

  return (
    <div style={pageStyle}>
      <h1 style={headerStyle}>Examples</h1>
      <div style={gridStyle}>
        {pages.map((p) => {
          const href = `/${p}`;
          const src = `/screenshots/${p}.png`;
          const title = p.replace(/-/g, " ");
          return (
            <a
              key={p}
              href={href}
              style={cardStyle}
              aria-label={`Open ${title}`}
            >
              <img
                src={src}
                style={imgStyle}
                alt={title}
                onError={(e) => {
                  const t = e.currentTarget as HTMLImageElement;
                  t.style.opacity = "0.3";
                }}
              />
              <div style={titleStyle}>{title}</div>
            </a>
          );
        })}
      </div>
    </div>
  );
};
