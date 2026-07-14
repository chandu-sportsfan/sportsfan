import { Module } from '@nestjs/common';
import { AthleteProfileController } from './athlete-profile.controller';
import { AthleteProfileService } from './athlete-profile.service';
import { FirebaseModule } from '../../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [AthleteProfileController],
  providers: [AthleteProfileService],
})
export class AthleteProfileModule {}