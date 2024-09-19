import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: 'chat', cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clientNames: { [id: string]: string } = {};
  
  // 클라이언트가 연결될 때 실행될 메소드
  handleConnection(@ConnectedSocket() client: Socket): void {
    // 클라이언트에게 준비가 되었다는 신호를 보냄
    // client.emit('ready');
    client.emit('connection', { clientId: client.id });
    this.broadcastClientsCount();
  }

  // 클라이언트가 이름을 설정할 때 실행될 메소드
  @SubscribeMessage('setName')
  async handleSetName(
      @MessageBody() data: { name: string },
      @ConnectedSocket() client: Socket
  ): Promise<void> {
    const { name } = data;
    // 클라이언트의 이름을 저장
    this.clientNames[client.id] = name;
    console.log(`Client ${client.id} set their name to ${name}`);

    await client.join('1');
    this.broadcastClientsCount();
    client.broadcast.to('1').emit('joinPerson', `${this.clientNames[client.id]} 님이 입장하셨습니다.`);
    client.emit('nameSet', { success: true });
  }

  // 클라이언트의 연결이 해제될 때 실행될 메소드
  handleDisconnect(@ConnectedSocket() client: Socket): void {
    console.log(`Client disconnected: ${this.clientNames[client.id] || client.id}`);
    client.broadcast.to('1').emit('outPerson', `${this.clientNames[client.id]} 님이 퇴장하셨습니다.`);
    // 이름 매핑에서 해당 클라이언트를 제거
    delete this.clientNames[client.id];
    this.broadcastClientsCount();
  }

  async broadcastClientsCount(): Promise<void> {
    const sockets = await this.server.in('1').allSockets();
    const clientsCount = sockets.size;
    this.server.to('1').emit('clientsCount', { count: clientsCount });
  }

  @SubscribeMessage('message')
  async  handleEvents(
      @MessageBody() data: { id: string; message: string },
      @ConnectedSocket() client: Socket
  ): Promise<void> {
    const name = this.clientNames[client.id] || 'Anonymous';

    client.broadcast.to('1').emit('stranger', {
      res_code: '0',
      message: data.message,
      name: name
    });

    if (data.id == client.id) {
      client.emit('result', {
        res_code: '0',
        message: data.message
      });
    }

  }

}