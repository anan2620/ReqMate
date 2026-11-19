import type { CollectionNode } from "@reqmate/types";

/** Get the order key for a node (file stem for requests, folder name for folders) */
export function getOrderKey(node: CollectionNode): string {
  const path = node.path;
  const name = path.substring(path.lastIndexOf("/") + 1);
  if (node.type === "request") {
    return name.replace(/\.(yaml|yml)$/, "");
  }
  return name;
}

function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Build the full `_folder.yaml` order list after moving `activePath` onto
 * `overPath`.
 *
 * The backend sorts folders before requests and replaces the whole order
 * vector on save, so the result always covers every sibling: only the block
 * being dragged (folders vs requests) is permuted, the other block is copied
 * through untouched. Leaving siblings out would make them fall back to
 * alphabetical order on the next load.
 *
 * Returns `null` when the move cannot be represented (unknown node, drop on a
 * node of the other kind, or no actual change).
 */
export function reorderSiblingKeys(
  siblings: CollectionNode[],
  activePath: string,
  overPath: string,
): string[] | null {
  const isRequest = (node: CollectionNode) => node.type === "request";

  const activeNode = siblings.find((n) => n.path === activePath);
  const overNode = siblings.find((n) => n.path === overPath);
  if (!activeNode || !overNode) return null;
  if (isRequest(activeNode) !== isRequest(overNode)) return null;

  const group = siblings.filter((n) => isRequest(n) === isRequest(activeNode));
  const fromIdx = group.findIndex((n) => n.path === activePath);
  const toIdx = group.findIndex((n) => n.path === overPath);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return null;

  const reordered = arrayMove(group, fromIdx, toIdx);

  let cursor = 0;
  return siblings.map((n) =>
    isRequest(n) === isRequest(activeNode)
      ? getOrderKey(reordered[cursor++])
      : getOrderKey(n),
  );
}
