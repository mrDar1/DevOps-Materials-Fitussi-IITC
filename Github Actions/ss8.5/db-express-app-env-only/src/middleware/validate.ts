import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodType } from 'zod';

type Source = 'body' | 'params' | 'query';

export const validate = (schema: ZodType, source: Source = 'body'): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) return next(parsed.error);
    // Express 5: req.query is a read-only getter. Mutate in place instead of reassigning.
    if (source === 'query') {
      Object.assign(req.query as Record<string, unknown>, parsed.data);
    } else {
      (req as Request & Record<Source, unknown>)[source] = parsed.data;
    }
    next();
  };
