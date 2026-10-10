// Line icons from the Figma design (24px grid, 1.7 stroke).

export type IconName = "radar" | "people" | "spark" | "arrow" | "lock" | "back" | "check";

export default function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    radar: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 3.5V12l5.8-5.8" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.8 18.5c.4-3.2 2.1-5 5.2-5s4.8 1.8 5.2 5" />
        <path d="M15 5.4a3 3 0 0 1 0 5.4M16 13.2c2.5.4 3.8 2.1 4.1 4.7" />
      </>
    ),
    spark: (
      <>
        <path d="M12 2.8c.6 4.9 2.6 7.1 7.2 7.7-4.6.6-6.6 2.8-7.2 7.7-.6-4.9-2.6-7.1-7.2-7.7C9.4 9.9 11.4 7.7 12 2.8Z" />
        <path d="M19.3 3.2c.2 1.7.9 2.4 2.5 2.6-1.6.2-2.3 1-2.5 2.7-.2-1.7-.9-2.5-2.5-2.7 1.6-.2 2.3-.9 2.5-2.6Z" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    back: <path d="m15 5-7 7 7 7" />,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="3" />
        <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={`icon icon-${name}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
