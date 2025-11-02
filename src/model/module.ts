import { AgentController } from './agent/agent.controller';

export class Modules {
    public static async init() {
        await AgentController.init()
    }
}