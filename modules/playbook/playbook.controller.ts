import { Controller, Get, Param } from '@nestjs/common';
import { PlaybookService } from './playbook.service';

@Controller('playbook')
export class PlaybookController {
  constructor(
    private readonly playbookService: PlaybookService,
  ) {}

  @Get()
  getAllWeeks() {
    return this.playbookService.getAllWeeks();
  }

  @Get(':id')
  getWeek(@Param('id') id: string) {
    return this.playbookService.getWeek(id);
  }

  @Get(':id/drops')
  getDrops(@Param('id') id: string) {
    return this.playbookService.getDrops(id);
  }
}