export function Banner({ children }: { children: string }) {
  return (
    <p
      role="status"
      style={{
        margin: 0,
        padding: "0.5rem 0.75rem",
        borderRadius: 10,
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        color: "var(--muted)",
        fontSize: "0.9rem"
      }}
    >
      {children}
    </p>
  );
}
