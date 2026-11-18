export function PageHeader({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="border-b border-border bg-secondary/70">
      <div className="container flex flex-col gap-3 py-14 md:flex-row md:items-end md:justify-between md:py-20">
        <div>
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="text-6xl leading-[0.92] md:text-8xl">{title}</h1>
          {subtitle && <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
