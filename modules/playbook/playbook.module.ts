import { Module } from '@nestjs/common';
import { FirebaseModule } from '../../firebase/firebase.module';
import { PlaybookController } from './playbook.controller';
import { PlaybookService } from './playbook.service';

@Module({
  imports: [FirebaseModule],
  controllers: [PlaybookController],
  providers: [PlaybookService],
})
export class PlaybookModule {}