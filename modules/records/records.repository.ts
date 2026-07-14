import { Injectable, Inject } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';
import {
  RecordEntry,
  TrendEntry,
  ProgressEntry,
  MilestoneEntry,
  StoryEntry,
} from './entities/record.entity';

@Injectable()
export class RecordsRepository {
  constructor(
    @Inject('FIREBASE_ADMIN')
    private readonly db: Firestore,
  ) {}

  /**
   * Fetch National / Olympic / World records for a given event + category.
   * Firestore doc key: "100m_Men", "Javelin_Men", etc.
   */
  async getRecords(event: string, category: string): Promise<RecordEntry[]> {
    const key = `${event}_${category}`;
    const doc = await this.db.collection('records').doc(key).get();

    if (!doc.exists) return [];

    const data = doc.data() as { records: RecordEntry[] };
    return data.records ?? [];
  }

  /**
   * Fetch yearly trend data for an event.
   * Firestore doc key: "100m", "Javelin", etc.
   */
  async getTrends(event: string): Promise<TrendEntry[]> {
    const doc = await this.db.collection('recordTrends').doc(event).get();

    if (!doc.exists) return [];

    const data = doc.data() as { trends: TrendEntry[] };
    return data.trends ?? [];
  }

  /**
   * Fetch progress (gap-to-world-record) data for an event.
   */
  async getProgress(
    event: string,
  ): Promise<{ gapData: ProgressEntry[]; milestones: MilestoneEntry[] }> {
    const doc = await this.db.collection('recordProgress').doc(event).get();

    if (!doc.exists) return { gapData: [], milestones: [] };

    const data = doc.data() as {
      gapData: ProgressEntry[];
      milestones: MilestoneEntry[];
    };
    return {
      gapData: data.gapData ?? [],
      milestones: data.milestones ?? [],
    };
  }

  /**
   * Fetch all featured stories.
   */
  async getStories(): Promise<StoryEntry[]> {
    const snapshot = await this.db.collection('recordStories').get();
    return snapshot.docs.map((doc) => doc.data() as StoryEntry);
  }

  /**
   * Fetch a single story by ID.
   */
  async getStoryById(id: string): Promise<StoryEntry | null> {
    const doc = await this.db.collection('recordStories').doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as StoryEntry;
  }
}
