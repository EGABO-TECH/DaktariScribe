import HeroSection from "@/components/landing/HeroSection";
import LoginSection from "@/components/landing/LoginSection";
import LandingFooter from "@/components/landing/LandingFooter";

/**
 * DaktariScribe Landing Page — Desktop View
 *
 * Layout: full-viewport split screen
 *   Left  (50%) — Hero / brand narrative + feature grid (dark, navy/teal gradient over hero photo)
 *   Right (50%) — Login card (light teal surface)
 *
 * The entire page is min-h-screen with flex-col so the footer
 * always sits at the bottom.
 */
export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Main Split ── */}
      <main className="flex flex-grow flex-col lg:flex-row">
        {/* LEFT — Brand + Features */}
        <HeroSection />

        {/* RIGHT — Sign In */}
        <LoginSection />
      </main>

      {/* ── Footer ── */}
      <LandingFooter />
    </div>
  );
}
