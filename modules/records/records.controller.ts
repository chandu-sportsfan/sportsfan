import { Controller, Get, Query } from '@nestjs/common';
import { RecordsService } from './records.service';

@Controller('records')
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  // GET /records?event=100m&category=Men
  @Get()
  getRecords(
    @Query('event') event: string,
    @Query('category') category: string,
  ) {
    return this.recordsService.getRecords(event, category);
  }

  // GET /records/insight?event=100m&category=Men
  @Get('insight')
  getInsight(
    @Query('event') event: string,
    @Query('category') category: string,
  ) {
    return this.recordsService.getInsight(event, category);
  }

  // GET /records/trends?event=100m
  @Get('trends')
  getTrends(@Query('event') event: string) {
    return this.recordsService.getTrends(event);
  }

  // GET /records/progress?event=100m
  @Get('progress')
  getProgress(@Query('event') event: string) {
    return this.recordsService.getProgress(event);
  }

  // GET /records/stories
  @Get('stories')
  getStories() {
    return this.recordsService.getStories();
  }
}
