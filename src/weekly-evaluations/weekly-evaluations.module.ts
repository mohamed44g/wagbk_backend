import { Module } from '@nestjs/common';
import { WeeklyEvaluationsController } from './weekly-evaluations.controller';
import { WeeklyEvaluationsService } from './weekly-evaluations.service';

@Module({
  controllers: [WeeklyEvaluationsController],
  providers: [WeeklyEvaluationsService],
})
export class WeeklyEvaluationsModule {}
