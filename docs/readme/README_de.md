<p align="center">
  <img src="../../apps/desktop/src-tauri/icons/128x128@2x.png" alt="ReqMate" width="96" height="96" />
</p>

<h1 align="center">ReqMate</h1>

<p align="center">
  <strong>Die API-Plattform, die deine Privatsphäre, deinen RAM und deinen Git-Workflow respektiert.</strong>
</p>

<p align="center">
  Kein Login. Keine Cloud. Kein Ballast.
</p>

<p align="center">
  <em>Postman verbraucht 800 MB RAM. ReqMate verbraucht 60 MB.</em>
</p>

<p align="center">
  <a href="https://github.com/anan2620/ReqMate/releases/latest"><img src="https://img.shields.io/github/v/release/anan2620/ReqMate?style=flat-square&color=6366f1" alt="Neueste Version" /></a>
  <a href="https://github.com/anan2620/ReqMate/releases/latest"><img src="https://img.shields.io/github/downloads/anan2620/ReqMate/total?style=flat-square&color=22c55e" alt="Downloads" /></a>
  <a href="https://github.com/anan2620/ReqMate/stargazers"><img src="https://img.shields.io/github/stars/anan2620/ReqMate?style=flat-square&color=eab308" alt="Sterne" /></a>
  <a href="https://github.com/anan2620/ReqMate/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/anan2620/ReqMate/ci.yml?style=flat-square&label=CI" alt="CI" /></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/github/license/anan2620/ReqMate?style=flat-square" alt="MIT-Lizenz" /></a>
</p>

<p align="center">
  <a href="#herunterladen">Herunterladen</a> &bull;
  <a href="#funktionen">Funktionen</a> &bull;
  <a href="#von-postman-wechseln">Von Postman wechseln</a> &bull;
  <a href="#leistung">Leistung</a> &bull;
  <a href="#community">Community</a> &bull;
  <a href="#entwicklung">Entwicklung</a>
</p>

<p align="center">
  <a href="../../README.md">English</a> &bull;
  <a href="README_es.md">Espa&#241;ol</a> &bull;
  <a href="README_fr.md">Fran&#231;ais</a> &bull;
  <a href="README_de.md">Deutsch</a> &bull;
  <a href="README_pt.md">Portugu&#234;s</a> &bull;
  <a href="README_zh.md">&#20013;&#25991;</a> &bull;
  <a href="README_ja.md">&#26085;&#26412;&#35486;</a> &bull;
  <a href="README_ko.md">&#54620;&#44397;&#50612;</a> &bull;
  <a href="README_ar.md">&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577;</a>
</p>

---

## Warum ReqMate?

| | Postman | Bruno | Hoppscotch | **ReqMate** |
|---|---|---|---|---|
| **Framework** | Electron | Electron | Tauri | **Tauri v2** |
| **RAM-Verbrauch** | 300-800 MB | 150-300 MB | 50-80 MB | **~60 MB** |
| **Startzeit** | 10-30s | 3-8s | <2s | **<2s** |
| **Konto erforderlich** | Ja | Nein | Optional | **Nein** |
| **Datenspeicherung** | Cloud | Dateisystem | IndexedDB | **Dateisystem (YAML)** |
| **Git-kompatibel** | Nein | Ja (.bru) | Nein | **Ja (Standard-YAML)** |
| **gRPC** | Ja | Ja | Nein | **Ja** |
| **WebSocket** | Ja | Nein | Ja | **Ja** |
| **SSE** | Ja | Nein | Ja | **Ja** |
| **MQTT** | Nein | Nein | Nein | **Ja** |
| **Mock-Server** | Nur Cloud | Nein | Nein | **Lokal** |
| **Monitore** | Nur Cloud | Nein | Nein | **Lokal** |
| **Plugin-System** | Nein | Nein | Nein | **JS + WASM** |
| **Proxy-Erfassung** | Nein | Nein | Nein | **Ja** |
| **Antwortvergleich** | Nein | Nein | Nein | **Ja** |

## Herunterladen

**[Neueste Version](https://github.com/anan2620/ReqMate/releases/latest)**

| Plattform | Download |
|----------|----------|
| **Windows** | [`.exe`-Installer](https://github.com/anan2620/ReqMate/releases/latest) &bull; [`.msi`](https://github.com/anan2620/ReqMate/releases/latest) |
| **macOS** | [Apple Silicon `.dmg`](https://github.com/anan2620/ReqMate/releases/latest) &bull; [Intel `.dmg`](https://github.com/anan2620/ReqMate/releases/latest) |
| **Linux** | [`.AppImage`](https://github.com/anan2620/ReqMate/releases/latest) &bull; [`.deb`](https://github.com/anan2620/ReqMate/releases/latest) &bull; [`.rpm`](https://github.com/anan2620/ReqMate/releases/latest) |

<details>
<summary><strong>Paketmanager</strong></summary>

```bash
# Homebrew (macOS/Linux) — demnächst verfügbar
brew install --cask reqmate

# Chocolatey (Windows) — demnächst verfügbar
choco install reqmate

# Snap (Linux) — demnächst verfügbar
sudo snap install reqmate

# AUR (Arch Linux) — demnächst verfügbar
yay -S reqmate-bin
```

Interesse, ein Paket zu pflegen? [Erstelle ein Issue](https://github.com/anan2620/ReqMate/issues/new) und wir arbeiten mit dir zusammen.
</details>

<details>
<summary><strong>Aus dem Quellcode bauen</strong></summary>

**Voraussetzungen:** Node.js 22+, pnpm 10+, Rust-Toolchain, [Tauri v2 Systemabhängigkeiten](https://v2.tauri.app/start/prerequisites/)

```bash
git clone https://github.com/anan2620/ReqMate.git
cd reqmate
pnpm install
pnpm tauri build
```
</details>

## Von Postman wechseln

1. Exportiere deine Postman-Collection (Collection v2.1 JSON)
2. Öffne ReqMate
3. `Ctrl+K` > „Collection importieren" > wähle deine Datei
4. Fertig. Deine Anfragen sind jetzt YAML-Dateien, die dir gehören.

Importiert auch aus: **Insomnia**, **Bruno**, **Hoppscotch**, **OpenAPI 3.x**, **HAR**, **cURL**.

## Funktionen

**Multi-Protokoll** — REST, GraphQL, gRPC, WebSocket, SSE, MQTT, Socket.IO in einer App. Kein anderes Tool bietet eine breitere Protokollabdeckung.

**Lokaler Speicher** — Jede Anfrage ist eine `.yaml`-Datei. Collections sind Verzeichnisse. Alles ist Git-diff-kompatibel. Keine proprietären Formate.

**Dark Mode + Themes** — Dunkles, helles und schwarzes/OLED-Theme mit 8 Akzentfarben.

**TypeScript-Scripting** — Pre/Post-Request-Skripte mit vollständigen Typdefinitionen. `req.test()`, `req.expect()`, `req.env.set()`.

**Collection Runner** — Führe ganze Collections mit datengetriebenen Tests (CSV/JSON), konfigurierbaren Iterationen und JUnit/HTML-Berichten aus.

**Lokale Mock-Server** — Erstelle simulierte APIs aus deinen Collections. Faker.js-Daten, Latenzsimulation, Fehlerinjektion. Keine Cloud, keine Nutzungslimits.

**Geplante Überwachung** — Cron-basierte automatisierte Tests mit Desktop-Benachrichtigungen und Webhook-Alerts. Läuft lokal, nicht auf dem Server eines anderen.

**API-Dokumentationsgenerierung** — Generiere HTML- + Markdown-Dokumentation aus deinen Collections.

**OpenAPI-Editor** — Bearbeite und validiere OpenAPI-Spezifikationen mit Spectral-Integration.

**Antwortvergleich** — Vergleiche Antworten nebeneinander zwischen verschiedenen Ausführungen.

**Proxy-Erfassung** — Lokaler abfangender HTTP/HTTPS-Proxy für Traffic-Inspektion und -Wiedergabe.

**KI-Assistent** — Von natürlicher Sprache zu Anfragen, automatische Testgenerierung, OpenAI-kompatible API.

**Plugin-System** — Erweitere ReqMate mit JavaScript- oder WASM-Plugins.

**Importiere alles** — Postman, Insomnia, Bruno, Hoppscotch, OpenAPI, HAR, cURL. Migration mit einem Klick.

## Leistung

Gebaut mit Tauri v2 (Rust-Backend + native OS-Webview), nicht mit Electron.

| Metrik | Zielwert |
|---|---|
| Binärgröße | ~20 MB |
| RAM im Leerlauf | ~60 MB |
| Kaltstart | <2s |
| Anfrage-Sendelatenz | <10ms Overhead |

## Datenformat

Deine Daten sind reines YAML. Kein Vendor-Lock-in. Keine proprietäre Kodierung.

```yaml
# users/create-user.yaml
name: Create User
method: POST
url: "{{baseUrl}}/api/users"

headers:
  Content-Type: application/json

auth:
  type: bearer
  token: "{{adminToken}}"

body:
  type: json
  content: |
    {
      "name": "{{userName}}",
      "email": "{{userEmail}}"
    }

assert:
  status: 201
  body.id: { type: string }
  responseTime: { lt: 2000 }

tests: |
  req.test("should return created user", () => {
    const body = req.response.json();
    req.expect(body).to.have.property("id");
  });
```

## CLI

```bash
# Eine Collection ausführen
reqmate run ./my-collection --env production

# Mit datengetriebenen Tests
reqmate run ./my-collection --data users.csv --reporter junit

# Eine Postman-Collection importieren
reqmate import postman-export.json
```

## Kein-Lock-in-Versprechen

> Wenn du dich entscheidest, ReqMate zu verlassen, gehen deine Daten mit dir. Jede Datei liegt in einem Standardformat vor. Jede Datenbank ist offen. Wir werden den Wechsel niemals erschweren.

## Community

- [Discord](https://discord.gg/reqmate) — Chat, Fragen und Feedback
- [Twitter / X](https://x.com/apiabordes) — Updates und Ankündigungen
- [GitHub Discussions](https://github.com/anan2620/ReqMate/discussions) — Ideen, Fragen & Antworten, Projekte zeigen
- [GitHub Issues](https://github.com/anan2620/ReqMate/issues) — Fehlermeldungen und Feature-Anfragen

## Übersetzungen

Die ReqMate-Oberfläche unterstützt Internationalisierung über `react-i18next`. Derzeit verfügbar auf **Englisch**.

Hilf uns, ReqMate in deine Sprache zu übersetzen! Schau dir das Verzeichnis [`locales/`](../../apps/desktop/src/locales/) an und reiche einen PR ein.

## Entwicklung

```bash
# Abhängigkeiten installieren
pnpm install

# Im Entwicklungsmodus starten
pnpm tauri dev

# TypeScript-Prüfung
pnpm -C apps/desktop exec tsc --noEmit

# Für Produktion bauen
pnpm tauri build
```

### Projektstruktur

```
reqmate/
├── apps/
│   ├── desktop/           # Tauri v2 Desktop-Anwendung
│   │   ├── src/           # React-Frontend
│   │   └── src-tauri/     # Rust-Backend
│   ├── cli/               # CLI-Tool (Rust)
│   ├── mcp-server/        # MCP-Server für KI-Editoren
│   └── vscode-extension/  # VS Code-Erweiterung
├── packages/
│   ├── types/             # Gemeinsame TypeScript-Typen
│   └── importer/          # Collection-Importierer
└── docs/                  # Documentation
```

### Tech-Stack

**Frontend:** React 19, TypeScript, Vite 6, Zustand, Tailwind CSS 4, Monaco Editor, Radix UI

**Backend:** Rust, Tauri v2, reqwest, tokio, tonic (gRPC), axum (Mock-Server), deno_core (Scripting)

## Mitwirken

Contributions are welcome! Check out the [GitHub Issues](https://github.com/anan2620/ReqMate/issues) for open tasks and feature requests.

<a href="https://github.com/anan2620/ReqMate/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=anan2620/ReqMate" alt="Mitwirkende" />
</a>

## Lizenz

[MIT](../../LICENSE)

---

<p align="center">
  <sub>Wenn ReqMate deinen Workflow verbessert, gib dem Projekt einen Stern. Das hilft anderen, es zu entdecken.</sub>
</p>
