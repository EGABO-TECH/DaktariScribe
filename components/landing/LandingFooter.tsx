import Link from "next/link";

const FOOTER_LINKS = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Compliance", href: "/legal/compliance" },
  { label: "Security", href: "/legal/security" },
];

export default function LandingFooter() {
  return (
    <footer
      className="
        w-full px-8 md:px-12 py-5
        flex flex-col md:flex-row justify-between items-center gap-3
        bg-white border-t border-[#d0e8e4]
      "
      role="contentinfo"
    >
      {/* Brand name */}
      <div className="flex items-center gap-2">
        <span
          className="text-[17px] font-black tracking-[0.18em] uppercase"
          style={{
            background: "linear-gradient(90deg, #0d2240 0%, #00b896 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          DaktariScribe
        </span>
        <span className="text-[#d0e8e4] font-thin select-none">|</span>
        <span className="text-[9px] font-semibold tracking-[0.16em] uppercase text-[#8fafc0]">
          Clinical Intelligence
        </span>
      </div>

      {/* Copyright */}
      <p className="text-[10px] uppercase tracking-widest text-[#8fafc0] text-center max-w-xs">
        © 2026 DaktariScribe Clinical Pharma Network. All rights reserved.
      </p>

      {/* Links */}
      <nav aria-label="Footer links" className="flex flex-row gap-6 flex-shrink-0">
        {FOOTER_LINKS.map(({ label, href }) => (
          <Link
            key={label}
            href={href}
            className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#3d5a73] hover:text-[#00b896] transition-colors duration-200"
          >
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
