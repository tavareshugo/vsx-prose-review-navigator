import * as vscode from "vscode";
import * as path from "node:path";
import {
  parseReviewMarkers,
  type ReviewDiagnostic,
  type ReviewFinding
} from "./reviewParser";

const supportedExtensions = new Set([".md", ".qmd", ".rmd"]);
const categoryDescriptions: Readonly<Record<string, string>> = {
  FILLER: "Words or phrases that add length without adding meaning.",
  PASSIVE: "Passive constructions where naming the relevant agent would clarify who performs the action.",
  NOMINALISATION: "Verbs buried in noun constructions that weaken the sentence.",
  REPETITION: "Repeated words, phrases, or sentence structures in close proximity without a deliberate rhetorical effect.",
  "MISSING-CONTEXT": "A technical term, tool, flag, or concept that has not been introduced and may be unfamiliar to learners.",
  "MISSING-INTERPRETATION": "A result or output is shown without guidance about what learners should look for.",
  SEQUENCING: "A concept, term, or tool is used before it has been introduced.",
  DENSE: "A paragraph introduces, explains, implements, and qualifies too much at once.",
  TRANSITION: "The connection between paragraphs or sections is abrupt or missing.",
  VAGUE: "A claim cannot be evaluated or acted on.",
  HEADING: "A heading is inaccurate or too generic for the section beneath it."
};

class CategoryItem extends vscode.TreeItem {
  constructor(
    readonly category: string,
    readonly findings: readonly ReviewFinding[],
    expanded: boolean,
    generation: number
  ) {
    super(
      category,
      expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.id = `review-category-${generation}-${category}`;
    this.description = String(findings.length);
    this.contextValue = "proseReviewCategory";
    this.iconPath = new vscode.ThemeIcon("tag");
    this.tooltip = categoryDescriptions[category] ?? `Review category: ${category}.`;
  }
}

class FindingItem extends vscode.TreeItem {
  constructor(
    readonly finding: ReviewFinding,
    private readonly document: vscode.TextDocument
  ) {
    super(findingLabel(document, finding), vscode.TreeItemCollapsibleState.None);
    this.description = `line ${finding.contentStartLine + 1}`;
    this.contextValue = "proseReviewFinding";
    this.iconPath = new vscode.ThemeIcon("comment");
    this.command = {
      command: "proseReviewNavigator.reveal",
      title: "Reveal Review Finding",
      arguments: [finding]
    };
  }
}

class DiagnosticItem extends vscode.TreeItem {
  constructor(
    readonly diagnostic: ReviewDiagnostic,
    private readonly document: vscode.TextDocument
  ) {
    super(diagnostic.message, vscode.TreeItemCollapsibleState.None);
    this.description = `line ${diagnostic.line + 1}`;
    this.contextValue = "proseReviewDiagnostic";
    this.iconPath = new vscode.ThemeIcon("warning");
    this.command = {
      command: "proseReviewNavigator.revealDiagnostic",
      title: "Reveal Review Marker",
      arguments: [diagnostic]
    };
  }
}

class DiagnosticsGroupItem extends vscode.TreeItem {
  constructor(readonly diagnostics: readonly ReviewDiagnostic[]) {
    super("Malformed review markers", vscode.TreeItemCollapsibleState.Expanded);
    this.description = String(diagnostics.length);
    this.iconPath = new vscode.ThemeIcon("warning");
  }
}

type ReviewTreeItem =
  | CategoryItem
  | FindingItem
  | DiagnosticsGroupItem
  | DiagnosticItem;

class ReviewNavigatorProvider implements vscode.TreeDataProvider<ReviewTreeItem> {
  private readonly changeEmitter = new vscode.EventEmitter<ReviewTreeItem | undefined>();
  readonly onDidChangeTreeData = this.changeEmitter.event;
  private document: vscode.TextDocument | undefined;
  private findings: readonly ReviewFinding[] = [];
  private diagnostics: readonly ReviewDiagnostic[] = [];
  private categoryItems: readonly CategoryItem[] = [];
  private findingItems = new Map<ReviewFinding, ReadonlyMap<string, FindingItem>>();
  private diagnosticItems: readonly DiagnosticItem[] = [];
  private diagnosticGroup: DiagnosticsGroupItem | undefined;
  private categoriesExpanded = true;
  private categoryGeneration = 0;

  refresh(editor = vscode.window.activeTextEditor): void {
    this.document = editor && isSupported(editor.document) ? editor.document : undefined;

    if (!this.document) {
      this.findings = [];
      this.diagnostics = [];
    } else {
      const result = parseReviewMarkers(this.document.getText().split(/\r?\n/));
      this.findings = result.findings;
      this.diagnostics = result.diagnostics;
    }

    this.rebuildItems();
    this.changeEmitter.fire(undefined);
  }

  getFindings(category?: string): readonly ReviewFinding[] {
    const findings = category
      ? this.findings.filter((finding) => finding.categories.includes(category))
      : this.findings;

    return [...findings].sort(
      (left, right) => left.contentStartLine - right.contentStartLine
    );
  }

  getDocument(): vscode.TextDocument | undefined {
    return this.document;
  }

  getCategoryItems(): readonly CategoryItem[] {
    return this.categoryItems;
  }

  areCategoriesExpanded(): boolean {
    return this.categoriesExpanded;
  }

  setCategoriesExpanded(expanded: boolean): void {
    this.categoriesExpanded = expanded;
    this.categoryGeneration += 1;
    this.rebuildItems();
    this.changeEmitter.fire(undefined);
  }

  getTreeItem(element: ReviewTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ReviewTreeItem): ReviewTreeItem[] {
    if (!this.document) {
      return [];
    }

    if (!element) {
      return this.diagnosticGroup
        ? [...this.categoryItems, this.diagnosticGroup]
        : [...this.categoryItems];
    }

    if (element instanceof CategoryItem) {
      return element.findings.map((finding) =>
        this.findingItems.get(finding)!.get(element.category)!
      );
    }

    if (element instanceof DiagnosticsGroupItem) {
      return [...this.diagnosticItems];
    }

    return [];
  }

  private rebuildItems(): void {
    this.categoryItems = [];
    this.findingItems = new Map();
    this.diagnosticItems = [];
    this.diagnosticGroup = undefined;

    if (!this.document) {
      return;
    }

    const categories = new Map<string, ReviewFinding[]>();
    for (const finding of this.findings) {
      for (const category of finding.categories) {
        categories.set(category, [...(categories.get(category) ?? []), finding]);
      }
    }

    this.categoryItems = [...categories.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([category, findings]) =>
          new CategoryItem(
            category,
            findings,
            this.categoriesExpanded,
            this.categoryGeneration
          )
      );

    for (const categoryItem of this.categoryItems) {
      for (const finding of categoryItem.findings) {
        const categoryItems = new Map(this.findingItems.get(finding));
        categoryItems.set(
          categoryItem.category,
          new FindingItem(finding, this.document)
        );
        this.findingItems.set(finding, categoryItems);
      }
    }

    this.diagnosticItems = this.diagnostics.map(
      (diagnostic) => new DiagnosticItem(diagnostic, this.document!)
    );
    this.diagnosticGroup = this.diagnostics.length
      ? new DiagnosticsGroupItem(this.diagnostics)
      : undefined;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new ReviewNavigatorProvider();
  const view = vscode.window.createTreeView("proseReviewNavigator.findings", {
    treeDataProvider: provider,
    showCollapseAll: false
  });
  let expandedCategories = new Set<string>();

  const updateExpansionToggle = (): void => {
    const categories = provider.getCategoryItems();
    const hasCategories = categories.length > 0;
    const allCategoriesCollapsed = hasCategories &&
      categories.every((category) => !expandedCategories.has(category.category));

    void vscode.commands.executeCommand(
      "setContext",
      "proseReviewNavigator.hasCategories",
      hasCategories
    );
    void vscode.commands.executeCommand(
      "setContext",
      "proseReviewNavigator.allCategoriesCollapsed",
      allCategoriesCollapsed
    );
  };

  const refresh = (): void => {
    provider.refresh();
    expandedCategories = provider.areCategoriesExpanded()
      ? new Set(provider.getCategoryItems().map((category) => category.category))
      : new Set();
    updateExpansionToggle();
    view.message = provider.getDocument()
      ? provider.getFindings().length
        ? undefined
        : "No review findings in the active document."
      : "Open a Markdown, Quarto, or R Markdown document.";
  };

  context.subscriptions.push(
    view,
    view.onDidExpandElement((event) => {
      if (event.element instanceof CategoryItem) {
        expandedCategories.add(event.element.category);
        updateExpansionToggle();
      }
    }),
    view.onDidCollapseElement((event) => {
      if (event.element instanceof CategoryItem) {
        expandedCategories.delete(event.element.category);
        updateExpansionToggle();
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(refresh),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        refresh();
      }
    }),
    vscode.commands.registerCommand("proseReviewNavigator.reveal", (finding: ReviewFinding) =>
      revealFinding(provider, finding)
    ),
    vscode.commands.registerCommand(
      "proseReviewNavigator.revealDiagnostic",
      (diagnostic: ReviewDiagnostic) => revealLine(provider, diagnostic.line)
    ),
    vscode.commands.registerCommand("proseReviewNavigator.expandAll", () => {
      provider.setCategoriesExpanded(true);
      expandedCategories = new Set(
        provider.getCategoryItems().map((category) => category.category)
      );
      updateExpansionToggle();
    }),
    vscode.commands.registerCommand("proseReviewNavigator.collapseAll", () => {
      provider.setCategoriesExpanded(false);
      expandedCategories = new Set();
      updateExpansionToggle();
    })
  );

  refresh();
}

function isSupported(document: vscode.TextDocument): boolean {
  return supportedExtensions.has(path.extname(document.fileName).toLowerCase());
}

function findingLabel(document: vscode.TextDocument, finding: ReviewFinding): string {
  const firstLine = document.lineAt(finding.contentStartLine).text.trim();
  return firstLine || `Review finding at line ${finding.contentStartLine + 1}`;
}

async function revealFinding(
  provider: ReviewNavigatorProvider,
  finding: ReviewFinding
): Promise<void> {
  const document = provider.getDocument();
  if (!document) {
    return;
  }

  const end = document.lineAt(finding.contentEndLine).range.end;
  const range = new vscode.Range(finding.contentStartLine, 0, end.line, end.character);
  const editor = await vscode.window.showTextDocument(document);
  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
}

async function revealLine(
  provider: ReviewNavigatorProvider,
  line: number
): Promise<void> {
  const document = provider.getDocument();
  if (!document) {
    return;
  }

  const range = document.lineAt(line).range;
  const editor = await vscode.window.showTextDocument(document);
  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
}

export function deactivate(): void {}
