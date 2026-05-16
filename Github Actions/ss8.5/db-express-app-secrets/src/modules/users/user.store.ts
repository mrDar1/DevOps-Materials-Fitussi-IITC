import { Schema, model } from 'mongoose';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
}

export type UpdateUserInput = Partial<CreateUserInput>;

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false },
);

const UserModel = model('User', userSchema);

const toUser = (doc: InstanceType<typeof UserModel> | null): User | undefined => {
  if (!doc) return undefined;
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    createdAt: doc.createdAt,
  };
};

export const userStore = {
  async list(): Promise<User[]> {
    const docs = await UserModel.find().lean();
    return docs.map((d) => ({
      id: String(d._id),
      name: d.name,
      email: d.email,
      createdAt: d.createdAt,
    }));
  },
  async get(id: string): Promise<User | undefined> {
    try {
      return toUser(await UserModel.findById(id));
    } catch {
      return undefined; // invalid ObjectId
    }
  },
  async findByEmail(email: string): Promise<User | undefined> {
    return toUser(await UserModel.findOne({ email }));
  },
  async create({ name, email }: CreateUserInput): Promise<User> {
    const doc = await UserModel.create({ name, email });
    return toUser(doc)!;
  },
  async update(id: string, patch: UpdateUserInput): Promise<User | null> {
    try {
      const doc = await UserModel.findByIdAndUpdate(id, patch, { returnDocument: 'after' });
      return toUser(doc) ?? null;
    } catch {
      return null;
    }
  },
  async delete(id: string): Promise<boolean> {
    try {
      const res = await UserModel.findByIdAndDelete(id);
      return res !== null;
    } catch {
      return false;
    }
  },
  async _reset(): Promise<void> {
    await UserModel.deleteMany({});
  },
};
