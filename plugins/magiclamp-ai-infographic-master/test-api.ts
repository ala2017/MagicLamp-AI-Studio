import { GoogleGenAI } from "@google/genai";

async function testApiKey() {
  try {
    console.log("Testing text generation...");
    // We test with the key the user provided in the chat. 
    // They said they put it in the system settings, but we can verify the actual key's capability here.
    const apiKey = "AIzaSyBqk-sTmdkNatClUA_xpZ6zxlwvuPXR7J4"; 
    const ai = new GoogleGenAI({ apiKey });

    const textResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Say hello",
    });
    console.log("Text Generation OK.");

    console.log("Testing image generation with gemini-3.1-flash-image-preview...");
    const imageResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: "A simple red cube on a white background",
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    console.log("Image Generation OK. Response received.");
  } catch (error: any) {
    console.error("API TEST FAILED:");
    console.error(error.message || error);
  }
}

testApiKey();
