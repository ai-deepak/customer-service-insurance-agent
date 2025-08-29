import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { LoginDto, LoginResponseDto, RefreshTokenDto } from './dto/auth.dto';

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
    
    // Generate access token (1 hour)
    const access_token = this.jwtService.sign(payload, { 
      secret, 
      expiresIn: '1h' 
    });
    
    // Generate refresh token (7 days)
    const refresh_token = this.jwtService.sign(
      { sub: user.id, type: 'refresh' }, 
      { 
        secret, 
        expiresIn: '7d' 
      }
    );
    
    return {
      access_token,
      refresh_token,
      role: user.role,
      expires_in: 3600, // 1 hour
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<LoginResponseDto> {
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      const decoded = this.jwtService.verify(refreshTokenDto.refresh_token, { secret });
      
      // Verify this is a refresh token
      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user info (in real app, fetch from database)
      const mockUser = {
        id: decoded.sub,
        email: 'admin@insurance.com', // In real app, fetch from DB
        role: 'admin',
      };

      const payload = { username: mockUser.email, sub: mockUser.id, role: mockUser.role };
      
      // Generate new access token
      const access_token = this.jwtService.sign(payload, { 
        secret, 
        expiresIn: '1h' 
      });
      
      // Generate new refresh token
      const refresh_token = this.jwtService.sign(
        { sub: mockUser.id, type: 'refresh' }, 
        { 
          secret, 
          expiresIn: '7d' 
        }
      );

      return {
        access_token,
        refresh_token,
        role: mockUser.role,
        expires_in: 3600,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
