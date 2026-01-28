# Wing

An AI-powered Chrome extension for intelligent bookmarking. Save pages, organize them hierarchically, highlight text with annotations, and query your saved content using natural language.

## Features

### Wing It
Save any webpage with a single click. Wing automatically captures the page title, URL, favicon, and generates an AI-powered summary of the content.

### Hierarchical Organization
Organize your winged pages using a flexible hierarchy:
- **Collections** - Top-level folders with custom colors
- **Nests** - Nested sub-folders within collections (unlimited depth)
- **Wings** - Your saved pages, assignable to multiple collections

### Text Highlighting & Annotations
On any winged page:
- Select text to create highlights
- Add optional annotations to your highlights
- Highlights automatically restore when you revisit the page

### Smart Connections
Wing uses AI to find relationships between your saved pages based on semantic similarity. Discover connections you might have missed.

### Natural Language Queries
Ask questions about your saved content:
- "What have I saved about machine learning?"
- "Summarize my research on climate change"
- "Which pages discuss JavaScript frameworks?"

Wing searches your winged pages and provides AI-generated answers with citations.

## Installation

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/abhi-raheja/wing-app.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **Load unpacked** and select the `wing-app` folder

5. The Wing icon should appear in your toolbar

### Configure AI Features

1. Click the Wing icon → **Options** (gear icon)
2. Select your AI provider (Anthropic, OpenAI, or Google)
3. Enter your API key and click **Validate & Save**

## Usage

### Saving a Page
1. Navigate to any webpage you want to save
2. Click the Wing icon in your toolbar
3. Click **Wing It**
4. (Optional) Select collections to organize it
5. Click **Save Wing**

The page is saved and an AI summary generates in the background.

### Creating Highlights
1. Visit a page you've previously winged
2. Select any text on the page
3. Click **Highlight** in the tooltip that appears
4. (Optional) Add an annotation
5. Click **Save**

### Asking Questions
1. Click the Wing icon
2. Go to the **Ask AI** tab
3. Type your question
4. Press **Ask Wing AI** or `Cmd/Ctrl + Enter`

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Shift + W` | Open Wing popup |
| `Escape` | Close any modal |
| `Cmd/Ctrl + Enter` | Submit AI query |

## Tech Stack

- **Platform**: Chrome Extension (Manifest V3)
- **Frontend**: Vanilla JavaScript, CSS
- **Storage**: IndexedDB (local, no cloud sync)
- **AI**: Multi-provider support (Anthropic Claude, OpenAI GPT, Google Gemini)

## Data Privacy

All your data is stored locally on your device using IndexedDB. Wing does not sync data to any cloud service. The only external calls are to your chosen AI provider for:
- Generating summaries
- Finding connections
- Answering queries

Your API key is stored in Chrome's secure storage and is never transmitted except to your selected AI provider.

## Export & Import

Wing supports full data portability:
- **Export**: Download all your data as a JSON file
- **Import**: Restore from a previous export (merge or replace)

Access these options in **Settings** → **Data Management**.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.
