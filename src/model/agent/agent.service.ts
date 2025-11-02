import { GoogleGenAi } from '../../googleGenAi/google.gen.ai'
import { ChatMessage, MessagePart } from '../../mongodb/model/message'
import { MongoDB } from '../../mongodb/mongodb'

type GeneralAgentDTO = {
    prompt: string
}

export class AgentService {

    public static async GeneralAgent(dto: GeneralAgentDTO) {
        // get chat message history
        const historyDocs = await MongoDB.getRecentMessage(200)
        const history = historyDocs.map(m => ({ role: m.role, parts: m.parts }))

        // user current input
        const userPrompt = { role: 'user', parts: [{ text: dto.prompt }] as MessagePart[] }
        const contents = [...history, userPrompt]

        // call gemini model
        const response = await GoogleGenAi.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            config: {
                // google search
                tools: [{ googleSearch: {} }],
                // thinking mode
                thinkingConfig: { includeThoughts: true },
            }
        })

        // check gemini response
        if (!response.candidates || response.candidates.length === 0) return { ret: -1, msg: 'Model response candidates are empty.' }

        let thoughts: string = ''
        let answer: string = ''

        const modelResponse = response.candidates[0].content

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


        // save chat history
        const now = new Date()
        const docs: ChatMessage[] = [
            { role: 'user', parts: userPrompt.parts, createdAt: now },
            { role: 'model', parts: (modelResponse.parts as any) || [], createdAt: now }
        ]
        await MongoDB.appendMessages(docs)

        return { thoughts, answer }
    }
}