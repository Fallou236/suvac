type Props = {
  taille?: number;
  fond?: "sombre" | "clair";
  className?: string;
};

export function Logo({ taille = 24, fond = "sombre", className }: Props) {
  const plein = fond === "sombre" ? "#FFFFFF" : "#14432E";
  const contour = fond === "sombre" ? "#D9924F" : "#8E4A1E";

  return (
    <svg
      viewBox="0 0 48 48"
      width={taille}
      height={taille}
      className={className}
      aria-hidden="true"
    >
      <g transform="translate(1.5,1.5)">
        <rect width="20" height="20" rx="5" fill={plein} />
        <rect x="25" width="20" height="20" rx="5" fill={plein} />
        <rect y="25" width="20" height="20" rx="5" fill={plein} />
        <rect
          x="26.5" y="26.5" width="17" height="17" rx="3.8"
          fill="none" stroke={contour} strokeWidth="3"
        />
      </g>
    </svg>
  );
}
