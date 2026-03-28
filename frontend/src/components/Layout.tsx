import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2rem",
          padding: "0.75rem 1.5rem",
          borderBottom: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "1.25rem" }}>Mella</span>
        <Link
          to="/"
          style={{
            textDecoration: "none",
            color: location.pathname === "/" ? "#2563eb" : "#64748b",
            fontWeight: location.pathname === "/" ? 600 : 400,
          }}
        >
          Traces
        </Link>
        <Link
          to="/personas"
          style={{
            textDecoration: "none",
            color: location.pathname === "/personas" ? "#2563eb" : "#64748b",
            fontWeight: location.pathname === "/personas" ? 600 : 400,
          }}
        >
          Personas
        </Link>
      </nav>
      <main style={{ flex: 1, padding: "1.5rem" }}>
        <Outlet />
      </main>
    </div>
  );
}
