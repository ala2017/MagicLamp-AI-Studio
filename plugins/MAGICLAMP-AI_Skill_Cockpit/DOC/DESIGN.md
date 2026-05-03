# Design System: MAGICLAMP·AI Skill Cockpit

**Project ID:** magiclamp-ai-skill-cockpit

## 1. Visual Theme & Atmosphere

The design language is **"Cyber-Native Immersion."** It blends seamlessly with the VS Code dark environment while elevating it with a futuristic, "head-up display" (HUD) aesthetic. The mood is **Precise, Deep, and Electrified**. It feels like a high-tech instrument panel for a spacecraft: dark, focused, with critical information glowing in neon accents against semi-transparent glass layers.

## 2. Color Palette & Roles

* **Void Black (Background Base)**: `#1e1e1e` (Matches VS Code Sidebar). Serves as the deep canvas.
* **Obsidian Glass (Panel Backgrounds)**: `rgba(30, 30, 30, 0.70)`. Used for cards and sections, allowing subtle backdrop blur (`backdrop-filter: blur(12px)`).
* **Neon Cyber-Green (Success/Active)**: `#00FF9D`. Used for active skill indicators, "Running" status, and success toasts.
* **Electric Azure (Primary Action/Focus)**: `#00BCFF`. Used for primary buttons, selected tabs, and key metrics.
* **Warning Amber (Caution/Latency)**: `#FFC107`. Used for high token warnings or slow responses.
* **Critical Crimson (Error/Stop)**: `#FF0055`. Used for error logs, "Stop" actions, and danger zones.
* **Stardust White (Text Primary)**: `#EEEEEE`. Crisp, high readability.
* **Ghost Grey (Text Secondary)**: `#AAAAAA`. Metadata, timestamps, and labels.

## 3. Typography Rules

* **Font Family**: `Inter` or system-ui for UI labels; `JetBrains Mono` for all code snippets, logs, and token data.
* **Font Family**: `Inter` or system-ui for UI labels; `JetBrains Mono` for all code snippets, logs, and token data.
* **Hierarchy**:
  * **Dashboard Headers**: Light weight, uppercase letter-spacing (`1px`), low contrast.
  * **Data Values**: Monospace, Bold weight, often colored with Neon accents.
  * **Body Text**: Regular weight, high legibility.

## 4. Component Stylings

* **Unified Resource List (The Core)**:
  * **Style**: A high-density data grid or list view. Not giant cards.
  * **Row Item**: Each row displays:
    * **Icon + Name**: Clear identification.
    * **Type Badge**: `Skill` (Blue), `MCP` (Purple), `Extension` (Orange).
    * **Scope Badge**: `Global` (Glass pill), `Project` (Outlined pill).
    * **Tool Support**: Small icons for VS Code / Cursor / Claude, lit up if enabled.
    * **Status**: "Update Available" indicator (Green dot).
  * **Hover**: Row highlights with a "Scanline" effect (`background: rgba(255,255,255,0.05)`).
* **Command Bar (Action Center)**:
  * **Position**: Top of the list.
  * **Input**: "Paste GitHub URL to Install..." - Prominent, full-width glass input field.
  * **Actions**: Filter buttons (All, Updates, Installed).
* **Unified Resource List (The Core)**:
  * **Style**: A high-density data grid or list view. Not giant cards.
  * **Row Item**: Each row displays:
    * **Icon + Name**: Clear identification.
    * **Type Badge**: `Skill` (Blue), `MCP` (Purple), `Extension` (Orange).
    * **Scope Badge**: `Global` (Glass pill), `Project` (Outlined pill).
    * **Tool Support**: Small icons for VS Code / Cursor / Claude, lit up if enabled.
    * **Status**: "Update Available" indicator (Green dot).
* **Command Bar (Action Center)**:
  * **Position**: Top of the list.
  * **Input**: "Paste GitHub URL to Install..." - Prominent, full-width glass input field.
  * **Actions**: Filter buttons (All, Updates, Installed).
* **Editors & Terminals**:
  * **Code View**: Embedded Monaco Editor look for editing skills in-place.
* **Mini-Monitors (Secondary)**:
  * **Token Usage**: Small pill widget in the header, not a giant chart.
  * **Security**: Shield icon in the top right, glows Red if issues found.

## 5. Layout Principles: The "Cockpit" Architecture

Reflecting the "Multi-Module" nature of the application, we adopt a **Side-Nav Layout** (similar to VS Code's Activity Bar but *inside* our Webview).

### 5.1 Global Structure

* **Navigation Rail (Left, 50px)**:
  * A slim, fixed glass column containing Icon Tabs.
  * **Tabs**:
        1. **📊 Console** (Monitor & Manage Installed)
        2. **🛒 Marketplace** (Discover & Sources)
        3. **🛠️ Workshop** (Create & Debug)
        4. **⚙️ Settings** (Config & Security)
  * **Active State**: Neon Glow border on the active icon.
* **Stage (Right, Fluid)**:
  * The dynamic content area that switches based on the specific Tab.

### 5.2 Module Definitions (The "Cards")

#### View A: Console (The Home)

* **Purpose**: Operational management of what is *installed*.
* **Components**: Quick Install Bar, Unified Resource Grid, Status Widgets.

#### View B: Marketplace (Discovery & Sources)

* **Sub-Tabs**:
  * **[Explore]**: Aggregated grid of skills from *all* subscribed registries. Searchable.
  * **[Sources]**: The "Registry Manager".
    * **List**: Cards of subscribed repositories (e.g., "Official", "Company Internal").
    * **Action**: "Add Registry URL" input field with validation.
    * **Viz**: Origin badges (🛡️ Official vs 🌐 Community).

#### View C: Workshop (Creator Studio)

* **Purpose**: Developing new skills without leaving the IDE.
* **Layout**: Split Pane. Left: Form/Editor. Right: Simulation Chat / Preview.

#### View D: Settings (Control Room)

* **Content**: Security Thresholds (Kill Switch settings), API Key management (if using L2 inference), Telemetry opt-in.

## 5. Layout Principles

* **Master-Detail View**:
  * **Left/Top**: The List. This is the primary interactive area.
  * **Right/Bottom (Drawer)**: The Inspector. When a skill is clicked, this opens to show Details, Configuration, and Source Code.
* **Information Hierarchy**:
    1. **Identification**: What is this skill?
    2. **Compatibility & Scope**: Where does it work?
    3. **Maintenance**: Does it need updates?
    4. **Usage**: How much is it costing me? (Token)
