import Joi from 'joi';

export const GeneralAgentRequest = Joi.object({
    prompt: Joi.string().max(255).required()
}).required()