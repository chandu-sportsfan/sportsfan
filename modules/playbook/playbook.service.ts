import { Injectable, Inject } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';

@Injectable()
export class PlaybookService {
  constructor(
    @Inject('FIREBASE_ADMIN')
    private readonly db: Firestore,
  ) {}

  async getAllWeeks() {
    const snapshot = await this.db
      .collection('playbook')
      .orderBy('week')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  async getWeek(id: string) {
    const doc = await this.db
      .collection('playbook')
      .doc(id)
      .get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    };
  }

  async getDrops(id: string) {
    const week: any = await this.getWeek(id);

    return week?.drops ?? [];
  }
}