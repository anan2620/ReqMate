import { useId, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import { filterOptions } from "@/lib/option-filter";

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  ariaLabel?: string;
  inputClassName?: string;
}

/**
 * Text input that suggests `options` while still accepting free text.
 *
 * The list lives in a portal so that it is not clipped by the scroll container
 * the field usually sits in, and it never steals focus from the input: the user
 * can keep typing, or pick with mouse / arrows + Enter.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  inputClassName = "",
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const matches = useMemo(() => filterOptions(options, value), [options, value]);
  const activeOption = activeIndex >= 0 ? matches[activeIndex] : undefined;

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const commit = (next: string) => {
    onChange(next);
    close();
    inputRef.current?.focus();
  };

  const handleInput = (next: string) => {
    onChange(next);
    setActiveIndex(-1);
    // Only pop the list when something actually matches — otherwise the user is
    // typing a custom header and a stray empty panel would just be noise.
    setOpen(filterOptions(options, next).length > 0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(matches.length > 0);
        setActiveIndex(matches.length > 0 ? 0 : -1);
        return;
      }
      if (matches.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + step + matches.length) % matches.length);
      return;
    }

    if (event.key === "Enter" && open && activeOption) {
      event.preventDefault();
      commit(activeOption);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "Tab") close();
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setActiveIndex(-1);
      }}
    >
      <Popover.Anchor asChild>
        {/* `[&>input]:pr-6` keeps the field's own padding classes intact while
            reserving room for the chevron. */}
        <div className="relative flex min-w-0 items-center [&>input]:pr-6">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={activeOption ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off"
            spellCheck={false}
            value={value}
            placeholder={placeholder}
            onChange={(e) => handleInput(e.target.value)}
            // An empty field is the moment the presets are most useful, so
            // opening the list on focus makes them discoverable without hunting
            // for the chevron.
            onFocus={() => {
              if (!value.trim()) setOpen(matches.length > 0);
            }}
            onKeyDown={handleKeyDown}
            className={`peer w-full ${inputClassName}`}
          />
          <Popover.Trigger asChild>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              // Keep the caret in the input; the button only toggles the list.
              onPointerDown={(e) => e.preventDefault()}
              className="absolute top-1/2 right-1 -translate-y-1/2 rounded p-0.5 text-[var(--color-text-dimmed)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--color-text-secondary)] peer-focus:opacity-100 data-[state=open]:opacity-100"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </Popover.Trigger>
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          // Focus stays in the input while the list is open.
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{ width: "var(--radix-popper-anchor-width)" }}
          className="surface-pop animate-panel-in z-[90] max-h-[240px] overflow-y-auto rounded-lg p-1"
        >
          <ul id={listId} role="listbox" aria-label={ariaLabel}>
            {matches.map((option, index) => (
              <li
                key={option}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option === value}
                onPointerDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(option)}
                className={`flex cursor-default items-center rounded-md px-2 py-1.5 text-[12.5px] transition-colors ${
                  index === activeIndex
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]"
                    : option === value
                      ? "font-medium text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)]"
                }`}
              >
                {option}
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
