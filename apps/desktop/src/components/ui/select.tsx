import { forwardRef } from "react";
import * as RSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

/**
 * Themed replacement for the native <select>.
 *
 * Native menus can't be styled, and the default trigger looks out of place next
 * to the rest of the app — this wraps Radix Select with the product's tokens.
 *
 * Empty-string values are supported (mapped to an internal sentinel, because
 * Radix reserves "" for "no selection").
 */

const EMPTY_VALUE = "__rm_empty__";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "value" | "onChange" | "disabled" | "className" | "id" | "children"
  > {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown when `value` doesn't match any option */
  placeholder?: string;
  size?: "sm" | "md";
  /** "plain" drops the default surface so callers can supply their own look */
  variant?: "default" | "plain";
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerRef?: React.Ref<HTMLButtonElement>;
}

const SIZE_CLASS: Record<NonNullable<SelectProps["size"]>, string> = {
  sm: "h-8 px-2.5 text-[12px]",
  md: "h-9 px-3 text-[13px]",
};

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { value, onChange, options, placeholder, size = "sm", variant = "default", disabled, id, className = "", triggerRef, type, ...rest },
  ref,
) {
  const hasValue = options.some((o) => o.value === value);
  const toItem = (v: string) => (v === "" ? EMPTY_VALUE : v);
  const fromItem = (v: string) => (v === EMPTY_VALUE ? "" : v);

  return (
    <RSelect.Root
      value={hasValue ? toItem(value) : undefined}
      onValueChange={(v) => onChange(fromItem(v))}
      disabled={disabled}
    >
      <RSelect.Trigger
        id={id}
        ref={triggerRef ?? ref}
        type="button"
        {...rest}
        className={
          variant === "plain"
            ? `group flex min-w-0 items-center justify-between gap-1.5 whitespace-nowrap rounded-md font-bold outline-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLASS[size]} ${className}`
            : `group flex w-full min-w-0 items-center justify-between gap-2 whitespace-nowrap rounded-md border border-[var(--color-border)] bg-[var(--color-card)] text-left font-medium text-[var(--color-text-primary)] outline-none transition-colors duration-150 hover:border-[var(--color-border-strong)] focus-visible:border-[var(--color-accent)] focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] data-[state=open]:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLASS[size]} ${className}`
        }
      >
        <RSelect.Value placeholder={<span className="text-[var(--color-text-dimmed)]">{placeholder ?? ""}</span>} />
        <RSelect.Icon asChild>
          <ChevronDown
            className={`h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 ${
              variant === "plain" ? "opacity-60" : "text-[var(--color-text-dimmed)]"
            }`}
          />
        </RSelect.Icon>
      </RSelect.Trigger>

      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          align="start"
          className="surface-pop animate-panel-in z-[90] max-h-[280px] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg p-1"
        >
          <RSelect.ScrollUpButton className="flex h-5 items-center justify-center text-[var(--color-text-dimmed)]">
            <ChevronDown className="h-3 w-3 rotate-180" />
          </RSelect.ScrollUpButton>
          <RSelect.Viewport>
            {options.map((opt) => (
              <RSelect.Item
                key={opt.value}
                value={toItem(opt.value)}
                disabled={opt.disabled}
                className="relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 pr-7 text-[12.5px] text-[var(--color-text-secondary)] outline-none transition-colors data-[highlighted]:bg-[var(--color-accent-soft)] data-[highlighted]:text-[var(--color-text-primary)] data-[state=checked]:font-medium data-[state=checked]:text-[var(--color-text-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              >
                <RSelect.ItemText>{opt.label}</RSelect.ItemText>
                <RSelect.ItemIndicator className="absolute right-2 flex items-center">
                  <Check className="h-3.5 w-3.5 text-[var(--color-accent-text)]" strokeWidth={2.5} />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
          <RSelect.ScrollDownButton className="flex h-5 items-center justify-center text-[var(--color-text-dimmed)]">
            <ChevronDown className="h-3 w-3" />
          </RSelect.ScrollDownButton>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
});
