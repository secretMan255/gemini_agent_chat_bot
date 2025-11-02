import { MongoClient, Db, Collection, ServerApiVersion, ObjectId } from 'mongodb';
import dotenv from 'dotenv'
import { ChatMessage } from './model/message';
dotenv.config();

export class MongoDB {
    public static db: Db
    public static client: MongoClient
    public static uri: string
    public static dbName: string
    public static messages: Collection<ChatMessage>
    private static maxMB: number
    private static targetRatio: number

    public static async init() {
        this.uri = process.env.MONGO_URI
        this.dbName = process.env.MONGO_DB
        this.maxMB = Number(process.env.CHAT_MAX_STORAGE_MB ?? 480)
        this.targetRatio = Number(process.env.CHAT_PRUNE_TARGET_RATIO ?? 0.9)

        if (!this.uri || !this.dbName) throw new Error('Missing MONGO_UR OR MONGO_DB in .env')

        this.client = new MongoClient(this.uri, { serverApi: { version: ServerApiVersion.v1 } })
        await this.client.connect()
        this.db = this.client.db(this.dbName)

        this.messages = this.db.collection<ChatMessage>('chat_messages')

        await this.messages.createIndex({ createdAt: 1 })
    }

    public static async terminate() {
        if (this.client) {
            await this.client.close()
            console.log('MongoDB connection closed')
        }
    }

    public static async getRecentMessage(limit = 200) {
        const docs = await this.messages
            .find({}, { sort: { createdAt: 1 } })
            .limit(limit)
            .toArray()

        return docs
    }

    public static async appendMessages(docs: ChatMessage[]) {
        if (!docs.length) return
        await this.messages.insertMany(docs, { ordered: true })
    }

    /** Check the collection usage plus the number of bytes to be written; if it exceeds the limit, clean up to the target ratio. */
    public static async ensureSpaceFor(bytesNeeded: number) {
        const maxBytes: number = this.maxMB * 1024 * 1024

        const { currentBytes, avgDocBytes } = await this.getCollSizeEstimate()

        const willBe = currentBytes + bytesNeeded
        if (willBe <= maxBytes) return

        const needDelete: number = Math.max(1, Math.ceil(Math.ceil(Math.max(0, willBe - Math.floor(maxBytes * this.targetRatio)) / Math.max(avgDocBytes, 512))))
        await this.pruneOldestN(needDelete)
    }

    /** Get an estimate of the collection size: prioritize collStats, otherwise use a degenerate estimate */
    public static async getCollSizeEstimate(): Promise<{ currentBytes: number; avgDocBytes: number }> {
        try {
            const stats = await this.db.command({ collStats: 'chat_messages', scale: 1 })
            const currentBytes: number = stats.storageSize || stats.size || 0
            const avgDocBytes: number = stats.avgObjSize || 0
            return { currentBytes, avgDocBytes }
        } catch (err) {
            const count = await this.messages.estimatedDocumentCount()
            const sample = await this.messages
                .find({}, { projection: { parts: 1, role: 1, createdAt: 1 } })
                .sort({ createdAt: -1 })
                .limit(50)
                .toArray()
            const sampleAvg =
                sample.length > 0
                    ? Math.ceil(
                        sample.reduce((acc, d) => acc + Buffer.byteLength(JSON.stringify(d), 'utf8'), 0) /
                        sample.length
                    )
                    : 1024
            return { currentBytes: count * sampleAvg, avgDocBytes: sampleAvg }
        }
    }

    /** delete the oldest base on the createdAt */
    public static async pruneOldestN(n: number) {
        if (n <= 0) return
        const ids = await this.messages
            .find({}, { projection: { _id: 1 }, sort: { createdAt: 1 }, limit: n })
            .map(d => (d as { _id: ObjectId })._id)
            .toArray()
        if (!ids.length) return
        const res = await this.messages.deleteMany({ _id: { $in: ids } })
        console.log(` Pruned oldest messages: ${res.deletedCount}`)
    }

    public static async resetAllMessage() {
        await this.messages.deleteMany({})
    }
}