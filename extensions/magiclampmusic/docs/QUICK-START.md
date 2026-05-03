# Magic Lamp Music Studio - Quick Start Guide

## Installation

### Option 1: Install from VSIX (Recommended)
```bash
# Package the extension
npx vsce package

# Install in VS Code
# Method A: Command line
code --install-extension magiclampmusic-0.0.1.vsix

# Method B: VS Code UI
# 1. Open VS Code
# 2. Go to Extensions (Ctrl+Shift+X)
# 3. Click "..." menu → "Install from VSIX..."
# 4. Select magiclampmusic-0.0.1.vsix
```

### Option 2: Debug Mode (F5)
1. Open this project in VS Code
2. Press F5 to launch Extension Development Host
3. In the new window, open the Magic Lamp sidebar

## First Time Setup

### 1. Configure API Keys

#### Gemini API Key (for AI features)
```
Command Palette (Ctrl+Shift+P) → "Magic Lamp: Set Gemini API Key"
```

#### Suno API Key (for music generation)
```
Command Palette (Ctrl+Shift+P) → "Magic Lamp: Set Suno API Key"
```

### 2. Configure Suno Base URL (if using custom endpoint)
```json
// settings.json
{
  "magiclampmusic.sunoBaseUrl": "http://localhost:3000"
}
```

## Workflow

### Step 1: Lyrics Studio 📝
1. Click "Lyrics Studio" in sidebar
2. Enter your song title
3. Fill in Creative Brief (optional but recommended):
   - Emotion tags (愤怒, 悲伤, 励志, etc.)
   - Theme tags (社会批判, 个人成长, etc.)
   - Style references (NF, Eminem, GAI, etc.)
   - Perspective (第一人称, 第二人称, etc.)
   - Language style (街头口语, 诗意文学, etc.)
   - Motivation (why you're writing this song)
4. Write your original lyrics in the left panel
5. Enter optimization instructions (e.g., "更多押韵", "副歌更有力")
6. Click "Optimize" button
7. Review AI-optimized lyrics in right panel
8. Edit as needed and save

### Step 2: Style Director 🎵
1. Click "Style Director" in sidebar
2. Your lyrics from Step 1 are automatically loaded
3. Review the Creative Brief context
4. Click "开始风格匹配" button
5. AI analyzes your lyrics and generates:
   - Style analysis report
   - Suno AI prompt (optimized for music generation)
6. Copy the Suno prompt or proceed to next step

### Step 3: Audio Generator 🎼
1. Click "Audio Generator" in sidebar
2. **Sync Data** (recommended):
   - Click "同步" next to lyrics to pull optimized lyrics
   - Click "同步" next to style prompt to pull generated prompt
3. **Or manually enter**:
   - Paste/edit lyrics in the lyrics textarea
   - Enter Suno style prompt (50-150 characters recommended)
4. **Configure Options**:
   - Choose music type: 🎤 Vocal or 🎹 Instrumental
   - Select model: V3.5 (stable), V4 (recommended), or V5 (latest)
5. Click "🎵 生成音乐" button
6. Wait for generation (may take 1-2 minutes)
7. **Generated tracks appear in right panel**:
   - Cover image
   - Track title and metadata
   - Play/Pause button
   - Like button (heart icon)
   - Download button
   - Delete button

### Step 4: Post-Production (Optional)

#### Audio Analysis 📊
- Upload generated audio file
- Get BPM, key, energy, loudness analysis
- Use insights for mastering

#### Artwork Generator 🎨
- Generate album cover art
- Based on your lyrics and style
- Uses AI image generation

#### MV Director 🎬
- Generate music video script
- Scene-by-scene breakdown
- Visual prompts for each scene

## Tips & Tricks

### Lyrics Optimization
- Be specific in your optimization prompt
- Examples:
  - "加强押韵，特别是副歌部分"
  - "让语言更街头化，加入俚语"
  - "增加情感张力，使用更强烈的词汇"
  - "简化表达，让歌词更容易记忆"

### Style Prompts
- Good prompts describe:
  - Genre (hip-hop, trap, R&B, rock, etc.)
  - Tempo (fast, slow, mid-tempo)
  - Mood (aggressive, melancholic, uplifting)
  - Instruments (808 bass, piano, guitar, strings)
  - Production style (lo-fi, polished, raw)
- Example: "aggressive hip-hop, dark trap beat, heavy 808 bass, fast tempo, raw vocals"

### Music Generation
- **Vocal vs Instrumental**:
  - Vocal: AI sings your lyrics
  - Instrumental: Pure music, no vocals
- **Model Selection**:
  - V3.5: Most stable, faster generation
  - V4: Best quality/speed balance (recommended)
  - V5: Latest features, may be slower
- **Generation Time**: Usually 1-2 minutes per track
- **Multiple Generations**: Generate multiple versions to compare

## Troubleshooting

### "API Key missing" error
- Run command to set API key
- Check if key is valid
- Restart VS Code after setting key

### "Suno API Error"
- Check if Suno service is running
- Verify base URL in settings
- Check API key if required

### Webview not loading
- Check browser console (Help → Toggle Developer Tools)
- Look for CSP errors or script loading issues
- Try reloading window (Ctrl+R)

### Audio not playing
- Check if audio URL is valid
- Try downloading and playing locally
- Check browser audio permissions

## Keyboard Shortcuts

```
Ctrl+Shift+P → Command Palette
Ctrl+Shift+X → Extensions
Ctrl+R → Reload Window
F5 → Start Debugging (development)
```

## Project Structure

```
magiclampmusic/
├── src/                    # Extension backend
│   ├── extension.ts        # Main extension entry
│   └── services/           # API clients
│       ├── GeminiService.ts
│       ├── SunoApiClient.ts
│       └── HeartMuLaClient.ts
├── webview/                # Frontend UI
│   └── src/
│       ├── App.tsx         # Main app component
│       ├── views/          # View components
│       ├── components/     # Reusable components
│       ├── services/       # Frontend services
│       └── types/          # TypeScript types
├── dist/                   # Compiled output
└── docs/                   # Documentation
```

## Support

For issues or questions:
1. Check documentation in `docs/` folder
2. Review error messages in VS Code Output panel
3. Check browser console for frontend errors
4. Review extension logs in Developer Tools

---

**Version**: 1.2.0 (Phase 3 - Suno Integration)
**Last Updated**: 2026-01-25
