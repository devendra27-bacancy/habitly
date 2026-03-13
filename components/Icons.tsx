import { PropsWithChildren } from "react";

type IconProps = {
  className?: string;
};

function BaseIcon({ className, children }: PropsWithChildren<IconProps>) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M4 19.5H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 16V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 16V7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 16V9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M5 5.5C8.5 8 10.5 8 13 6.2C14.8 4.9 16.4 4.8 19 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </BaseIcon>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 18.25C7.7 15.8 9.66 14.75 12 14.75C14.34 14.75 16.3 15.8 17.5 18.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="5.25" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
    </BaseIcon>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M8 8L16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 8L8 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}
