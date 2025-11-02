import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv'
dotenv.config();

export class GoogleGenAi {
    public static ai

    public static async init() {
        try {
            const apiKey = process.env.GEMINI_API_KEY
            if (!apiKey) throw new Error('Missing GEMINI_API_KEY in .env')

            this.ai = new GoogleGenAI({ apiKey: apiKey });
        } catch (err) {
            throw new Error(`Failed to init GoogleGenAI: ${err}`)
        }
    }
}