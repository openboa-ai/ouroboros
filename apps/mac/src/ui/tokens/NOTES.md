# OpenBoa calibration adapter

The generated CSS, typography JSON and original assets come from OpenBoa commit `e93f55cbfd90b668ef9d77875f71d8e53f7ceb4b` (release 2026.08.23). `public/brand/manifest.json` records byte hashes and exact source links. The font license has trailing horizontal whitespace removed with its original source hash retained; its wording is unchanged. This is a calibration adapter; it does not claim product integration or completed visual verification.

- Import `openboa.css` from the application stylesheet. Remove starter theme/font values that override it. Map Tailwind's `--font-sans` to `--ob-font-sans` and radius utilities to the actual `--ob-radius-*` tokens; do not retain shadcn's computed radius scale.
- Use exactly one `.type-{role}` per text element. Treat size, weight, line height, tracking and width as one composite. Do not add `text-sm`, `font-semibold`, `leading-*`, `tracking-*`, inline font values or a font shorthand to override part of a role. Components should choose a role, not invent a new typographic scale.
- Apply `.type-tabular` separately to numerical comparisons. Keep units and timestamp typography role-based. Use semantic color variables for state and interaction; the `--ob-data-*` palette is available for quantitative display, without assigning investment meaning to generic success/error tokens.
- The bundled Martian Grotesk is the OpenBoa UI face. Apple SD Gothic Neo and system-ui are explicitly documented Korean/system fallbacks, not OpenBoa token changes. Korean glyph metrics must be visually checked on the Mac; a CSS family string alone does not prove that a particular glyph used Martian.
- The symbol SVGs are unmodified approved masters. Use primary/carbon on appropriate light surfaces and reverse on dark surfaces, preserve aspect ratio, and respect the source minimum size and clear space in `public/brand/USAGE.md`. The identity files retain their original license; only the font is OFL-licensed.

Regenerate from the local Git object database:

```sh
python3 scripts/export-brand-tokens.py --source-repo /path/to/openboa-brand-system
python3 scripts/export-brand-tokens.py --source-repo /path/to/openboa-brand-system --check
```

The calibration can also regenerate and validate its own vendored snapshot without a sibling checkout:

```sh
python3 scripts/export-brand-tokens.py --from-vendored --check
```

`typography.json` is a flat map of the eight roles. `lineHeight` preserves the original unitless value; `lineHeightPx` rounds its pixel equivalent to six decimal places for computed-style comparisons. Browser geometry can round further. Visual/DOM checks remain a separate step from export/hash verification.
