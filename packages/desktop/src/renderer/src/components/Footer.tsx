export function Footer() {
  return (
    <footer className="shrink-0 border-t bg-background px-6 py-3 text-center text-sm text-muted-foreground">
      {/*  © {new Date().getFullYear()} Perf Appraisal */}
      <div className="flex items-center justify-end">
        <p> © {new Date().getFullYear()} Information Systems Department</p>
      </div>
    </footer>
  );
}
