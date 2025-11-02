import { GoogleGenAi } from '../../googleGenAi/google.gen.ai'

type GeneralAgentDTO = {
    prompt: string
}

export class AgentService {
    private static conversationHistory: any[] = []

    public static async GeneralAgent(dto: GeneralAgentDTO) {
        let thoughts: string = ''
        let answer: string = ''

        const newContent = { role: 'user', parts: [{ text: dto.prompt }] }
        this.conversationHistory.push(newContent)

        const response = await GoogleGenAi.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: this.conversationHistory,
            config: {
                // google search
                tools: [{ googleSearch: {} }],
                // thinking mode
                thinkingConfig: { includeThoughts: true },
            }
        })

        if (!response.candidates || response.candidates.length === 0) {
            throw new Error("Model response candidates are empty.");
        }

        let modelResponse = response.candidates[0].content

        this.conversationHistory.push(modelResponse)

        for (const part of modelResponse.parts) {
            if (!part.text) {
                continue
            }
            else if (part.thought) {
                thoughts = thoughts + part.text
            } else {
                answer = answer + part.text
            }
        }

        return { thoughts, answer }
    }
}