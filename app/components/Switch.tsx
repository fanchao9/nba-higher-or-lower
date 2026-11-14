"use client";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  size?: "sm" | "md";
};

export default function Switch({
  checked,
  onChange,
  size = "md",
  ...aria
}: SwitchProps) {
  const small = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      {...aria}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        small ? "h-5 w-9" : "h-7 w-12"
      } ${checked ? "bg-accent" : "bg-border"}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 rounded-full bg-surface-raised shadow transition-transform ${
          small ? "size-4" : "size-6"
        } ${checked ? (small ? "translate-x-4" : "translate-x-5") : ""}`}
      />
    </button>
  );
}
