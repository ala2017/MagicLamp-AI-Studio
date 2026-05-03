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
