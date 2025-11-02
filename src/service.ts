import { Service } from './app.service'

class App {
    public static async init() {
        try {
            await Service.init()

            process.on('SIGINT', async () => {
                await Service.TerminateService()
            })

        } catch (err) {
            console.log(`Init service failed: ${err}`)
            process.exit(1)
        }
    }
}

App.init()