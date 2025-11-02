import { config } from 'dotenv';
import { GoogleGenAi } from '../../googleGenAi/google.gen.ai'

type GeneralAgentDTO = {
    prompt: string
}

export class AgentService {
    public static async GeneralAgent(dto: GeneralAgentDTO) {
        let thoughts: string
        let answer: any

        const response = await GoogleGenAi.ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: dto.prompt,
            config: {
                thinkingConfig: {
                    includeThoughts: true,
                },
            },
        });

        for await (const chunk of response) {
            for (const part of chunk.candidates[0].content.parts) {
                if (!part.text) {
                    continue;
                } else if (part.thought) {
                    if (!thoughts) {
                        console.log("Thoughts summary:");
                    }
                    console.log(part.text);
                    thoughts = thoughts + part.text;
                } else {
                    if (!answer) {
                        console.log("Answer:");
                    }
                    console.log(part.text);
                    answer = answer + part.text;
                }
            }
        }

        return { thoughts, answer }
    }
}