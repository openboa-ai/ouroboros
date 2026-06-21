import type { ComponentProps } from "react";
import {
  NativeSelect,
  NativeSelectOption
} from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorNativeSelect({
  className,
  selectClassName,
  ...props
}: ComponentProps<typeof NativeSelect>) {
  return (
    <NativeSelect
      data-operator-ui="native-select"
      className={cn("min-w-0 max-w-full", className)}
      selectClassName={cn(OPERATOR_DESIGN_TOKENS.surface.nativeSelect, selectClassName)}
      {...props}
    />
  );
}

export function OperatorNativeSelectOption(
  props: ComponentProps<typeof NativeSelectOption>
) {
  return <NativeSelectOption {...props} />;
}
