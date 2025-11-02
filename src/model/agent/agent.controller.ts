import { ApiExpress, Auth, Res } from '../../express/express'
import { JoiValidator } from '../../joiValidator/joiValidator'
import { Request, Response } from 'express'
import { AgentService } from './agent.service'
import { GeneralAgentRequest } from './agent.joi'

export class AgentController {
    public static async init() {
        const endpoint: string = '/agent/'

        ApiExpress.post(endpoint + 'general', this.generalAgent, [], Auth.None)
    }

    public static async generalAgent(req: Request, res: Response) {
        return JoiValidator(req.body, (data) => AgentService.GeneralAgent(data), GeneralAgentRequest)
    }
}