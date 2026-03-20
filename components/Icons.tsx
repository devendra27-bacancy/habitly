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

export function CalendarIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3.75V7.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 3.75V7.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4.5 9.25H19.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <path d="M8 12.75H8.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12.75H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 12.75H16.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path
        d="M8 10.25C8 8.04 9.79 6.25 12 6.25C14.21 6.25 16 8.04 16 10.25V13.45C16 14.06 16.24 14.65 16.67 15.08L17.5 15.91C17.81 16.22 17.59 16.75 17.15 16.75H6.85C6.41 16.75 6.19 16.22 6.5 15.91L7.33 15.08C7.76 14.65 8 14.06 8 13.45V10.25Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10.25 18C10.58 18.58 11.21 18.95 12 18.95C12.79 18.95 13.42 18.58 13.75 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 4.6V5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </BaseIcon>
  );
}
