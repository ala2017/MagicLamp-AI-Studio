const { GoogleGenAI } = require("@google/genai");

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: "AIzaSyBqk-sTmdkNatClUA_xpZ6zxlwvuPXR7J4" });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Hello",
    });
    console.log("Text generation works.");
    
    const imgResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: {
        parts: [{ text: "A cat" }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        },
      },
    });
    console.log("Image generation works.");
  } catch (e) {
    console.error(e.message || e);
  }
}

test();
