import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as child_process from "child_process";

let collectionTreeProvider: CollectionTreeProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Find collections in workspace
  collectionTreeProvider = new CollectionTreeProvider();
  vscode.window.registerTreeDataProvider(
    "reqmateCollections",
    collectionTreeProvider
  );

  // Set context for view visibility
  findCollections().then((collections) => {
    vscode.commands.executeCommand(
      "setContext",
      "reqmate.hasCollections",
      collections.length > 0
    );
  });

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("reqmate.openCollection", openCollection),
    vscode.commands.registerCommand("reqmate.sendRequest", sendRequest),
    vscode.commands.registerCommand("reqmate.runCollection", runCollection),
    vscode.commands.registerCommand("reqmate.openInApp", openInApp)
  );

  // Watch for YAML file saves
  const watcher = vscode.workspace.createFileSystemWatcher("**/*.yaml");
  watcher.onDidChange(() => collectionTreeProvider?.refresh());
  watcher.onDidCreate(() => collectionTreeProvider?.refresh());
  watcher.onDidDelete(() => collectionTreeProvider?.refresh());
  context.subscriptions.push(watcher);
}

export function deactivate() {}

const CONFIG_DIR = ".reqmate";
const CONFIG_FILE = "reqmate.yaml";

/** Path of a collection's metadata file. */
function collectionConfigPath(collectionDir: string): string {
  return path.join(collectionDir, CONFIG_DIR, CONFIG_FILE);
}

function isCollection(collectionDir: string): boolean {
  return fs.existsSync(collectionConfigPath(collectionDir));
}

async function findCollections(): Promise<string[]> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return [];

  const collections: string[] = [];
  for (const folder of folders) {
    if (isCollection(folder.uri.fsPath)) {
      collections.push(folder.uri.fsPath);
    }

    // Also check subdirectories one level deep
    try {
      const entries = fs.readdirSync(folder.uri.fsPath, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDir = path.join(folder.uri.fsPath, entry.name);
          if (isCollection(subDir)) {
            collections.push(subDir);
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return collections;
}

async function openCollection() {
  const folders = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    openLabel: "Open Collection",
  });
  if (!folders || folders.length === 0) return;

  const configPath = collectionConfigPath(folders[0].fsPath);
  if (!fs.existsSync(configPath)) {
    vscode.window.showWarningMessage(
      "Selected folder is not a ReqMate collection (missing .reqmate/reqmate.yaml)"
    );
    return;
  }

  collectionTreeProvider?.refresh();
}

async function sendRequest(uri?: vscode.Uri) {
  const filePath = uri?.fsPath ?? vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!filePath || !filePath.endsWith(".yaml")) {
    vscode.window.showWarningMessage("Select a .yaml request file");
    return;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const outputChannel = vscode.window.createOutputChannel("ReqMate");
  outputChannel.show();
  outputChannel.appendLine(`Sending request from: ${filePath}`);
  outputChannel.appendLine("---");

  // Try to use reqmate CLI
  try {
    const collectionPath = findParentCollection(filePath);
    if (!collectionPath) {
      outputChannel.appendLine("Could not determine collection path");
      return;
    }

    const result = child_process.execSync(
      `reqmate run "${collectionPath}" --reporter json`,
      { encoding: "utf-8", timeout: 30000 }
    );
    outputChannel.appendLine(result);
  } catch (err) {
    outputChannel.appendLine(
      `Error: ${err instanceof Error ? err.message : String(err)}`
    );
    outputChannel.appendLine(
      "\nMake sure the reqmate CLI is installed: npm install -g @reqmate/cli"
    );
  }
}

async function runCollection() {
  const collections = await findCollections();
  if (collections.length === 0) {
    vscode.window.showWarningMessage("No ReqMate collections found in workspace");
    return;
  }

  const selected =
    collections.length === 1
      ? collections[0]
      : await vscode.window.showQuickPick(collections, {
          placeHolder: "Select a collection to run",
        });

  if (!selected) return;

  const terminal = vscode.window.createTerminal("ReqMate");
  terminal.show();
  terminal.sendText(`reqmate run "${selected}"`);
}

async function openInApp(uri?: vscode.Uri) {
  const filePath = uri?.fsPath ?? vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!filePath) return;

  // Try to open via deep link
  const collectionPath = findParentCollection(filePath);
  if (collectionPath) {
    const requestPath = path.relative(collectionPath, filePath);
    const deepLink = `reqmate://open?collection=${encodeURIComponent(collectionPath)}&request=${encodeURIComponent(requestPath)}`;
    vscode.env.openExternal(vscode.Uri.parse(deepLink));
  }
}

function findParentCollection(filePath: string): string | null {
  let dir = path.dirname(filePath);
  while (dir !== path.dirname(dir)) {
    if (isCollection(dir)) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

// Tree data provider for the sidebar
class CollectionTreeProvider
  implements vscode.TreeDataProvider<CollectionTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    CollectionTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CollectionTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(
    element?: CollectionTreeItem
  ): Promise<CollectionTreeItem[]> {
    if (!element) {
      // Root: list collections
      const collections = await findCollections();
      return collections.map(
        (c) =>
          new CollectionTreeItem(
            path.basename(c),
            c,
            "collection",
            vscode.TreeItemCollapsibleState.Collapsed
          )
      );
    }

    // Children: list files in collection
    const items: CollectionTreeItem[] = [];
    try {
      const entries = fs.readdirSync(element.collectionPath, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;

        const fullPath = path.join(element.collectionPath, entry.name);
        if (entry.isDirectory()) {
          items.push(
            new CollectionTreeItem(
              entry.name,
              fullPath,
              "folder",
              vscode.TreeItemCollapsibleState.Collapsed
            )
          );
        } else if (
          entry.name.endsWith(".yaml") &&
          !entry.name.startsWith("_")
        ) {
          // Try to read method from the file
          let method = "?";
          try {
            const content = fs.readFileSync(fullPath, "utf-8");
            const methodMatch = content.match(/^method:\s*(\w+)/m);
            if (methodMatch) method = methodMatch[1];
          } catch {
            // ignore
          }

          const label = entry.name.replace(".yaml", "");
          items.push(
            new CollectionTreeItem(
              `${method} ${label}`,
              fullPath,
              "request",
              vscode.TreeItemCollapsibleState.None
            )
          );
        }
      }
    } catch {
      // ignore
    }

    return items;
  }
}

class CollectionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collectionPath: string,
    public readonly itemType: "collection" | "folder" | "request",
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);

    if (itemType === "request") {
      this.command = {
        command: "vscode.open",
        title: "Open",
        arguments: [vscode.Uri.file(collectionPath)],
      };
      this.contextValue = "reqmateRequest";
    } else if (itemType === "collection") {
      this.contextValue = "reqmateCollection";
    }
  }
}
