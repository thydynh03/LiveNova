import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { BattleService } from './battle.service';
import { SimulateBattleEventDto } from './dto/battle.dto';

@Controller('battle')
@UseGuards(JwtAuthGuard)
export class BattleController {
  constructor(private readonly battleService: BattleService) {}

  @Get('state')
  async getBattleState(@CurrentUserId() userId: string) {
    return this.battleService.getOrCreateBattle(userId);
  }

  @Post('simulate')
  async simulateEvent(
    @CurrentUserId() userId: string,
    @Body() dto: SimulateBattleEventDto,
  ) {
    return this.battleService.simulateEvent(userId, dto);
  }

  @Post('reset')
  async resetBattle(@CurrentUserId() userId: string) {
    return this.battleService.resetBattle(userId);
  }

  @Post('map-theme')
  async setMapTheme(
    @CurrentUserId() userId: string,
    @Body() body: { mapTheme: string },
  ) {
    return this.battleService.setMapTheme(userId, body.mapTheme);
  }
}
