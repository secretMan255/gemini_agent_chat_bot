export type MessagePart = { text?: string; thought?: boolean;[k: string]: any }
export type ChatMessage = {
    role: string
    parts: MessagePart[]
    hasThoughts?: boolean
    thoughts?: string
    model?: string
    createdAt: Date
    archived?: boolean
}