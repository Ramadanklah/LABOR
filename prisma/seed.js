const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Only seed if SEED_DEMO_DATA is enabled
  if (process.env.SEED_DEMO_DATA !== 'true') {
    console.log('SEED_DEMO_DATA not enabled, skipping seed...');
    return;
  }

  try {
    // Create default tenant
    const defaultTenant = await prisma.tenant.upsert({
      where: { subdomain: 'default' },
      update: {},
      create: {
        id: 'default-tenant-id',
        name: 'Default Medical Center',
        subdomain: 'default',
        domain: 'laborresults.de',
        isActive: true,
        config: {
          branding: {
            name: 'Default Medical Center',
            logo: null,
            primaryColor: '#2563eb',
            secondaryColor: '#1e40af'
          },
          features: {
            mfa: true,
            rbac: true,
            exports: true,
            fhir: true
          },
          limits: {
            maxFileSize: 10485760,
            maxResultsPerExport: 10000,
            retentionDays: 2555
          }
        }
      }
    });

    console.log('Created default tenant:', defaultTenant.name);

    // Create demo tenant
    const demoTenant = await prisma.tenant.upsert({
      where: { subdomain: 'demo' },
      update: {},
      create: {
        id: 'demo-tenant-id',
        name: 'Demo Medical Practice',
        subdomain: 'demo',
        domain: 'demo.laborresults.de',
        isActive: true,
        config: {
          branding: {
            name: 'Demo Medical Practice',
            logo: null,
            primaryColor: '#059669',
            secondaryColor: '#047857'
          },
          features: {
            mfa: true,
            rbac: true,
            exports: true,
            fhir: true
          },
          limits: {
            maxFileSize: 10485760,
            maxResultsPerExport: 10000,
            retentionDays: 2555
          }
        }
      }
    });

    console.log('Created demo tenant:', demoTenant.name);

    // Create admin user for default tenant
    const adminPassword = await bcrypt.hash('admin123', 12);
    const adminUser = await prisma.user.upsert({
      where: { 
        email_tenantId: {
          email: 'admin@laborresults.de',
          tenantId: defaultTenant.id
        }
      },
      update: {},
      create: {
        email: 'admin@laborresults.de',
        password: adminPassword,
        firstName: 'System',
        lastName: 'Administrator',
        role: 'admin',
        bsnr: '999999999',
        lanr: '9999999',
        isActive: true,
        isTwoFactorEnabled: false,
        tenantId: defaultTenant.id
      }
    });

    console.log('Created admin user:', adminUser.email);

    // Create doctor user for default tenant
    const doctorPassword = await bcrypt.hash('doctor123', 12);
    const doctorUser = await prisma.user.upsert({
      where: {
        email_tenantId: {
          email: 'doctor@laborresults.de',
          tenantId: defaultTenant.id
        }
      },
      update: {},
      create: {
        email: 'doctor@laborresults.de',
        password: doctorPassword,
        firstName: 'Dr. Maria',
        lastName: 'Schmidt',
        role: 'doctor',
        bsnr: '123456789',
        lanr: '1234567',
        isActive: true,
        isTwoFactorEnabled: false,
        tenantId: defaultTenant.id
      }
    });

    console.log('Created doctor user:', doctorUser.email);

    // Create lab technician for default tenant
    const labPassword = await bcrypt.hash('lab123', 12);
    const labUser = await prisma.user.upsert({
      where: {
        email_tenantId: {
          email: 'lab@laborresults.de',
          tenantId: defaultTenant.id
        }
      },
      update: {},
      create: {
        email: 'lab@laborresults.de',
        password: labPassword,
        firstName: 'Hans',
        lastName: 'Mueller',
        role: 'lab_technician',
        bsnr: '123456789',
        lanr: '1234568',
        isActive: true,
        isTwoFactorEnabled: false,
        tenantId: defaultTenant.id
      }
    });

    console.log('Created lab technician user:', labUser.email);

    // Create demo users for demo tenant
    const demoAdminPassword = await bcrypt.hash('demo123', 12);
    const demoAdminUser = await prisma.user.upsert({
      where: {
        email_tenantId: {
          email: 'admin@demo.laborresults.de',
          tenantId: demoTenant.id
        }
      },
      update: {},
      create: {
        email: 'admin@demo.laborresults.de',
        password: demoAdminPassword,
        firstName: 'Demo',
        lastName: 'Administrator',
        role: 'admin',
        bsnr: '111111111',
        lanr: '1111111',
        isActive: true,
        isTwoFactorEnabled: false,
        tenantId: demoTenant.id
      }
    });

    console.log('Created demo admin user:', demoAdminUser.email);

    // Create BSNR mappings
    const bsnrMappings = [
      { bsnr: '123456789', tenantId: defaultTenant.id },
      { bsnr: '987654321', tenantId: defaultTenant.id },
      { bsnr: '111111111', tenantId: demoTenant.id },
      { bsnr: '222222222', tenantId: demoTenant.id }
    ];

    for (const mapping of bsnrMappings) {
      await prisma.bSNRMapping.upsert({
        where: { bsnr: mapping.bsnr },
        update: {},
        create: mapping
      });
    }

    console.log('Created BSNR mappings');

    // Create demo lab results
    const demoResults = [
      {
        patientId: 'P001',
        patientName: 'Max Mustermann',
        patientBirthDate: new Date('1980-05-15'),
        bsnr: '123456789',
        lanr: '1234567',
        orderDate: new Date('2024-01-15'),
        resultDate: new Date('2024-01-16'),
        status: 'completed',
        priority: 'routine',
        notes: 'Routine blood work',
        tenantId: defaultTenant.id
      },
      {
        patientId: 'P002',
        patientName: 'Anna Schmidt',
        patientBirthDate: new Date('1990-08-22'),
        bsnr: '123456789',
        lanr: '1234567',
        orderDate: new Date('2024-01-14'),
        resultDate: new Date('2024-01-15'),
        status: 'completed',
        priority: 'urgent',
        notes: 'Emergency blood work',
        tenantId: defaultTenant.id
      },
      {
        patientId: 'P003',
        patientName: 'Demo Patient',
        patientBirthDate: new Date('1975-12-10'),
        bsnr: '111111111',
        lanr: '1111111',
        orderDate: new Date('2024-01-13'),
        resultDate: new Date('2024-01-14'),
        status: 'completed',
        priority: 'routine',
        notes: 'Demo lab result',
        tenantId: demoTenant.id
      }
    ];

    for (const resultData of demoResults) {
      const result = await prisma.result.upsert({
        where: {
          id: `${resultData.patientId}-${resultData.orderDate.toISOString().split('T')[0]}`
        },
        update: {},
        create: {
          id: `${resultData.patientId}-${resultData.orderDate.toISOString().split('T')[0]}`,
          ...resultData
        }
      });

      // Create observations for each result
      const observations = [
        {
          code: '789-8',
          name: 'Red Blood Cell Count',
          value: '4.5',
          unit: '10^12/L',
          referenceRange: '4.0-5.5',
          interpretation: 'normal',
          rawValue: '4.5',
          normalizedValue: '4.5',
          normalizedUnit: '10^12/L',
          resultId: result.id,
          tenantId: result.tenantId
        },
        {
          code: '718-7',
          name: 'Hemoglobin',
          value: '14.2',
          unit: 'g/dL',
          referenceRange: '12.0-16.0',
          interpretation: 'normal',
          rawValue: '14.2',
          normalizedValue: '142',
          normalizedUnit: 'g/L',
          resultId: result.id,
          tenantId: result.tenantId
        },
        {
          code: '4544-3',
          name: 'Hematocrit',
          value: '42.5',
          unit: '%',
          referenceRange: '36.0-46.0',
          interpretation: 'normal',
          rawValue: '42.5',
          normalizedValue: '0.425',
          normalizedUnit: '1',
          resultId: result.id,
          tenantId: result.tenantId
        }
      ];

      for (const obsData of observations) {
        await prisma.observation.create({
          data: obsData
        });
      }

      console.log(`Created result for patient ${resultData.patientName} with observations`);
    }

    // Create demo LDT messages
    const demoLdtMessages = [
      {
        messageId: 'MSG001',
        idempotencyKey: crypto.randomUUID(),
        status: 'processed',
        rawMessage: 'Sample LDT message content',
        parsedData: {
          patientId: 'P001',
          patientName: 'Max Mustermann',
          tests: [
            { code: '789-8', name: 'Red Blood Cell Count', value: '4.5', unit: '10^12/L' }
          ]
        },
        processedAt: new Date(),
        tenantId: defaultTenant.id
      },
      {
        messageId: 'MSG002',
        idempotencyKey: crypto.randomUUID(),
        status: 'processed',
        rawMessage: 'Sample LDT message content 2',
        parsedData: {
          patientId: 'P002',
          patientName: 'Anna Schmidt',
          tests: [
            { code: '718-7', name: 'Hemoglobin', value: '14.2', unit: 'g/dL' }
          ]
        },
        processedAt: new Date(),
        tenantId: defaultTenant.id
      }
    ];

    for (const ldtData of demoLdtMessages) {
      await prisma.lDTMessage.upsert({
        where: { messageId: ldtData.messageId },
        update: {},
        create: ldtData
      });
    }

    console.log('Created demo LDT messages');

    // Create demo exports
    const demoExports = [
      {
        type: 'pdf',
        status: 'completed',
        filters: { patientId: 'P001', dateRange: { from: '2024-01-01', to: '2024-01-31' } },
        filePath: '/exports/demo-export-1.pdf',
        fileSize: 1024000,
        downloadUrl: 'https://example.com/download/demo-export-1.pdf',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        tenantId: defaultTenant.id,
        createdBy: adminUser.id
      },
      {
        type: 'csv',
        status: 'pending',
        filters: { dateRange: { from: '2024-01-01', to: '2024-01-31' } },
        tenantId: defaultTenant.id,
        createdBy: doctorUser.id
      }
    ];

    for (const exportData of demoExports) {
      await prisma.export.create({
        data: exportData
      });
    }

    console.log('Created demo exports');

    // Create demo audit logs
    const demoAuditLogs = [
      {
        action: 'login',
        resource: 'user',
        resourceId: adminUser.id,
        details: { ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0...' },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        tenantId: defaultTenant.id,
        userId: adminUser.id
      },
      {
        action: 'create',
        resource: 'result',
        resourceId: 'P001-2024-01-15',
        details: { patientId: 'P001', resultDate: '2024-01-16' },
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        tenantId: defaultTenant.id,
        userId: labUser.id
      }
    ];

    for (const auditData of demoAuditLogs) {
      await prisma.auditLog.create({
        data: auditData
      });
    }

    console.log('Created demo audit logs');

    // Create demo usage events
    const demoUsageEvents = [
      {
        eventType: 'results_ingested',
        quantity: 3,
        metadata: { source: 'ldt', tenantId: defaultTenant.id },
        tenantId: defaultTenant.id
      },
      {
        eventType: 'pdf_generated',
        quantity: 1,
        metadata: { exportId: 'export-1', fileSize: 1024000 },
        tenantId: defaultTenant.id
      },
      {
        eventType: 'api_call',
        quantity: 25,
        metadata: { endpoint: '/api/results', method: 'GET' },
        tenantId: defaultTenant.id
      }
    ];

    for (const usageData of demoUsageEvents) {
      await prisma.usageEvent.create({
        data: usageData
      });
    }

    console.log('Created demo usage events');

    console.log('Database seeding completed successfully!');
    console.log('\nDemo credentials:');
    console.log('Default Tenant:');
    console.log('  Admin: admin@laborresults.de / admin123');
    console.log('  Doctor: doctor@laborresults.de / doctor123');
    console.log('  Lab: lab@laborresults.de / lab123');
    console.log('\nDemo Tenant:');
    console.log('  Admin: admin@demo.laborresults.de / demo123');

  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });