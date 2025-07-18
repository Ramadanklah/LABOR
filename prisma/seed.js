const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create API key for Mirth Connect
  const mirthApiKey = await prisma.apiKey.create({
    data: {
      name: 'Mirth Connect Integration',
      key: 'mk_mirth_connect_2025_secure_key_123',
      permissions: ['read', 'write'],
      isActive: true
    }
  });
  console.log('✅ Created Mirth API key:', mirthApiKey.key);

  // Create users (doctor and lab)
  const doctor = await prisma.user.create({
    data: {
      bsnr: '123456789',
      lanr: '1234567',
      name: 'Dr. Max Mustermann',
      email: 'dr.mustermann@praxis.de',
      password: await bcrypt.hash('password123', 10),
      role: 'doctor'
    }
  });

  const lab = await prisma.user.create({
    data: {
      bsnr: '987654321',
      lanr: '7654321',
      name: 'Medizin Labor GmbH',
      email: 'labor@medlab.de',
      password: await bcrypt.hash('labpassword123', 10),
      role: 'lab'
    }
  });

  console.log('✅ Created users: Doctor and Lab');

  // Create patients
  const patient1 = await prisma.patient.create({
    data: {
      insuranceNo: 'A123456789',
      lastName: 'Musterfrau',
      firstName: 'Erika',
      birthDate: new Date('1980-02-15'),
      gender: 'W',
      address: 'Teststraße 1',
      zipCode: '12345',
      city: 'Berlin',
      phone: '+49 30 12345678'
    }
  });

  const patient2 = await prisma.patient.create({
    data: {
      insuranceNo: 'B987654321',
      lastName: 'Schmidt',
      firstName: 'Hans',
      birthDate: new Date('1975-08-22'),
      gender: 'M',
      address: 'Musterweg 42',
      zipCode: '54321',
      city: 'Hamburg',
      phone: '+49 40 87654321'
    }
  });

  console.log('✅ Created patients: Erika Musterfrau, Hans Schmidt');

  // Create lab orders with results
  const order1 = await prisma.labOrder.create({
    data: {
      orderNumber: 'ORD2025001001',
      orderDate: new Date('2025-01-15T09:00:00Z'),
      senderId: lab.id,
      receiverId: doctor.id,
      patientId: patient1.id,
      status: 'final',
      comment: 'Routine Kontrollebefund',
      priority: 'normal',
      labResults: {
        create: [
          {
            parameterCode: '8311',
            parameterName: 'Hämoglobin',
            resultValue: '13.8',
            unit: 'g/dL',
            referenceMin: '12.0',
            referenceMax: '17.0',
            resultDate: new Date('2025-01-15T10:30:00Z'),
            abnormalFlag: 'N',
            method: 'Photometrie'
          },
          {
            parameterCode: '8330',
            parameterName: 'Leukozyten',
            resultValue: '7.2',
            unit: '10^9/L',
            referenceMin: '4.0',
            referenceMax: '10.0',
            resultDate: new Date('2025-01-15T10:30:00Z'),
            abnormalFlag: 'N',
            method: 'Durchflusszytometrie'
          },
          {
            parameterCode: '8370',
            parameterName: 'Glucose (nüchtern)',
            resultValue: '92',
            unit: 'mg/dL',
            referenceMin: '70',
            referenceMax: '100',
            resultDate: new Date('2025-01-15T10:30:00Z'),
            abnormalFlag: 'N',
            method: 'Enzymatisch'
          },
          {
            parameterCode: '8420',
            parameterName: 'Cholesterin gesamt',
            resultValue: '220',
            unit: 'mg/dL',
            referenceMin: '150',
            referenceMax: '200',
            resultDate: new Date('2025-01-15T10:30:00Z'),
            abnormalFlag: 'H',
            comment: 'Leicht erhöht - Kontrolle in 3 Monaten empfohlen',
            method: 'Enzymatisch'
          }
        ]
      }
    }
  });

  const order2 = await prisma.labOrder.create({
    data: {
      orderNumber: 'ORD2025001002',
      orderDate: new Date('2025-01-16T14:00:00Z'),
      senderId: lab.id,
      receiverId: doctor.id,
      patientId: patient2.id,
      status: 'processing',
      comment: 'Notfall-Labor',
      priority: 'urgent',
      labResults: {
        create: [
          {
            parameterCode: '8311',
            parameterName: 'Hämoglobin',
            resultValue: '11.2',
            unit: 'g/dL',
            referenceMin: '14.0',
            referenceMax: '18.0',
            resultDate: new Date('2025-01-16T15:00:00Z'),
            abnormalFlag: 'L',
            comment: 'Anämie - weitere Diagnostik erforderlich',
            method: 'Photometrie'
          },
          {
            parameterCode: '8450',
            parameterName: 'Kreatinin',
            resultValue: '1.8',
            unit: 'mg/dL',
            referenceMin: '0.7',
            referenceMax: '1.3',
            resultDate: new Date('2025-01-16T15:00:00Z'),
            abnormalFlag: 'H',
            comment: 'Erhöht - Nierenfunktion prüfen',
            method: 'Kinetisch'
          }
        ]
      }
    }
  });

  console.log('✅ Created lab orders with results');
  console.log('📊 Database seeded successfully!');
  console.log('\n🔑 API Key for Mirth Connect:', mirthApiKey.key);
  console.log('👨‍⚕️ Doctor login: dr.mustermann@praxis.de / password123');
  console.log('🧪 Lab login: labor@medlab.de / labpassword123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });