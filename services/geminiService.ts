
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getSmartETA = async (currentLocation: { lat: number, lng: number }, destination: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Calculate a mock ETA in minutes for a college bus at coordinates (${currentLocation.lat}, ${currentLocation.lng}) heading to ${destination}. Consider random traffic factors. Return ONLY the number of minutes as a JSON integer.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            etaMinutes: { type: Type.INTEGER }
          }
        }
      }
    });
    const data = JSON.parse(response.text);
    return data.etaMinutes || 15;
  } catch (error) {
    console.error("AI Error:", error);
    return 15;
  }
};

export const getRouteAssistant = async (busNumber: string, status: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The student is tracking Bus ${busNumber} which is currently ${status}. Give a friendly, helpful 1-sentence update about this bus journey.`,
    });
    return response.text;
  } catch (error) {
    return "Bus is on route. Expect regular timings.";
  }
};

export const getChatResponse = async (history: ChatMessage[], busInfo: string) => {
  try {
    const lastUserMessage = history[history.length - 1].text;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: lastUserMessage,
      config: {
        systemInstruction: `You are the CampusWay Support Assistant. You are helping a student tracking their bus. Context: ${busInfo}. Be helpful, concise, and professional. If they ask where the bus is, refer to the live map data.`,
      }
    });
    return response.text || "I'm sorry, I couldn't process that request. How else can I help you today?";
  } catch (error) {
    console.error("Chat AI Error:", error);
    return "Support is currently busy. Please try again later or check the live map.";
  }
};

export const getTrafficAnalysis = async (location: { lat: number, lng: number }) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Current bus coordinates: (${location.lat}, ${location.lng}). 
      Analyze mock traffic conditions. If traffic is "heavy", suggest an alternative route id (1 or 2) and how many minutes it saves.
      Return JSON: { "trafficLevel": "light" | "heavy", "fasterRouteAvailable": boolean, "routeId": number, "timeSaved": number }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            trafficLevel: { type: Type.STRING },
            fasterRouteAvailable: { type: Type.BOOLEAN },
            routeId: { type: Type.NUMBER },
            timeSaved: { type: Type.NUMBER }
          }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return { trafficLevel: "light", fasterRouteAvailable: false };
  }
};
