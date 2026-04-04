interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="512" height="512" rx="96" fill="#0d9488" />
      <g transform="translate(256, 256)">
        <path d="M -100 -50 L 0 -120 L 100 -50 L 100 -30 L 80 -30 L 80 -45 L 0 -100 L -80 -45 L -80 -30 L -100 -30 Z" fill="#ffffff" />
        <rect x="-80" y="-30" width="160" height="130" rx="4" fill="#ffffff" />
        <rect x="-25" y="40" width="50" height="60" rx="4" fill="#0d9488" />
        <rect x="30" y="0" width="35" height="35" rx="4" fill="#0d9488" />
      </g>
    </svg>
  );
}
