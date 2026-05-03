# VS Code API Fix - "vscode is not defined" Error

## Problem
When clicking "生成音乐" button in Audio Generator view, the error "⚠️ vscode is not defined" appeared.

## Root Cause
The webview was not acquiring the VS Code API before trying to use it. The `vscode` object needs to be obtained via `window.acquireVsCodeApi()` and made available globally.

## Solution Applied

### File: `webview/src/main.tsx`

**Before:**
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
```

**After:**
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Acquire VS Code API
declare global {
    interface Window {
        acquireVsCodeApi?: () => any;
    }
}

// Make vscode API available globally
if (typeof window.acquireVsCodeApi !== 'undefined') {
    (window as any).vscode = window.acquireVsCodeApi();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
```

## What This Does

1. **Declares the global Window interface** to include `acquireVsCodeApi` method
2. **Acquires the VS Code API** when the webview loads
3. **Makes it globally available** as `window.vscode` so all components can access it
4. **Checks for existence** to avoid errors in non-VS Code environments

## Rebuild Status

✅ Webview rebuilt successfully: **214.03 kB** (gzipped: 64.96 kB)

## Testing Steps

1. **Reload the extension**:
   - If using F5 debug mode: Stop and restart (F5)
   - If installed: Reload VS Code window (Ctrl+R)

2. **Open Magic Lamp sidebar**

3. **Navigate to Audio Generator view**

4. **Click "🎵 生成音乐" button**

5. **Expected behavior**:
   - No "vscode is not defined" error
   - Loading state appears
   - Message is sent to extension
   - Extension processes the request
   - Response appears in generation history

## How VS Code API Works in Webviews

### Communication Flow

```
Webview (React)
  ↓
window.vscode.postMessage({ type: 'generateAudio', payload: {...} })
  ↓
VS Code Extension Host
  ↓
webview.onDidReceiveMessage((message) => { ... })
  ↓
Process request (call Suno API)
  ↓
webview.postMessage({ command: 'audioGenerated', data: [...] })
  ↓
Webview (React)
  ↓
window.addEventListener('message', (event) => { ... })
```

### Key Points

1. **One-time acquisition**: `acquireVsCodeApi()` can only be called once per webview session
2. **Global availability**: Store it in `window.vscode` for all components to use
3. **Type safety**: Use `declare const vscode: any;` in components that use it
4. **Message format**: Extension expects `{ type: string, payload?: any }`
5. **Response format**: Extension sends `{ command: string, data?: any }`

## Other Views

Other views (LyricsView, StyleView, etc.) don't use `vscode.postMessage` because they:
- Call NVIDIA API directly via fetch
- Don't need extension backend processing
- Use the aiService.ts for API calls

Only AudioGeneratorView needs vscode API because:
- Suno API calls go through the extension
- Extension manages API keys and configuration
- Extension handles response transformation

## Debugging Tips

If you still see "vscode is not defined":

1. **Check browser console**:
   - Open Developer Tools (Help → Toggle Developer Tools)
   - Look for errors in Console tab
   - Check if `window.vscode` exists: type `window.vscode` in console

2. **Verify webview loaded**:
   - Check if webview HTML is loaded
   - Look for script loading errors
   - Verify CSP (Content Security Policy) allows scripts

3. **Check extension logs**:
   - Open Output panel (View → Output)
   - Select "Extension Host" from dropdown
   - Look for errors or warnings

4. **Reload everything**:
   - Close VS Code completely
   - Reopen and try again
   - Sometimes cached webview needs full restart

## Related Files

- `webview/src/main.tsx` - VS Code API initialization (FIXED)
- `webview/src/views/AudioGeneratorView.tsx` - Uses vscode.postMessage
- `src/extension.ts` - Handles messages from webview
- `dist/webview/assets/index.js` - Compiled webview bundle

---

**Fix Applied**: 2026-01-25
**Status**: ✅ Ready for testing
