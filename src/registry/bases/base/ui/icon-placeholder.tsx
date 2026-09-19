import type * as React from "react";

import * as icons from "lucide-react";

/**
 * shadcn's published Base UI primitives reference this helper to swap icons per
 * the user's configured icon library. It is not part of their registry output,
 * so the base tree ships a lucide-only stand-in to keep those files compiling.
 */
interface IconPlaceholderProps extends React.SVGProps<SVGSVGElement> {
  lucide: string;
  tabler?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
}

function IconPlaceholder({
  lucide,
  tabler,
  hugeicons,
  phosphor,
  remixicon,
  ...props
}: IconPlaceholderProps) {
  const iconsByName = icons as unknown as Record<
    string,
    React.ComponentType<React.SVGProps<SVGSVGElement>> | undefined
  >;
  const Icon = iconsByName[lucide];

  return Icon ? <Icon {...props} /> : null;
}

export { IconPlaceholder };
