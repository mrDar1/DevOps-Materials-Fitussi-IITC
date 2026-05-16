import type { Request, Response } from 'express';
import { userService } from './user.service.js';

export const userController = {
  list: async (_req: Request, res: Response) => res.json(await userService.list()),
  get: async (req: Request, res: Response) => res.json(await userService.get(String(req.params.id))),
  create: async (req: Request, res: Response) =>
    res.status(201).json(await userService.create(req.body)),
  update: async (req: Request, res: Response) =>
    res.json(await userService.update(String(req.params.id), req.body)),
  remove: async (req: Request, res: Response) => {
    await userService.remove(String(req.params.id));
    res.status(204).end();
  },
};
