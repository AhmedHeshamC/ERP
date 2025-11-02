import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CommonModule } from '../../shared/common/common.module';
import { SecurityModule } from '../../shared/security/security.module';
import { CacheModule } from '../../shared/cache/cache.module';

@Module({
  imports: [CommonModule, SecurityModule, CacheModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UsersModule {}