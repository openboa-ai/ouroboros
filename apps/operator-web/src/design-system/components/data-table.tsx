import type { ComponentProps, KeyboardEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export interface OperatorDataTableColumn {
  key: string;
  label: ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface OperatorDataTableRow {
  id: string;
  cells: Record<string, ReactNode>;
  selected?: boolean;
  label?: string;
  onSelect?: () => void;
}

export function OperatorDataTable({
  columns,
  rows,
  className,
  ...props
}: {
  columns: OperatorDataTableColumn[];
  rows: OperatorDataTableRow[];
  className?: string;
} & Omit<ComponentProps<"table">, "className" | "children">) {
  return (
    <div data-operator-ui="data-table" className={cn(OPERATOR_DESIGN_TOKENS.surface.dataTable, className)}>
      <Table className={OPERATOR_DESIGN_TOKENS.layout.dataTable} {...props}>
        <TableHeader>
          <TableRow className={OPERATOR_DESIGN_TOKENS.surface.dataTableHeaderRow}>
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(OPERATOR_DESIGN_TOKENS.typography.tableHead, column.className, column.headerClassName)}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const interactive = Boolean(row.onSelect);

            return (
              <TableRow
                key={row.id}
                data-state={row.selected ? "selected" : undefined}
                className={cn(
                  OPERATOR_DESIGN_TOKENS.surface.dataTableRow,
                  interactive && OPERATOR_DESIGN_TOKENS.surface.dataTableInteractiveRow
                )}
                tabIndex={interactive ? 0 : undefined}
                aria-label={row.label}
                onClick={interactive ? () => row.onSelect?.() : undefined}
                onKeyDown={interactive ? (event) => handleRowKeyDown(event, row.onSelect) : undefined}
              >
                {columns.map((column, columnIndex) => {
                  const content = row.cells[column.key];

                  return (
                    <TableCell
                      key={column.key}
                      className={cn(OPERATOR_DESIGN_TOKENS.typography.tableCell, column.className)}
                    >
                      {interactive && columnIndex === 0 ? (
                        <Button
                          type="button"
                          variant={row.selected ? "secondary" : "ghost"}
                          size="sm"
                          aria-label={row.label}
                          aria-current={row.selected ? "true" : undefined}
                          className={OPERATOR_DESIGN_TOKENS.surface.dataTableRowButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            row.onSelect?.();
                          }}
                        >
                          {content}
                        </Button>
                      ) : (
                        content
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, onSelect: (() => void) | undefined) {
  if (!onSelect || (event.key !== "Enter" && event.key !== " ")) {
    return;
  }

  event.preventDefault();
  onSelect();
}
