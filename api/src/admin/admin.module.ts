import { Module, DynamicModule } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({})
export class AdminPanelModule {
  static async register(): Promise<DynamicModule> {
    const { AdminModule } = await import('@adminjs/nestjs');
    const { default: AdminJS } = await import('adminjs');
    const { Database, Resource, getModelByName } = await import('@adminjs/prisma');

    AdminJS.registerAdapter({ Database, Resource });

    return {
      module: AdminPanelModule,
      imports: [
        PrismaModule,
        AdminModule.createAdminAsync({
          imports: [PrismaModule],
          inject: [PrismaService],
          useFactory: async (prisma: PrismaService) => {
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@setu.com';
            const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword123';
            const cookiePassword = process.env.ADMIN_COOKIE_PASSWORD || 'sessionsecretcookiekey1234567890';

            return {
              adminJsOptions: {
                rootPath: '/admin-panel',
                loginPath: '/admin-panel/login',
                logoutPath: '/admin-panel/logout',
                resources: [
                  {
                    resource: { model: getModelByName('User'), client: prisma },
                    options: {
                      navigation: { name: 'User Management', icon: 'User' },
                      properties: {
                        passwordHash: { isVisible: false },
                        verificationToken: { isVisible: { list: false, show: true, edit: true, filter: false } },
                        resetToken: { isVisible: { list: false, show: true, edit: true, filter: false } },
                        resetTokenExpires: { isVisible: { list: false, show: true, edit: true, filter: false } },
                      },
                    },
                  },
                  {
                    resource: { model: getModelByName('Subdomain'), client: prisma },
                    options: {
                      navigation: { name: 'Routing & Tunnels', icon: 'Globe' },
                    },
                  },
                  {
                    resource: { model: getModelByName('Tunnel'), client: prisma },
                    options: {
                      navigation: { name: 'Routing & Tunnels', icon: 'Activity' },
                    },
                  },
                  {
                    resource: { model: getModelByName('ApiKey'), client: prisma },
                    options: {
                      navigation: { name: 'User Management', icon: 'Key' },
                      properties: {
                        keyHash: { isVisible: { list: true, show: true, edit: false, filter: false } },
                      },
                    },
                  },
                  {
                    resource: { model: getModelByName('PaymentLog'), client: prisma },
                    options: {
                      navigation: { name: 'Billing & Payments', icon: 'CreditCard' },
                    },
                  },
                ],
                branding: {
                  companyName: 'Setu Admin Panel',
                  theme: {
                    colors: {
                      primary100: '#8b5cf6',
                    },
                  },
                },
              },
              auth: {
                authenticate: async (email, password) => {
                  if (email === adminEmail && password === adminPassword) {
                    return { email: adminEmail };
                  }
                  return null;
                },
                cookiePassword,
                cookieName: 'adminjs-session',
              },
            };
          },
        }),
      ],
    };
  }
}
