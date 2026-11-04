import { Global, Module } from '@nestjs/common';
import { createDatabase, DatabaseLifecycle, SQLITE_DB } from './database';

@Global()
@Module({
  providers: [
    {
      provide: SQLITE_DB,
      useFactory: createDatabase,
    },
    DatabaseLifecycle,
  ],
  exports: [SQLITE_DB],
})
export class DatabaseModule {}
