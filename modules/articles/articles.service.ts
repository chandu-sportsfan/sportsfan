import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';

@Injectable()
export class ArticlesService {
  constructor(
    @Inject('FIREBASE_ADMIN')
    private readonly db: Firestore,
  ) {}

  /** Return all articles — lightweight list (no keyPoints / closingParagraphs) */
  async getAllArticles() {
    const snapshot = await this.db.collection('articles').get();

    return snapshot.docs.map((doc) => ({
      slug: doc.id,
      heroImage: doc.data().heroImage,
      title: doc.data().title,
      author: doc.data().author,
      readTime: doc.data().readTime,
      date: doc.data().date,
      likeCount: doc.data().likeCount,
      commentCount: doc.data().commentCount,
    }));
  }

  /** Return a single full article by slug */
  async getArticleBySlug(slug: string) {
    const doc = await this.db.collection('articles').doc(slug).get();

    if (!doc.exists) {
      throw new NotFoundException(`Article "${slug}" not found`);
    }

    return {
      slug: doc.id,
      ...doc.data(),
    };
  }
}
