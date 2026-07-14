import { Controller, Get, Param } from '@nestjs/common';
import { ArticlesService } from './articles.service';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  /** GET /articles — list all articles (lightweight) */
  @Get()
  getAllArticles() {
    return this.articlesService.getAllArticles();
  }

  /** GET /articles/:slug — full article by slug */
  @Get(':slug')
  getArticle(@Param('slug') slug: string) {
    return this.articlesService.getArticleBySlug(slug);
  }
}
