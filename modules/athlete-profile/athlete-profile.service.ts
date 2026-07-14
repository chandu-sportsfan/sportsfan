import { Injectable, Inject } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';

@Injectable()
export class AthleteProfileService {
  constructor(
    @Inject('FIREBASE_ADMIN')
    private readonly db: Firestore,
  ) {}

  async getAllAthletes() {
    const snapshot = await this.db
      .collection('athletesProfile')
      .get();

    return snapshot.docs.map((doc) => ({
      slug: doc.id,
      ...doc.data(),
    }));
  }

  async getAthleteBySlug(slug: string) {
    const doc = await this.db
      .collection('athletesProfile')
      .doc(slug)
      .get();

    if (!doc.exists) {
      return null;
    }

    return {
      slug: doc.id,
      ...doc.data(),
    };
  }

  async getPosts(slug: string) {
    const athlete: any = await this.getAthleteBySlug(slug);
    return athlete?.postsContent ?? [];
  }

  async getVideos(slug: string) {
    const athlete: any = await this.getAthleteBySlug(slug);
    return athlete?.videosContent ?? [];
  }

  async getDrops(slug: string) {
    const athlete: any = await this.getAthleteBySlug(slug);
    return athlete?.dropsContent ?? [];
  }

  async getHighlights(slug: string) {
    const athlete: any = await this.getAthleteBySlug(slug);
    return athlete?.highlights ?? [];
  }
}