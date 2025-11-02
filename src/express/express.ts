import express, { Express, Request, Response, NextFunction, RequestHandler } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import jwt, { JwtPayload, Secret, SignOptions } from 'jsonwebtoken'
import { inspect } from 'util'
import { Server } from 'http'

/** ===== Enums ===== */
export enum Auth {
    Bearer = 'Bearer',
    Cookie = 'Cookie',
    None = 'None',
}

export enum ResultType {
    NORMAL = 'NORMAL',
    IMAGE = 'IMAGE',
}

export enum Res {
    SUCCESS = 0,
    FAIL = -1,
}

export enum ROLE {
    ADMIN = 'ADMIN',
    OPS_MGR = 'OPS_MGR',
    STAFF = 'STAFF',
    CUSTOMER = 'CUSTOMER',
}

/** ===== Types ===== */
type Handler = (req: Request, res: Response) => Promise<any> | any
type HttpMethod = 'get' | 'post' | 'put' | 'delete'

/** ===== ApiExpress ===== */
export class ApiExpress {
    public static tokenMode: string
    public static secure: boolean
    public static jwtExpires: SignOptions['expiresIn'] = '1d'
    private static app: Express | null = null
    private static server: Server | null = null
    public static secretKey: Secret
    private static errorApplied = false

    /** Initialize express app, middlewares, and start server */
    public static async init() {
        dotenv.config();

        if (!this.app) {
            const allowed: string = process.env.ALLOWED_ORIGINS || 'http://localhost:5173';
            const credentials: boolean = process.env.CORS_CREDENTIALS === 'true'
            const jwtExpires: number | any = process.env.JWT_EXPIRES;
            const key: string = process.env.JWT_SECRET || '';
            if (!key) throw new Error('Missing JWT_SECRET in environment');
            this.secretKey = key;
            this.jwtExpires = jwtExpires
            // cookie
            this.tokenMode = process.env.TOKEN_MODE || 'cookie'
            this.secure = Boolean(process.env.SECURE) || true

            this.app = express();

            const whitelist = allowed
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            // set cors origin
            const corsDelegate: cors.CorsOptionsDelegate<Request> = (req, cb) => {
                const reqOrigin = req.header('Origin');
                const allow = !reqOrigin || whitelist.includes(reqOrigin);
                cb(null, {
                    origin: allow ? reqOrigin : false,
                    credentials,
                    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-XSRF-TOKEN'],
                    optionsSuccessStatus: 204,
                });
            };

            // allow all origin
            this.app.use(cors({
                origin: '*',
                credentials: false,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
                optionsSuccessStatus: 204,
            }))

            // ** express middleware **
            // this.app.use(cors(corsDelegate))
            this.app.use(cors({ origin: '*', credentials: false }))

            this.app.use(express.json());
            this.app.use(cookieParser());
            const port = Number(process.env.PORT) || 8080;
            const host = process.env.HOST || '0.0.0.0';


            this.server = this.app.listen(port, host, () => {   // ✅ 保存 server
                console.log(`HTTP running at http://${host}:${port}`)
            })
        }
    }

    public static getApp() { return this.server }
    public static getServer() { return this.server }

    /** Optional global error handler (attach once) */
    public static applyErrorHandler() {
        if (this.errorApplied) return
        this.app.use(this.errorHandler)
        this.errorApplied = true
    }

    /** JWT issue helper */
    public static generateToken(payload: object, expiresIn?: string): string {
        if (!this.secretKey) throw new Error('Secret key is not defined')
        const finalExpiresIn: string | number =
            expiresIn || this.jwtExpires || '1h'
        return jwt.sign(payload, this.secretKey, {
            expiresIn: finalExpiresIn,
        } as SignOptions)
    }

    /** sign tojen */
    public static signToken(user: { id: number; role?: string; name?: string; email?: string; roles?: string[]; perms?: string[] }) {
        return jwt.sign(
            { id: user.id, role: user.role, name: user.name, email: user.email, roles: user.roles, perms: user.perms },
            this.secretKey,
            { expiresIn: this.jwtExpires }
        )
    }

    /** Public route helpers (now accept auth + roles) */
    public static get(
        path: string,
        handler: Handler,
        mws: RequestHandler[] = [],
        authType: Auth = Auth.None,
        allowedRoles: string[] = [],
    ) {
        this.register('get', path, handler, mws, authType, allowedRoles)
    }

    public static post(
        path: string,
        handler: Handler,
        mws: RequestHandler[] = [],
        authType: Auth = Auth.None,
        allowedRoles: string[] = [],
    ) {
        this.register('post', path, handler, mws, authType, allowedRoles)
    }

    public static put(
        path: string,
        handler: Handler,
        mws: RequestHandler[] = [],
        authType: Auth = Auth.None,
        allowedRoles: string[] = [],
    ) {
        this.register('put', path, handler, mws, authType, allowedRoles)
    }

    public static delete(
        path: string,
        handler: Handler,
        mws: RequestHandler[] = [],
        authType: Auth = Auth.None,
        allowedRoles: string[] = [],
    ) {
        this.register('delete', path, handler, mws, authType, allowedRoles)
    }

    /** ===== Internals ===== */

    private static register(
        method: HttpMethod,
        endPoint: string,
        handler: Handler,
        mws: RequestHandler[] = [],
        authType: Auth = Auth.None,
        allowedRoles: string[] = [],
    ) {
        if (!this.app) throw new Error('API service is not initialized...')
        const chain: RequestHandler[] = [
            this.getAuthMiddleware(authType),
            this.roleAuthentication(allowedRoles),
            ...mws,
            this.wrap(handler),
        ]
            ; (this.app as any)[method](endPoint, ...chain)
    }

    /** Unified response + error formatting (Joi → 400) */
    private static wrap(handler: Handler): RequestHandler {
        return async (req, res): Promise<void> => {
            try {
                this.logRequest(req)
                const result = await handler(req, res)
                if (res.headersSent) return

                if (result?.type === ResultType.IMAGE && result?.image) {
                    res.type('image/jpeg').sendFile(result.image, (err) => {
                        if (err) {
                            console.log(`Error sending file: ${err}`)
                            res.status(500).json({ ret: Res.FAIL, msg: 'Error sending file' })
                        }
                    })
                } else {
                    res.status(200).json({ ret: Res.SUCCESS, data: result })
                }
            } catch (err: any) {
                if (err?.isJoi && Array.isArray(err.details)) {
                    const msg = err.details.map((d: any) => d.message).join('; ')
                    res.status(400).json({ ret: Res.FAIL, msg })
                }
                console.log(`API error: ${err?.stack || err}`)
                res
                    .status(500)
                    .json({ ret: Res.FAIL, msg: err?.message || 'Internal Server Error' })
            }
        }
    }

    private static logRequest(req: Request) {
        console.log(
            `Request: { Headers: ${inspect(req.headers, {
                depth: null,
            })} | Query: ${inspect(req.query, {
                depth: null,
            })} | Body: ${inspect(req.body, {
                depth: null,
            })} | Params: ${inspect(req.params, { depth: null })} }`,
        )
    }

    /** Role guard */
    private static roleAuthentication(allowedRoles: string[]): RequestHandler {
        return (req, res, next): void => {
            if (!allowedRoles || allowedRoles.length === 0) return next()

            const authUser = (req as any)['authUser']
            if (!authUser || !authUser.role) {
                res.status(403).json({ ret: Res.FAIL, msg: 'Access Denied: No role' })
                return
            }
            if (!allowedRoles.includes(authUser.role)) {
                res
                    .status(403)
                    .json({ ret: Res.FAIL, msg: 'Access Denied: Insufficient permissions' })
                return
            }
            next()
        }
    }

    /** Pick auth middleware */
    private static getAuthMiddleware(authType: Auth): RequestHandler {
        switch (authType) {
            case Auth.Bearer:
                return (req, res, next) => this.authenticationToken(req, res, next)
            case Auth.Cookie:
                return (req, res, next) => this.cookieAuthentication(req, res, next)
            case Auth.None:
            default:
                return (_req, _res, next) => next()
        }
    }

    /** Bearer token auth */
    private static async authenticationToken(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        const authHeader: string | undefined = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ ret: Res.FAIL, msg: 'Bearer token required' })
            return
        }

        const token: string = authHeader.split(' ')[1]

        jwt.verify(token, this.secretKey, (err, decoded) => {
            if (err) return res.status(401).json({ ret: Res.FAIL, msg: 'Invalid token' })
            const payload = decoded as JwtPayload
            if (!payload.perms)
                return res.status(401).json({ ret: Res.FAIL, msg: 'perms is required' })
            if (!payload.roles)
                return res.status(401).json({ ret: Res.FAIL, msg: 'role is required' })
            if (!payload.id)
                return res.status(401).json({ ret: Res.FAIL, msg: 'id is required' })
            if (!payload.email)
                return res.status(401).json({ ret: Res.FAIL, msg: 'email is required' })
            if (!payload.name)
                return res.status(401).json({ ret: Res.FAIL, msg: 'name is required' })
                    ; (req as any)['authUser'] = payload
            next()
        })
    }

    /** Cookie auth */
    private static async cookieAuthentication(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        const token: string | undefined = (req as any).cookies?.authToken
        if (!token) {
            res.status(401).json({ ret: Res.FAIL, msg: 'Cookie token required' })
            return
        }

        jwt.verify(token, this.secretKey, (err, decoded) => {
            if (err) return res.status(401).json({ ret: Res.FAIL, msg: 'Invalid token' })
            const payload = decoded as JwtPayload
            if (!payload.perms)
                return res.status(401).json({ ret: Res.FAIL, msg: 'perms is required' })
            if (!payload.roles)
                return res.status(401).json({ ret: Res.FAIL, msg: 'role is required' })
            if (!payload.id)
                return res.status(401).json({ ret: Res.FAIL, msg: 'id is required' })
            if (!payload.email)
                return res.status(401).json({ ret: Res.FAIL, msg: 'email is required' })
            if (!payload.name)
                return res.status(401).json({ ret: Res.FAIL, msg: 'name is required' })
                    ; (req as any)['authUser'] = payload
            next()
        })
    }

    public static valifyJWTTOKEN(token: string) {
        if (!token) throw new Error('Missing token')
        if (!this.secretKey) throw new Error('Secret key is not defined')

        const decoded = jwt.verify(token, this.secretKey) as jwt.JwtPayload | string

        if (typeof decoded === 'string') {
            throw new Error('Invalid token payload')
        }

        return {
            id: Number((decoded as any).id),
            name: (decoded as any).name as string | undefined,
            email: (decoded as any).email as string | undefined,
            roles: (decoded as any).roles as string[] | undefined,
            perms: (decoded as any).perms as string[] | undefined,
            ...decoded,
        }
    }

    public static permAny(perms: string[]): RequestHandler {
        return (req: Request, res: Response, next: NextFunction): void => {
            const au: any = (req as any).authUser;
            const userPerms: string[] = au?.perms ?? au?.permsFlat ?? [];
            const ok = Array.isArray(userPerms) && perms.some(p => userPerms.includes(p));
            if (!ok) {
                res.status(403).json({ ret: Res.FAIL, msg: 'Forbidden: permission(any)' });
                return;
            }
            next();
        };
    }

    public static permAll(perms: string[]): RequestHandler {
        return (req: Request, res: Response, next: NextFunction): void => {
            const au: any = (req as any).authUser;
            const userPerms: string[] = au?.perms ?? au?.permsFlat ?? [];
            const ok = Array.isArray(userPerms) && perms.every(p => userPerms.includes(p));
            if (!ok) {
                res.status(403).json({ ret: Res.FAIL, msg: 'Forbidden: permission(all)' });
                return;
            }
            next();
        };
    }

    public static roleAny(roles: string[]): RequestHandler {
        return (req: Request, res: Response, next: NextFunction): void => {
            const au: any = (req as any).authUser;
            const userRoles: string[] = Array.isArray(au?.roles) ? au.roles : (au?.role ? [au.role] : []);
            const ok = userRoles.length > 0 && roles.some(r => userRoles.includes(r));
            if (!ok) {
                res.status(403).json({ ret: Res.FAIL, msg: 'Forbidden: role' });
                return;
            }
            next();
        };
    }

    /** Fallback error handler (attach via applyErrorHandler) */
    private static errorHandler(
        err: any,
        _req: Request,
        res: Response,
        _next: NextFunction,
    ): void {
        console.log(`Unhandled error: ${err?.stack || err}`)
        res
            .status(500)
            .json({ ret: Res.FAIL, msg: `Internal server error, ${err?.message || 'Unknown'}` })
    }

    /** Graceful shutdown */
    public static async terminate() {
        if (this.server) {
            this.server.close(() => console.log('API server have been shutdown ...'))
        } else {
            console.log('API server is not running or already terminated ...')
        }
    }
}