import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './db/database.module';
import { loggerParams } from './logger.config';
import { DatasetModule } from './dataset/dataset.module';
import { ExplainModule } from './explain/explain.module';
import { FavouritesModule } from './favourites/favourites.module';
import { ImagesModule } from './images/images.module';
import { MetaModule } from './meta/meta.module';
import { QuotesModule } from './quotes/quotes.module';

@Module({
  imports: [
    LoggerModule.forRoot(loggerParams),
    DatabaseModule,
    DatasetModule,
    QuotesModule,
    ExplainModule,
    ImagesModule,
    FavouritesModule,
    MetaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
