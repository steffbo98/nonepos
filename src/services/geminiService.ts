import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function getSalesInsights(salesData: any) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this sales data for a POS system and provide 3 brief, actionable insights for the business owner. Keep it concise and use a professional, technical tone.
      Data: ${JSON.stringify(salesData)}`
    });
    return response.text || "Unable to generate insights.";
  } catch (error) {
    console.error("Gemini Insights Error:", error);
    return "Unable to generate insights at this time.";
  }
}

export async function getInventoryForecast(inventoryData: any) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on these inventory levels and categories, suggest which items should be restocked soon or have low turnover.
      Inventory: ${JSON.stringify(inventoryData)}`
    });
    return response.text || "Forecast unavailable.";
  } catch (error) {
    console.error("Gemini Inventory Error:", error);
    return "Inventory forecast currently unavailable.";
  }
}
