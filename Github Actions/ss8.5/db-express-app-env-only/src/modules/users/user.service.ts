import { userStore, type User, type CreateUserInput, type UpdateUserInput } from './user.store.js';
import { HttpError } from '../../errors/HttpError.js';

export const userService = {
  list(): Promise<User[]> {
    return userStore.list();
  },
  async get(id: string): Promise<User> {
    const user = await userStore.get(id);
    if (!user) throw HttpError.notFound(`User ${id} not found`);
    return user;
  },
  async create(data: CreateUserInput): Promise<User> {
    if (await userStore.findByEmail(data.email)) {
      throw HttpError.conflict(`Email ${data.email} already in use`);
    }
    return userStore.create(data);
  },
  async update(id: string, patch: UpdateUserInput): Promise<User | null> {
    await this.get(id);
    if (patch.email) {
      const existing = await userStore.findByEmail(patch.email);
      if (existing && existing.id !== id) throw HttpError.conflict('Email already in use');
    }
    return userStore.update(id, patch);
  },
  async remove(id: string): Promise<void> {
    await this.get(id);
    await userStore.delete(id);
  },
};
