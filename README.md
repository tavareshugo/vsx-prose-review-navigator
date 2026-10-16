# Prose Review Navigator

[![MIT license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![AI Generated](https://www.aihonestybadge.com/badges/ai-generated-small.svg)](https://www.aihonestybadge.com)

Prose Review Navigator shows `REVIEW:START` / `REVIEW:END` annotations in the active Markdown, Quarto, or R Markdown document.

## Use

1. Open the **Prose Review** view from the Activity Bar.
2. Move the view container to the Secondary Side Bar if you want it on the right.
3. Expand a category and select a finding to reveal its annotated source region.
4. Select a finding to reveal its annotated source region.
   The toolbar toggle shows **Collapse All** while any category is expanded and **Expand All** when every category is collapsed.

The extension recognises the following marker form:

```markdown
<!-- REVIEW:START FILLER VAGUE -->
The flagged paragraph.
<!-- REVIEW:END -->
```

The start marker must be immediately followed by the flagged content, and the end marker must immediately follow it.
The navigator reports malformed marker pairs in a separate group without stopping navigation to valid findings.

## Installation

### Pre-built VSIX

Download the pre-built `.vsix` file from the [GitHub releases page](https://github.com/tavareshugo/vsx-prose-review-navigator/releases).

Then, install with:

```bash
positron --install-extension prose-review-navigator-0.1.0.vsix
code --install-extension prose-review-navigator-0.1.0.vsix
```

### Development

Clone or download the repository and open the extension directory in a VS Code-compatible IDE:

```bash
git clone https://github.com/tavareshugo/vsx-prose-review-navigator.git
cd prose-review-navigator
```

Then open the directory in Positron or VS Code.

Press **F5** and select:

```text
VS Code Extension Developer
```

This launches an Extension Development Host containing the extension.

You can then test it in `.md`, `.qmd`, and `.sh` files.

### Build VSIX from source

To create an installable VSIX package from the source code, install the VS Code Extension Manager:

```bash
npm install --global @vscode/vsce
```

Then clone and create the VSIX from the extension directory:

```bash
git clone https://github.com/tavareshugo/vsx-prose-review-navigator.git
cd prose-review-navigator
vsce package
```

This produces a file such as:

```text
prose-review-navigator-0.1.0.vsix
```

The resulting VSIX can be installed into compatible Code-derived IDEs using their **Install from VSIX** functionality or their command-line interface.
