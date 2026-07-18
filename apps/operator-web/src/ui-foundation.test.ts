import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = dirname(fileURLToPath(import.meta.url));
const appRoot = join(srcRoot, "..");
const repoRoot = join(appRoot, "../..");

function parseHex(value: string): [number, number, number] {
  const normalized = value.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number
  ];
}

function relativeLuminance(value: string): number {
  const [red, green, blue] = parseHex(value).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

describe("Ouroboros shadcn foundation", () => {
  it("pins the reproducible Operator preset basis", () => {
    const config = JSON.parse(readFileSync(join(appRoot, "components.json"), "utf8")) as {
      style: string;
      iconLibrary: string;
      menuColor: string;
      menuAccent: string;
      tailwind: { baseColor: string; cssVariables: boolean };
    };
    const packageJson = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    const styles = readFileSync(join(srcRoot, "styles.css"), "utf8");

    expect(config).toMatchObject({
      style: "radix-nova",
      iconLibrary: "lucide",
      menuColor: "default-translucent",
      menuAccent: "subtle",
      tailwind: {
        baseColor: "mist",
        cssVariables: true
      }
    });
    expect(packageJson.dependencies.shadcn).toBeUndefined();
    expect(packageJson.devDependencies.shadcn).toBe("4.13.1");
    expect(styles).not.toContain('@import "shadcn/tailwind.css"');
    expect(styles).toContain("/* ejected from shadcn@4.13.1 */");
    expect(styles).toContain("@custom-variant data-open");
    expect(styles.indexOf('@import "@fontsource-variable/inter"'))
      .toBeLessThan(styles.indexOf("/* ejected from shadcn@4.13.1 */"));
    expect(packageJson.dependencies["@fontsource-variable/inter"]).toBeDefined();
    expect(packageJson.dependencies["@fontsource-variable/geist"]).toBeUndefined();
    expect(packageJson.scripts["ui:add"]).toBe("shadcn add");
    expect(packageJson.scripts["ui:info"]).toBe("shadcn info");
    expect(packageJson.scripts["ui:preset"]).toBe("shadcn preset decode b3kJo21Jq");
    expect(packageJson.scripts["ui:resolve"]).toBe("shadcn preset resolve");
  });

  it("owns one exact accessible brand token and caps every radius at 8px", () => {
    const styles = readFileSync(join(srcRoot, "styles.css"), "utf8");

    expect(styles.match(/#F37021/gi)).toHaveLength(1);
    expect(styles).toContain("--brand: #F37021;");
    expect(styles).toContain("--brand-foreground: #17120F;");
    expect(styles).toContain("--primary: var(--foreground);");
    expect(styles).toContain("--sidebar-primary: var(--brand);");
    expect(styles).toContain("--chart-1: var(--brand);");
    expect(styles).toContain("--radius: 0.5rem;");
    expect(styles).toContain("--radius-xl: var(--radius);");
    expect(styles).toContain("--radius-4xl: var(--radius);");
    expect(styles).not.toContain("Geist Variable");
    expect(contrastRatio("#F37021", "#17120F")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the required open-code primitives in the shadcn directory", () => {
    const requiredPrimitives = [
      "alert",
      "badge",
      "button",
      "card",
      "chart",
      "empty",
      "input",
      "native-select",
      "progress",
      "scroll-area",
      "separator",
      "sheet",
      "sidebar",
      "skeleton",
      "table",
      "tabs",
      "tooltip"
    ];

    for (const primitive of requiredPrimitives) {
      expect(existsSync(join(srcRoot, "components", "ui", `${primitive}.tsx`))).toBe(true);
    }

    expect(existsSync(join(repoRoot, "docs", "operator-design-system.md"))).toBe(true);

    const badgeSource = readFileSync(join(srcRoot, "components", "ui", "badge.tsx"), "utf8");
    const buttonSource = readFileSync(join(srcRoot, "components", "ui", "button.tsx"), "utf8");
    const alertSource = readFileSync(join(srcRoot, "components", "ui", "alert.tsx"), "utf8");
    const progressSource = readFileSync(join(srcRoot, "components", "ui", "progress.tsx"), "utf8");
    const sidebarSource = readFileSync(join(srcRoot, "components", "ui", "sidebar.tsx"), "utf8");
    for (const variant of ["success", "warning", "info", "destructive"]) {
      expect(badgeSource).toContain(`${variant}:`);
      expect(alertSource).toContain(`${variant}:`);
    }
    expect(buttonSource).toContain("bg-brand text-brand-foreground");
    expect(buttonSource).toContain("link: \"text-primary");
    expect(badgeSource).toContain("bg-brand text-brand-foreground");
    expect(alertSource).toContain("*:[svg]:text-warning");
    expect(alertSource).not.toContain("*:[svg]:text-warning-foreground");
    expect(progressSource).toContain("bg-brand");
    expect(sidebarSource).toContain("relative flex min-w-0 w-full flex-1");
  });
});
