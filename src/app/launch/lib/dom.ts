/**
 * Drives the real filter menus through the DOM, the same way a user would,
 * so the demo exercises the shipped components instead of a mock.
 */

export function getLaunchTarget(name: string) {
  return document.querySelector(`[data-launch="${name}"]`);
}

export function getFilterTrigger() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>("[role=toolbar] button"),
  ).find((button) => button.textContent?.startsWith("Filter"));
}

/** Scoped to the column's filter row, whatever operator it shows right now. */
export function getFilterOperatorTrigger(columnLabel: string) {
  return getFilterValueTrigger(columnLabel)
    ?.closest("[role=listitem]")
    ?.querySelector<HTMLElement>('[aria-controls$="-operator-listbox"]');
}

export function getSelectOption(label: string) {
  return Array.from(
    document.querySelectorAll("[data-slot=select-content] [role=option]"),
  ).find(
    (element) => element.textContent?.toLowerCase() === label.toLowerCase(),
  );
}

export function getFilterValueTrigger(label: string) {
  return document.querySelector<HTMLButtonElement>(
    `[data-radix-popper-content-wrapper] button[aria-label="${label} filter values"]`,
  );
}

/** Faceted items carry no value attribute, so they are matched by label. */
export function getFacetedOption(label: string) {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-slot=faceted-item]"),
  ).find(
    (element) =>
      element.querySelector("span")?.textContent?.toLowerCase() ===
      label.toLowerCase(),
  );
}

/** Clicks a popover trigger only when closed, since a click also closes it. */
export function openPopover(trigger: HTMLElement | null | undefined) {
  if (trigger?.getAttribute("aria-expanded") === "true") return;
  trigger?.click();
}

/** Escape would close the filter menu instead if the list is not open. */
export function closeFacetedList() {
  if (!document.querySelector("[data-slot=faceted-content]")) return;
  pressEscape();
}

/** Matches a toolbar filter by its button title or input placeholder. */
function getToolbarFilter(label: string) {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      "[role=toolbar] button, [role=toolbar] input",
    ),
  ).find((element) =>
    element instanceof HTMLInputElement
      ? element.placeholder === label
      : element.textContent?.trim().startsWith(label),
  );
}

/** Rings a newly added toolbar filter, then fades back to its own styles. */
export function flashToolbarFilter(label: string) {
  getToolbarFilter(label)?.animate(
    [
      {
        offset: 0,
        boxShadow:
          "0 0 0 0.125rem rgb(52 211 153 / 0.7), 0 0 1.5rem rgb(52 211 153 / 0.35)",
        backgroundColor: "rgb(52 211 153 / 0.15)",
      },
    ],
    { duration: 1400, easing: "ease-out" },
  );
}

/**
 * Swaps the query string the way an address bar edit would, without a reload.
 * nuqs reads its own last writes over the URL until a popstate clears them,
 * and Next ignores a popstate without state.
 */
export function replaceUrl(search: string) {
  window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  history.replaceState(null, "", `${location.pathname}${search}`);
}

export function getIsPopoverOpen() {
  return document.querySelector("[data-radix-popper-content-wrapper]") !== null;
}

export function pressKey(target: Element | null | undefined, key: string) {
  target?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

export function pressFilterShortcut() {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "f", metaKey: true, shiftKey: true }),
  );
}

/** Dismisses only the topmost popover, like a single Escape press. */
export function pressEscape() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
}

/**
 * Escape only reaches the topmost layer, and a layer stays mounted through its
 * exit animation, so this keeps pressing once per frame until all are gone.
 */
export function closeAllMenus(attempts = 60) {
  if (!getIsPopoverOpen() || attempts === 0) return;

  pressEscape();
  requestAnimationFrame(() => closeAllMenus(attempts - 1));
}

export function typeCommand(value: string) {
  const input = getCommandInput();
  if (!input) return;

  // React tracks input values through the prototype setter, so assigning
  // `input.value` directly would not fire onChange.
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export function pressCommandEnter() {
  pressKey(getCommandInput(), "Enter");
}

function getCommandInput() {
  return document.querySelector<HTMLInputElement>("[cmdk-input]");
}
