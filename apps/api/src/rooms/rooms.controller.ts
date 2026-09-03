import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  type AcceptNdaRequest,
  acceptNdaRequestSchema,
  type CreateRoomRequest,
  createRoomRequestSchema,
  type ParticipantGroup,
  type RoomDetail,
  type RoomListItem,
  type UpdateRoomStatusRequest,
  updateRoomStatusRequestSchema,
} from '@veyra/contracts';
import { type AuthedRequest, CurrentUser } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RoomsService } from './rooms.service';

type Authed = NonNullable<AuthedRequest['user']>;

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(@CurrentUser() user: Authed): Promise<RoomListItem[]> {
    return this.rooms.listForUser(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: Authed,
    @Body(new ZodValidationPipe(createRoomRequestSchema)) body: CreateRoomRequest,
  ): Promise<RoomDetail> {
    return this.rooms.create(user, body);
  }

  @Get(':roomId')
  get(@CurrentUser() user: Authed, @Param('roomId') roomId: string): Promise<RoomDetail> {
    return this.rooms.getForUser(user.id, roomId);
  }

  @Get(':roomId/participants')
  participants(
    @CurrentUser() user: Authed,
    @Param('roomId') roomId: string,
  ): Promise<ParticipantGroup[]> {
    return this.rooms.listParticipants(user.id, roomId);
  }

  @Patch(':roomId/status')
  setStatus(
    @CurrentUser() user: Authed,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(updateRoomStatusRequestSchema)) body: UpdateRoomStatusRequest,
  ): Promise<RoomDetail> {
    return this.rooms.setStatus(user.id, roomId, body.status);
  }

  @Post(':roomId/accept-nda')
  acceptNda(
    @CurrentUser() user: Authed,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(acceptNdaRequestSchema)) body: AcceptNdaRequest,
  ): Promise<RoomDetail> {
    return this.rooms.acceptNda(user.id, roomId, body.ndaAccepted);
  }
}
