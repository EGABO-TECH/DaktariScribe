import Image from "next/image";

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  delay?: number;
}

export default function FeatureCard({
  icon,
  title,
  description,
  delay = 0,
}: FeatureCardProps) {
  return (
    <div
      className="glass-card p-4 rounded-2xl flex flex-col gap-2.5 group cursor-default ds-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Icon circle */}
      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-[rgba(77,217,192,0.2)] transition-colors duration-200">
        <span
          className="material-symbols-outlined text-[18px] text-[#4dd9c0]"
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-white text-[13.5px] font-bold leading-snug tracking-tight">
        {title}
      </h3>

      {/* Description */}
      <p className="text-white/70 text-[11.5px] leading-relaxed">{description}</p>
    </div>
  );
}
