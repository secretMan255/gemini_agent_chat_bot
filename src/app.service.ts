import { ApiExpress } from './express/express';
import { GoogleGenAi } from './googleGenAi/google.gen.ai';
import { Modules } from './model/module'
import { MongoDB } from '../src/mongodb/mongodb'

export class Service {
    public static async init() {

        await MongoDB.init()
        await GoogleGenAi.init()
        await ApiExpress.init()
        await Modules.init()

        ApiExpress.applyErrorHandler()
    }

    public static async TerminateService() {
        await MongoDB.terminate()
        await ApiExpress.terminate()
        console.log('Service terminate ...')
    }
}