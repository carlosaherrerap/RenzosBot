import axios from "axios";
import { config } from "./config.js";

export async function getIntelligentResponse(userInput: string, chatHistory: { role: "user" | "assistant"; content: string }[] = []) {
    if (!config.deepseekApiKey) {
        return null;
    }

    try {
        const messages = [
            { role: "system", content: config.pasteleroContext },
            ...chatHistory,
            { role: "user", content: userInput }
        ];

        const response = await axios.post("https://api.deepseek.com/v1/chat/completions", {
            model: "deepseek-chat",
            messages,
            temperature: 0.7,
            max_tokens: 150
        }, {
            headers: {
                "Authorization": `Bearer ${config.deepseekApiKey}`,
                "Content-Type": "application/json"
            }
        });

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("LLM Error:", error);
        return null;
    }
}
