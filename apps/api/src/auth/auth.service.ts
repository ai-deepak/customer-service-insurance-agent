import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { LoginDto, LoginResponseDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    // Mock user validation - replace with actual DB lookup
    const mockUser = {
      id: 1,
      email: 'admin@insurance.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'admin',
    };

    if (email === mockUser.email && await bcrypt.compare(password, mockUser.password)) {
      const { password, ...result } = mockUser;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { username: user.email, sub: user.id, role: user.role };
    const secret = this.configService.get<string>('JWT_SECRET');
    
    return {
      access_token: this.jwtService.sign(payload, { secret }),
      role: user.role,
      expires_in: 3600, // 1 hour
    };
  }
}
