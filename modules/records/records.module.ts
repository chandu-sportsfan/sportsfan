import { Module } from '@nestjs/common';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';
import { RecordsRepository } from './records.repository';
import { FirebaseModule } from '../../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [RecordsController],
  providers: [RecordsService, RecordsRepository],
  exports: [RecordsService],
})
export class RecordsModule {}
