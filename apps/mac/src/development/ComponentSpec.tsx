import { useId, useState, type ReactNode } from "react";
import { Check, Circle, Minus, PanelRight, Plus } from "lucide-react";

import { Avatar, AvatarFallback } from "@/ui/primitives/avatar";
import { Badge } from "@/ui/primitives/badge";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/ui/primitives/progress";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/ui/primitives/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/primitives/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/primitives/tabs";

function SpecSection({
  title,
  dimensions,
  children,
}: {
  title: string;
  dimensions: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={`${title} reference`} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="type-section">{title}</h2>
        <span className="type-meta text-muted-foreground">{dimensions}</span>
      </div>
      {children}
    </section>
  );
}

// UX: ../../../../docs/design/UI_PURPOSE_CONTRACT.md#primitives
// Exercise shared component states. Product compositions also need their own purpose,
// evidence, destination and return path; this board cannot certify the complete experience.
export function ComponentSpec() {
  const id = useId();
  const [presses, setPresses] = useState(0);
  const [input, setInput] = useState("OpenBoa");
  const [validationInput, setValidationInput] = useState("abc");
  const [progress, setProgress] = useState(50);
  const [sheetOpen, setSheetOpen] = useState(false);
  const invalid = validationInput.trim().length < 6;

  return (
    <main className="spec-page space-y-8">
      <header className="space-y-2">
        <h1 className="type-title">Component reference</h1>
        <p className="type-body text-muted-foreground">
          Compare sizes, states, and interactions.
        </p>
      </header>
      <div className="grid grid-cols-1 items-start gap-x-12 gap-y-10 md:grid-cols-2">
        <SpecSection title="Button" dimensions="13/16px · 28 / 32px high">
          <div className="grid grid-cols-[5rem_1fr_1fr] items-center gap-x-3 gap-y-2">
            <span className="type-meta text-muted-foreground">variant</span>
            <span className="type-meta text-muted-foreground">
              default · 28px
            </span>
            <span className="type-meta text-muted-foreground">lg · 32px</span>
            {(["default", "secondary", "ghost", "disabled"] as const).map(
              (variant) => (
                <div key={variant} className="contents">
                  <span className="type-meta text-muted-foreground">
                    {variant}
                  </span>
                  {(["default", "lg"] as const).map((size) => (
                    <Button
                      key={size}
                      variant={variant === "disabled" ? "default" : variant}
                      size={size}
                      disabled={variant === "disabled"}
                      className="type-control w-fit"
                      onClick={() => setPresses((value) => value + 1)}
                    >
                      <Plus data-icon="inline-start" />
                      Button
                    </Button>
                  ))}
                </div>
              ),
            )}
          </div>
          <p className="type-meta text-muted-foreground" aria-live="polite">
            {presses} {presses === 1 ? "click" : "clicks"}
          </p>
        </SpecSection>

        <SpecSection title="Input" dimensions="13/16px · 28px high">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor={`${id}-default`}
                className="type-meta text-muted-foreground"
              >
                default
              </label>
              <Input
                id={`${id}-default`}
                className="type-control"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Enter text"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={`${id}-invalid`}
                className="type-meta text-muted-foreground"
              >
                {invalid ? "invalid" : "valid"} · 6+ characters
              </label>
              <Input
                id={`${id}-invalid`}
                className="type-control"
                value={validationInput}
                onChange={(event) => setValidationInput(event.target.value)}
                aria-invalid={invalid}
                aria-describedby={`${id}-validation`}
              />
              <p
                id={`${id}-validation`}
                className={`type-meta ${invalid ? "text-destructive" : "text-muted-foreground"}`}
                aria-live="polite"
              >
                {invalid ? "Enter at least 6 characters." : "Valid input."}
              </p>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={`${id}-disabled`}
                className="type-meta text-muted-foreground"
              >
                disabled
              </label>
              <Input
                id={`${id}-disabled`}
                className="type-control"
                value="Disabled"
                disabled
              />
            </div>
          </div>
        </SpecSection>

        <SpecSection title="Tabs" dimensions="13/16px · 32px high">
          <div className="space-y-4">
            {(["default", "line"] as const).map((variant) => (
              <Tabs key={variant} defaultValue="first">
                <span className="type-meta text-muted-foreground">
                  {variant}
                </span>
                <TabsList variant={variant} aria-label={`${variant} tabs`}>
                  <TabsTrigger value="first" className="type-control">
                    First
                  </TabsTrigger>
                  <TabsTrigger value="second" className="type-control">
                    Second
                  </TabsTrigger>
                  <TabsTrigger
                    value="disabled"
                    className="type-control"
                    disabled
                  >
                    Disabled
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value="first"
                  className="type-data text-muted-foreground"
                >
                  First · selected
                </TabsContent>
                <TabsContent
                  value="second"
                  className="type-data text-muted-foreground"
                >
                  Second · selected
                </TabsContent>
              </Tabs>
            ))}
          </div>
        </SpecSection>

        <SpecSection title="Badge" dimensions="12/16px · 20px high">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="type-meta">
              <Check />
              Default
            </Badge>
            <Badge variant="secondary" className="type-meta">
              Secondary
            </Badge>
            <Badge variant="outline" className="type-meta">
              <Circle />
              Outline
            </Badge>
            <Badge variant="destructive" className="type-meta">
              Destructive
            </Badge>
          </div>
        </SpecSection>

        <SpecSection title="Table" dimensions="13px text · 40px header">
          <Table className="type-data">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="type-control text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="type-control text-muted-foreground">
                  Variant
                </TableHead>
                <TableHead className="type-control text-right text-muted-foreground">
                  Value
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { name: "Alpha", variant: "Default", value: "1,024.00" },
                { name: "Beta", variant: "Secondary", value: "128.50" },
                { name: "Gamma", variant: "Muted", value: "32.00" },
              ].map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="type-data">{row.name}</TableCell>
                  <TableCell className="type-data text-muted-foreground">
                    {row.variant}
                  </TableCell>
                  <TableCell className="type-data text-right tabular-nums">
                    {row.value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SpecSection>

        <SpecSection title="Avatar" dimensions="24 / 32 / 40px">
          <div className="flex flex-wrap items-start gap-8">
            {(
              [
                { size: "sm", pixels: 24 },
                { size: "default", pixels: 32 },
                { size: "lg", pixels: 40 },
              ] as const
            ).map(({ size, pixels }) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <div className="flex h-10 items-center">
                  <Avatar size={size} aria-label={`OpenBoa ${size} avatar`}>
                    <AvatarFallback className="type-meta">OB</AvatarFallback>
                  </Avatar>
                </div>
                <span className="type-meta text-muted-foreground">
                  {size} · {pixels}px
                </span>
              </div>
            ))}
          </div>
          <p className="type-meta text-muted-foreground">fallback · 12/16px</p>
        </SpecSection>

        <SpecSection title="Progress" dimensions="12/16px · track 4px">
          <div className="space-y-4">
            <Progress value={progress}>
              <ProgressLabel className="type-meta">Determinate</ProgressLabel>
              <ProgressValue className="type-meta" />
            </Progress>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                aria-label="Decrease progress by 25 percentage points"
                disabled={progress === 0}
                onClick={() => setProgress((value) => Math.max(0, value - 25))}
              >
                <Minus />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Increase progress by 25 percentage points"
                disabled={progress === 100}
                onClick={() =>
                  setProgress((value) => Math.min(100, value + 25))
                }
              >
                <Plus />
              </Button>
              <span className="type-meta text-muted-foreground">
                25-point steps
              </span>
            </div>
            <Progress value={100}>
              <ProgressLabel className="type-meta">Complete</ProgressLabel>
              <ProgressValue className="type-meta" />
            </Progress>
          </div>
        </SpecSection>

        <SpecSection title="Sheet" dimensions="384px max · 24px padding">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger
              render={<Button variant="secondary" className="type-control" />}
            >
              <PanelRight data-icon="inline-start" />
              Open sheet
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle className="type-title">Sheet</SheetTitle>
                <SheetDescription className="type-body">
                  Right side · up to 384px
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-6">
                <div className="space-y-1.5">
                  <label
                    htmlFor={`${id}-sheet`}
                    className="type-meta text-muted-foreground"
                  >
                    Input · 28px
                  </label>
                  <Input
                    id={`${id}-sheet`}
                    className="type-control"
                    placeholder="Type to test focus"
                  />
                </div>
                <Badge variant="secondary" className="type-meta">
                  Open
                </Badge>
              </div>
              <SheetFooter>
                <SheetClose render={<Button className="type-control" />}>
                  Close
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <p className="type-meta text-muted-foreground" aria-live="polite">
            {sheetOpen ? "Open" : "Closed"} · Esc or click outside to close
          </p>
        </SpecSection>
      </div>
    </main>
  );
}
