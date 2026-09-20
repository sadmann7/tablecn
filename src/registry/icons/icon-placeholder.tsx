// Must live at registry/icons/icon-placeholder so `shadcn add` can strip the import.
import type * as React from "react";

import * as icons from "lucide-react";

interface IconPlaceholderProps extends React.ComponentProps<"svg"> {
  lucide: string;
  tabler?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
}

function IconPlaceholder({
  lucide,
  tabler: _tabler,
  hugeicons: _hugeicons,
  phosphor: _phosphor,
  remixicon: _remixicon,
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
