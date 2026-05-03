/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#09090b", // Zinc 950
                surface: "#18181b",    // Zinc 900
                surfaceHighlight: "#27272a", // Zinc 800
                primary: "#8b5cf6",    // Violet 500
                primaryHover: "#7c3aed", // Violet 600
                secondary: "#10b981",  // Emerald 500
                accent: "#f43f5e",     // Rose 500
                textMain: "#f4f4f5",   // Zinc 100
                textMuted: "#a1a1aa",  // Zinc 400
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-in': 'slideIn 0.3s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateX(-20px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                }
            }
        },
    },
    plugins: [],
}
