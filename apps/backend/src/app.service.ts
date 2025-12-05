import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@anor/shared';

@Injectable()
export class AppService {
  getHello(): ApiResponse<string> {
    return {
      success: true,
      data: 'Hello World from Anor backend!',
    };
  }
}