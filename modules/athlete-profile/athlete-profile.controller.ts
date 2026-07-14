import { Controller, Get, Param } from '@nestjs/common';
import { AthleteProfileService } from './athlete-profile.service';

@Controller('athletes')
export class AthleteProfileController {
  constructor(
    private readonly athleteService: AthleteProfileService,
  ) {}

  @Get()
  getAllAthletes() {
    return this.athleteService.getAllAthletes();
  }

  @Get(':slug')
  getAthlete(@Param('slug') slug: string) {
    return this.athleteService.getAthleteBySlug(slug);
  }

  @Get(':slug/posts')
  getPosts(@Param('slug') slug: string) {
    return this.athleteService.getPosts(slug);
  }

  @Get(':slug/videos')
  getVideos(@Param('slug') slug: string) {
    return this.athleteService.getVideos(slug);
  }

  @Get(':slug/drops')
  getDrops(@Param('slug') slug: string) {
    return this.athleteService.getDrops(slug);
  }

  @Get(':slug/highlights')
  getHighlights(@Param('slug') slug: string) {
    return this.athleteService.getHighlights(slug);
  }
}