import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HabitGroup, HabitGroupDocument } from './schemas/habit-group.schema';
import { RagChunk, RagChunkDocument, RagCategory } from './schemas/rag-chunk.schema';

@Injectable()
export class HabitsService {
  constructor(
    @InjectModel(HabitGroup.name)
    private readonly groupModel: Model<HabitGroupDocument>,
    @InjectModel(RagChunk.name)
    private readonly ragModel: Model<RagChunkDocument>,
  ) {}

  findGroupByKey(key: string) {
    return this.groupModel.findOne({ key: key.toLowerCase().trim() }).exec();
  }

  findGroupById(id: string) {
    return this.groupModel.findById(id).exec();
  }

  createGroup(data: {
    key: string;
    name: string;
    description: string;
    scopePrompt: string;
  }) {
    return this.groupModel.create({
      ...data,
      key: data.key.toLowerCase().trim(),
      memberCount: 0,
    });
  }

  async incrementMembers(groupId: string) {
    return this.groupModel
      .findByIdAndUpdate(groupId, { $inc: { memberCount: 1 } }, { new: true })
      .exec();
  }

  countRagByGroupKey(groupKey: string) {
    return this.ragModel.countDocuments({ groupKey: groupKey.toLowerCase() }).exec();
  }

  async addRagChunks(
    groupId: string,
    groupKey: string,
    chunks: Array<{ title: string; content: string; category: RagCategory }>,
  ) {
    if (!chunks.length) return [];
    const docs = chunks.map((c) => ({
      groupId,
      groupKey: groupKey.toLowerCase(),
      title: c.title,
      content: c.content,
      category: c.category,
    }));
    return this.ragModel.insertMany(docs);
  }

  getRagByGroupKey(groupKey: string, limit = 20) {
    return this.ragModel
      .find({ groupKey: groupKey.toLowerCase() })
      .limit(limit)
      .lean()
      .exec();
  }
}
