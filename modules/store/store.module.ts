import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { FirebaseProvider } from '../../firebase/firebase.provider';

@Module({
  controllers: [StoreController],
  providers: [StoreService, FirebaseProvider],
  exports: [StoreService],
})
export class StoreModule {}
