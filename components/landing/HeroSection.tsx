import Image from "next/image";
import { CheckIcon, KeyboardIcon, MicIcon, ShieldIcon, SignIcon, UploadIcon, WifiOffIcon } from "@/components/ui/Icons";

/**
 * Landing hero. Brief and clinical: one claim, how capture works, and a small preview of the
 * actual output (a signed field report whose values trace back to the original note).
 * Solid brand navy, no gradients, glass, glows or entrance animations. Icons are inline SVG
 * so nothing flashes while fonts load.
 */

const CAPTURE = [
  { Icon: KeyboardIcon, label: "Type" },
  { Icon: MicIcon, label: "Record" },
  { Icon: UploadIcon, label: "Upload a photo" },
];

const TRUST = [
  { Icon: WifiOffIcon, label: "Works offline" },
  { Icon: ShieldIcon, label: "Encrypted on the device" },
  { Icon: SignIcon, label: "You sign off every report" },
];

function ReportPreview() {
  const rows: [string, string, boolean][] = [
    ["Temperature", "38.5 °C", true],
    ["Malaria RDT", "Positive", true],
    ["Blood pressure", "Not recorded", false],
  ];
  return (
    <figure className="w-full max-w-[400px] rounded-lg bg-white text-[#171c1f] shadow-[0_24px_48px_-24px_rgba(0,0,0,0.6)]" aria-label="Example of a signed field report">
      <div className="flex items-center justify-between border-b-2 border-[#001d3d] px-5 pb-3 pt-4">
        <div>
          <p className="text-[13px] font-bold text-[#001d3d]">Clinical Field Report</p>
          <p className="font-label-status text-[11px] text-[#43474f]">DS-2026-14-08-K7QH3MZD-9TRA</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#d7f5ee] px-2 py-0.5 text-[11px] font-semibold text-[#00382f]">
          <CheckIcon size={13} strokeWidth={2.4} /> Final
        </span>
      </div>
      <dl className="px-5 py-3 text-[13px]">
        {rows.map(([k, v, recorded]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-[#e5e9ec] py-2 last:border-0">
            <dt className="text-[#43474f]">{k}</dt>
            <dd className={recorded ? "font-semibold" : "italic text-[#5c6068]"}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mx-5 mb-4 rounded-md border-l-[3px] border-[#006b5c] bg-[#f0f4f7] px-3 py-2 text-[12px] leading-5 text-[#43474f]">
        From the original note: <span className="font-semibold text-[#171c1f]">&ldquo;temp 38.5, mRDT positive&rdquo;</span>
      </div>
      <figcaption className="flex items-center justify-between border-t border-[#e5e9ec] px-5 py-3 text-[12px] text-[#43474f]">
        <span>Signed off by the clinician</span>
        <span className="font-label-status">14 Aug 2026</span>
      </figcaption>
    </figure>
  );
}

export default function HeroSection() {
  return (
    <section
      className="relative flex w-full flex-col justify-center bg-[#001d3d] px-6 py-12 text-white sm:px-10 lg:min-h-screen lg:w-1/2 lg:px-14 lg:py-16"
      aria-labelledby="hero-title"
    >
      {/* Single accent rule: the only decoration */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[#44ddc1]" />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 lg:mx-0">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white p-1">
            <Image src="/assets/report-mark.png" alt="" width={32} height={32} priority />
          </span>
          <span className="font-display-lg text-[18px] font-bold tracking-tight">DaktariScribe</span>
        </div>

        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#44ddc1]">For frontline health teams</p>
          <h1 id="hero-title" className="mt-3 font-display-lg text-[34px] font-bold leading-[1.1] tracking-tight sm:text-[44px] xl:text-[52px]">
            Field notes to finished reports.
          </h1>
          <p className="mt-4 max-w-md text-[17px] leading-7 text-white/80">
            Capture an encounter in the field, review a clean record against your own words, and share a signed report, even with weak internet.
          </p>
        </div>

        {/* How capture works: a plain list, not button-like pills (they are not clickable). */}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] font-medium text-white" aria-label="Ways to capture">
          {CAPTURE.map(({ Icon, label }, i) => (
            <span key={label} className="inline-flex items-center gap-2">
              {i > 0 && <span aria-hidden="true" className="mr-2 h-4 w-px bg-white/25" />}
              <Icon size={18} className="text-[#44ddc1]" />
              {label}
            </span>
          ))}
        </p>

        <div className="hidden sm:block">
          <ReportPreview />
        </div>

        <ul className="flex flex-col gap-2.5 border-t border-white/15 pt-6 text-[14px] text-white/85 sm:flex-row sm:flex-wrap sm:gap-x-6" aria-label="Safeguards">
          {TRUST.map(({ Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-2">
              <Icon size={18} className="text-[#44ddc1]" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
