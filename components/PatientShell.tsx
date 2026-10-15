import Link from "next/link";
import type { Brand } from "@/lib/brand";

interface Props {
  brand: Brand;
  title: string;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Mobile-first frame: facility logo, navy header, content column. */
export default function PatientShell({ brand, title, subtitle, eyebrow, backHref, backLabel = "Back", children, footer }: Props) {
  const vars = {
    "--accent": brand.accent,
    "--accent-strong": brand.accentStrong,
    "--accent-on-navy": brand.accentOnNavy,
  } as React.CSSProperties;
  return (
    <div className="p-wrap" style={vars}>
      <div className="logo-bar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brand.logo} alt={brand.logoAlt} />
      </div>
      <header className="p-header">
        {backHref ? (
          <Link href={backHref} className="back-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {backLabel}
          </Link>
        ) : null}
        {eyebrow ? <span className="eyebrow-navy">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <main className="p-main">{children}</main>
      {footer ? <footer className="p-footer">{footer}</footer> : null}
    </div>
  );
}

export function CrisisNote() {
  return (
    <p className="crisis">
      If you are in crisis or thinking about harming yourself, call or text <a href="tel:988">988</a> (Suicide &amp; Crisis
      Lifeline), call 911, or call your clinic.
    </p>
  );
}
