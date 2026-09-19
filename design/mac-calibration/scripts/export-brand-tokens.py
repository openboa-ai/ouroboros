#!/usr/bin/env python3
"""Export the pinned OpenBoa release without dependencies or network access.

Run normally to import original bytes from the local Git object database, or use
--from-vendored to regenerate from the checked-in, hash-verified local assets.
--check verifies the export without writing files.
"""

import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess


COMMIT = "e93f55cbfd90b668ef9d77875f71d8e53f7ceb4b"
RELEASE = "2026.08.23"
REPOSITORY = "https://github.com/openboa-ai/openboa-brand-system"
ROOT = Path(__file__).resolve().parents[3] / "apps/mac"
TOKEN_FILE = "06-design-tokens/openboa.tokens.json"
FONT_FILE = "08-fonts-licenses/MartianGrotesk-wdth-wght.ttf"
LICENSE_FILE = "08-fonts-licenses/LICENSE-MartianGrotesk-OFL.txt"
LICENSE_SOURCE_SHA256 = "92b0fe50842b9348a71a1ddeb5115ed4e86e89ce4938f706c95e1441e4e7020b"
SOURCES = {
    TOKEN_FILE: "public/brand/openboa.tokens.json",
    FONT_FILE: "public/brand/MartianGrotesk-wdth-wght.ttf",
    "08-fonts-licenses/LICENSE-MartianGrotesk-OFL.txt": "public/brand/LICENSE-MartianGrotesk-OFL.txt",
    "08-fonts-licenses/FONT-PROVENANCE.md": "public/brand/FONT-PROVENANCE.md",
    "08-fonts-licenses/vendor-versions.json": "public/brand/vendor-versions.json",
    "01-source-masters/openboa-symbol-primary.svg": "public/brand/openboa-symbol-primary.svg",
    "01-source-masters/openboa-symbol-reverse.svg": "public/brand/openboa-symbol-reverse.svg",
    "01-source-masters/openboa-symbol-carbon.svg": "public/brand/openboa-symbol-carbon.svg",
    "LICENSING.md": "public/brand/LICENSING.md",
    "LICENSE": "public/brand/LICENSE",
    "USAGE.md": "public/brand/USAGE.md",
}
ROLES = {
    "amount": "sys.type.product.heading-01",
    "amount-secondary": "sys.type.product.heading-02",
    "title": "sys.type.product.heading-03",
    "body": "sys.type.product.body-02",
    "data": "sys.type.product.body-03",
    "control": "sys.type.support.label-02",
    "section": "sys.type.support.label-01",
    "meta": "sys.type.support.caption-01",
}
# This is a documented Korean fallback, not an added OpenBoa font token.
FONT_STACK = '"Martian Grotesk", "Apple SD Gothic Neo", system-ui, sans-serif'
SEMANTICS = {
    "background": "background.canvas",
    "foreground": "text.primary",
    "card": "background.surface",
    "card-foreground": "text.primary",
    "popover": "background.surface-elevated",
    "popover-foreground": "text.primary",
    "primary": "action.primary.default",
    "primary-foreground": "action.primary.content",
    "secondary": "action.secondary.default",
    "secondary-foreground": "action.secondary.content",
    "muted": "background.surface-subtle",
    "muted-foreground": "text.muted",
    "accent": "selection.fill",
    "accent-foreground": "selection.content",
    "destructive": "action.danger.default",
    "destructive-foreground": "action.danger.content",
    "border": "border.default",
    "input": "border.control",
    "ring": "focus.ring",
}
SIDEBAR = {
    "sidebar": "fill.default",
    "sidebar-foreground": "text.default",
    "sidebar-primary": "fill.primary",
    "sidebar-primary-foreground": "text.inverse",
    "sidebar-accent": "fill.selected",
    "sidebar-accent-foreground": "text.default",
    "sidebar-border": "border.subtle",
    "sidebar-ring": "focus.ring",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def export_asset(source, data):
    # Preserve license wording while keeping vendored text valid under repository whitespace checks.
    if source == LICENSE_FILE:
        return re.sub(rb"[ \t]+(?=\r?$)", b"", data, flags=re.MULTILINE)
    return data


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def number(value):
    return str(int(value)) if float(value).is_integer() else str(value)


def leaves(value, path=""):
    if isinstance(value, dict) and "$value" in value:
        yield path, value
    elif isinstance(value, dict):
        for key, child in value.items():
            if not key.startswith("$"):
                yield from leaves(child, f"{path}.{key}" if path else key)


class Tokens:
    def __init__(self, document):
        self.tokens = dict(leaves(document))

    def resolve(self, value, trail=()):
        if isinstance(value, str) and re.fullmatch(r"\{[^{}]+\}", value):
            return self.value(value[1:-1], trail)
        if isinstance(value, dict):
            return {k: self.resolve(v, trail) for k, v in value.items()}
        if isinstance(value, list):
            return [self.resolve(v, trail) for v in value]
        return value

    def value(self, path, trail=()):
        if path in trail:
            raise ValueError(f"Token alias cycle: {' -> '.join((*trail, path))}")
        if path not in self.tokens:
            raise ValueError(f"Missing token: {path}")
        return self.resolve(self.tokens[path]["$value"], (*trail, path))


def css_value(value, kind):
    if kind == "color":
        if value["colorSpace"] != "srgb":
            raise ValueError(f"Unsupported source color space: {value['colorSpace']}")
        components = value["components"]
        if any(not 0 <= component <= 1 for component in components):
            raise ValueError("Invalid sRGB source color")
        rgb = [round(component * 255) for component in components]
        hex_color = "#" + "".join(f"{component:02X}" for component in rgb)
        if value.get("hex", hex_color).upper() != hex_color:
            raise ValueError(f"Color hex/components disagree: {value}")
        alpha = value.get("alpha", 1)
        if not 0 <= alpha <= 1:
            raise ValueError("Invalid source alpha")
        return hex_color if alpha == 1 else f"rgb({' '.join(map(str, rgb))} / {number(alpha)})"
    if kind in ("dimension", "duration"):
        return f"{number(value['value'])}{value['unit']}"
    if kind in ("number", "fontWeight"):
        return number(value)
    if kind == "cubicBezier":
        return f"cubic-bezier({', '.join(map(number, value))})"
    raise ValueError(f"Unsupported CSS token type: {kind}")


def font_axes(data):
    """Read the bundled font's actual OpenType fvar axis ranges."""
    count = struct.unpack_from(">H", data, 4)[0]
    tables = {}
    for index in range(count):
        tag, _, offset, length = struct.unpack_from(">4sIII", data, 12 + 16 * index)
        tables[tag] = (offset, length)
    offset, _ = tables[b"fvar"]
    axes_offset, _, axes_count, axis_size = struct.unpack_from(">HHHH", data, offset + 4)
    axes = {}
    for index in range(axes_count):
        tag, low, default, high = struct.unpack_from(">4siii", data, offset + axes_offset + index * axis_size)
        axes[tag.decode()] = {"min": low / 65536, "default": default / 65536, "max": high / 65536}
    return axes


def typography(tokens):
    result = {}
    for role, source in ROLES.items():
        value = tokens.value(source)
        extension = tokens.tokens[source]["$extensions"]["org.openboa"]
        if value["fontSize"]["unit"] != "px" or value["letterSpacing"]["unit"] != "px":
            raise ValueError(f"Unexpected typography units: {source}")
        size = value["fontSize"]["value"]
        result[role] = {
            "sourceToken": source,
            "fontFamily": value["fontFamily"],
            "cssFontFamily": FONT_STACK,
            "size": size,
            "lineHeight": value["lineHeight"],
            "lineHeightPx": round(size * value["lineHeight"], 6),
            "weight": value["fontWeight"],
            "letterSpacing": value["letterSpacing"]["value"],
            "letterSpacingUnit": "px",
            "trackingEm": extension["tracking-em"],
            "wdth": extension["axes"]["wdth"],
        }
    return result


def export_css(tokens, roles, axes):
    weight, width = axes["wght"], axes["wdth"]
    lines = [
        "/* Generated by scripts/export-brand-tokens.py. Do not hand-edit. */",
        f"/* OpenBoa {RELEASE}; commit {COMMIT}. */",
        "@font-face {",
        '  font-family: "Martian Grotesk";',
        '  src: url("/brand/MartianGrotesk-wdth-wght.ttf") format("truetype");',
        "  font-style: normal;",
        f"  font-weight: {number(weight['min'])} {number(weight['max'])};",
        f"  font-stretch: {number(width['min'])}% {number(width['max'])}%;",
        "  font-display: swap;",
        "}",
        "",
        ":root {",
        f"  --ob-font-sans: {FONT_STACK};",
        "  --font-sans: var(--ob-font-sans);",
        "  --font-heading: var(--ob-font-sans);",
    ]
    global_prefixes = {
        "ref.space.": "--ob-space-",
        "ref.radius.": "--ob-radius-",
        "ref.size.": "--ob-size-",
        "ref.icon.": "--ob-icon-",
        "ref.motion.duration.": "--ob-motion-duration-",
        "ref.motion.easing.": "--ob-motion-easing-",
        "sys.data.": "--ob-data-",
    }
    for source, token in tokens.tokens.items():
        for prefix, css_prefix in global_prefixes.items():
            if source.startswith(prefix):
                name = css_prefix + source.removeprefix(prefix).replace(".", "-")
                lines.append(f"  {name}: {css_value(tokens.value(source), token['$type'])}; /* {source} */")
    for role, value in roles.items():
        lines.extend([
            f"  --ob-type-{role}-size: {number(value['size'])}px;",
            f"  --ob-type-{role}-line-height: {number(value['lineHeight'])};",
            f"  --ob-type-{role}-weight: {number(value['weight'])};",
            f"  --ob-type-{role}-letter-spacing: {number(value['letterSpacing'])}px;",
            f"  --ob-type-{role}-wdth: {number(value['wdth'])};",
        ])
    lines.extend(["}", ""])
    for theme in ("light", "dark"):
        selector = ':root, .light, [data-theme="light"]' if theme == "light" else '.dark, [data-theme="dark"]'
        lines.extend([f"{selector} {{", f"  color-scheme: {theme};"])
        prefix = f"sys.color.{theme}."
        for source, token in tokens.tokens.items():
            if source.startswith(prefix):
                name = "--ob-color-" + source.removeprefix(prefix).replace(".", "-")
                lines.append(f"  {name}: {css_value(tokens.value(source), token['$type'])}; /* {source} */")
        for target, suffix in SEMANTICS.items():
            tokens.value(prefix + suffix)  # Validate the intended source mapping.
            lines.append(f"  --{target}: var(--ob-color-{suffix.replace('.', '-')});")
        for target, suffix in SIDEBAR.items():
            source = f"comp.{theme}.sidebar.{suffix}"
            value = css_value(tokens.value(source), "color")
            lines.append(f"  --{target}: {value}; /* {source} */")
        for index in range(1, 6):
            lines.append(f"  --chart-{index}: var(--ob-data-categorical-0{index});")
        lines.append(f"  --radius: {css_value(tokens.value(f'comp.{theme}.panel.radius.default'), 'dimension')}; /* comp.{theme}.panel.radius.default */")
        for size in ("sm", "md", "lg", "xl", "2xl", "3xl"):
            lines.append(f"  --radius-{size}: var(--ob-radius-{size});")
        for component in ("button", "card", "panel", "sidebar"):
            source = f"comp.{theme}.{component}.radius.default"
            lines.append(f"  --ob-{component}-radius: {css_value(tokens.value(source), 'dimension')}; /* {source} */")
        lines.extend(["}", ""])
    for role, value in roles.items():
        lines.extend([
            f"/* {value['sourceToken']}: the entire composite, including variable-font width. */",
            f".type-{role} {{",
            "  font-family: var(--ob-font-sans);",
            f"  font-size: var(--ob-type-{role}-size);",
            f"  font-weight: var(--ob-type-{role}-weight);",
            f"  line-height: var(--ob-type-{role}-line-height);",
            f"  letter-spacing: var(--ob-type-{role}-letter-spacing);",
            f"  font-stretch: {number(value['wdth'])}%;",
            f'  font-variation-settings: "wdth" var(--ob-type-{role}-wdth);',
            "  font-synthesis: none;",
            "}",
            "",
        ])
    lines.extend([
        "/* Apply only to numerical comparisons, independently of the type role. */",
        ".type-tabular {",
        "  font-variant-numeric: lining-nums tabular-nums;",
        "}",
        "",
    ])
    return "\n".join(lines).encode()


def load_sources(args):
    if args.from_vendored:
        manifest = json.loads((ROOT / "public/brand/manifest.json").read_text())
        if manifest["sourceCommit"] != COMMIT:
            raise ValueError("Vendored assets are not from the pinned release")
        sources = {}
        for source, target in SOURCES.items():
            data = (ROOT / target).read_bytes()
            if digest(data) != manifest["files"][target]["sha256"]:
                raise ValueError(f"Vendored asset hash mismatch: {target}")
            sources[source] = data
        return sources
    repository = Path(args.source_repo)
    actual = subprocess.check_output(["git", "-C", str(repository), "rev-parse", f"{COMMIT}^{{commit}}"], text=True).strip()
    if actual != COMMIT:
        raise ValueError("Pinned source commit did not resolve exactly")
    return {
        source: subprocess.check_output(["git", "-C", str(repository), "show", f"{COMMIT}:{source}"])
        for source in SOURCES
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--source-repo", help="Path to the source brand repository at the pinned commit")
    source.add_argument("--from-vendored", action="store_true", help="Use the hash-verified local source snapshot, with no Git repository needed")
    parser.add_argument("--check", action="store_true", help="Verify all generated files and original assets without writing")
    args = parser.parse_args()
    sources = load_sources(args)
    tokens = Tokens(json.loads(sources[TOKEN_FILE]))
    # Fail on invalid aliases anywhere in the original graph, not only used roles.
    for source in tokens.tokens:
        tokens.value(source)
    axes = font_axes(sources[FONT_FILE])
    font_hash = json.loads(sources["08-fonts-licenses/vendor-versions.json"])["martian-grotesk"]["sha256"]
    if digest(sources[FONT_FILE]) != font_hash:
        raise ValueError("Bundled Martian font does not match upstream provenance")
    roles = typography(tokens)
    for role, value in roles.items():
        if not axes["wdth"]["min"] <= value["wdth"] <= axes["wdth"]["max"]:
            raise ValueError(f"Unsupported font width: {role}")
        if not axes["wght"]["min"] <= value["weight"] <= axes["wght"]["max"]:
            raise ValueError(f"Unsupported font weight: {role}")
    outputs = {target: export_asset(source, sources[source]) for source, target in SOURCES.items()}
    outputs["src/ui/tokens/openboa.css"] = export_css(tokens, roles, axes)
    outputs["src/ui/tokens/typography.json"] = json_bytes(roles)
    provenance = {
        "sourceRepository": REPOSITORY,
        "sourceCommit": COMMIT,
        "sourceRelease": RELEASE,
        "sourceTokens": TOKEN_FILE,
        "sourceTokensSha256": digest(sources[TOKEN_FILE]),
        "fontSha256": digest(sources[FONT_FILE]),
        "fontAxes": axes,
        "fontFallback": {
            "original": ["Martian Grotesk", "sans-serif"],
            "css": FONT_STACK,
            "note": "Apple SD Gothic Neo and system-ui are downstream Korean/system fallbacks, not new brand tokens. No fallback font is bundled. Typography metrics and width remain the original OpenBoa roles; actual fallback glyph width can differ.",
        },
        "lineHeightNote": "CSS preserves the original unitless token. lineHeightPx is size * lineHeight rounded to 6 decimal places for DOM comparison.",
        "numericOption": ".type-tabular adds lining-nums tabular-nums independently of role; it does not imply monospaced text.",
        "semanticMapping": {key: f"sys.color.{{theme}}.{value}" for key, value in SEMANTICS.items()},
        "sidebarMapping": {key: f"comp.{{theme}}.sidebar.{value}" for key, value in SIDEBAR.items()},
        "chartMapping": {f"chart-{i}": f"sys.data.categorical.0{i}" for i in range(1, 6)},
    }
    outputs["src/ui/tokens/provenance.json"] = json_bytes(provenance)
    manifest = {
        "sourceRepository": REPOSITORY,
        "sourceCommit": COMMIT,
        "sourceRelease": RELEASE,
        "files": {
            target: {
                "sourcePath": source,
                "sourceUrl": f"{REPOSITORY}/blob/{COMMIT}/{source}",
                "sha256": digest(outputs[target]),
                "bytes": len(outputs[target]),
                "copiedWithoutModification": source != LICENSE_FILE,
                **({"sourceSha256": LICENSE_SOURCE_SHA256,
                    "normalization": "Trailing horizontal whitespace removed; license wording unchanged."}
                   if source == LICENSE_FILE else {}),
            }
            for source, target in SOURCES.items()
        },
        "generated": {
            path: {"sha256": digest(data), "bytes": len(data)}
            for path, data in outputs.items() if path.startswith("src/")
        },
    }
    outputs["public/brand/manifest.json"] = json_bytes(manifest)
    changed = []
    for relative, data in outputs.items():
        target = ROOT / relative
        if not target.exists() or target.read_bytes() != data:
            changed.append(relative)
            if not args.check:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
    if args.check and changed:
        raise SystemExit("Export check failed:\n" + "\n".join(changed))
    verb = "Verified" if args.check else "Exported"
    print(f"{verb} {len(outputs)} files; {len(roles)} complete typography roles; {len(tokens.tokens)} token aliases validated; OpenBoa {COMMIT}.")


if __name__ == "__main__":
    main()
