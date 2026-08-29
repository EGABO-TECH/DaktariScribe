import HeroSection from "@/components/landing/HeroSection";
import LoginSection from "@/components/landing/LoginSection";
import LandingFooter from "@/components/landing/LandingFooter";

/**
 * DaktariScribe Landing Page
 *
 * Mobile / Tablet  — stacked single column: Hero → Login
 * Desktop (lg+)    — full-viewport split screen, side by side
 *
 * The page is min-h-screen with flex-col so the footer sits at the bottom.
 * On mobile the two sections stack naturally without forcing 200 vh of scroll.
 */
export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Main Split ── */}
      <main className="flex flex-grow flex-col lg:flex-row">
        {/* LEFT / TOP — Brand + Features */}
        <HeroSection />

        {/* RIGHT / BOTTOM — Sign In */}
        <LoginSection />
      </main>

      {/* ── Footer ── */}
      <LandingFooter />
    </div>
  );
}
