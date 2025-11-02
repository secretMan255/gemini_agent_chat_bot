import { ApiExpress } from './express/express';
import { GoogleGenAi } from './googleGenAi/google.gen.ai';
import { Modules } from './model/module'

export class Service {
    public static async init() {
        await GoogleGenAi.init()

        await ApiExpress.init()
        await Modules.init()
        ApiExpress.applyErrorHandler()
    }

    public static async TerminateService() {
        await ApiExpress.terminate()
        console.log('Service terminate ...')
    }
}