import type { ObjectSchema } from 'joi'

export async function JoiValidator<T>(data: unknown, handler: (value: T) => Promise<any>, schema: ObjectSchema<T>) {
    const value = await schema.validateAsync(data, {
        abortEarly: false,
        allowUnknown: false,
        convert: true,
        stripUnknown: true,
    })
    return handler(value)
}