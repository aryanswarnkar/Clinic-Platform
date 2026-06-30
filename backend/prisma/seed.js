// prisma/seed.js – Seeds admin user and sample doctors
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Admin User ─────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@12345', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@clinic.com' },
    update: {},
    create: {
      email: 'admin@clinic.com',
      passwordHash: adminHash,
      name: 'Clinic Admin',
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin: ${admin.email}`);

  // ── Sample Doctors ────────────────────────────────────
  const doctors = [
    {
      name: 'Dr. Sarah Mitchell',
      email: 'sarah.mitchell@clinic.com',
      specialisation: 'Cardiology',
      workStartTime: '09:00',
      workEndTime: '17:00',
      slotDurationMins: 20,
      bio: 'Board-certified cardiologist with 15 years of experience.',
    },
    {
      name: 'Dr. James Patel',
      email: 'james.patel@clinic.com',
      specialisation: 'Dermatology',
      workStartTime: '10:00',
      workEndTime: '18:00',
      slotDurationMins: 15,
      bio: 'Specialist in skin disorders, cosmetic dermatology, and skin cancer screening.',
    },
    {
      name: 'Dr. Anya Rosenberg',
      email: 'anya.rosenberg@clinic.com',
      specialisation: 'General Practice',
      workStartTime: '08:00',
      workEndTime: '16:00',
      slotDurationMins: 15,
      bio: 'Family physician focused on preventative care and chronic disease management.',
    },
    {
      name: 'Dr. Marcus Chen',
      email: 'marcus.chen@clinic.com',
      specialisation: 'Orthopedics',
      workStartTime: '09:00',
      workEndTime: '17:00',
      slotDurationMins: 30,
      bio: 'Orthopedic surgeon specialising in joint replacement and sports injuries.',
    },
  ];

  for (const doc of doctors) {
    const hash = await bcrypt.hash('Doctor@12345', 12);
    const user = await prisma.user.upsert({
      where: { email: doc.email },
      update: {},
      create: {
        email: doc.email,
        passwordHash: hash,
        name: doc.name,
        role: 'DOCTOR',
        doctor: {
          create: {
            specialisation: doc.specialisation,
            workStartTime: doc.workStartTime,
            workEndTime: doc.workEndTime,
            slotDurationMins: doc.slotDurationMins,
            bio: doc.bio,
          },
        },
      },
    });
    console.log(`✅ Doctor: ${doc.name} (${doc.specialisation})`);
  }

  // ── Sample Patient ────────────────────────────────────
  const patientHash = await bcrypt.hash('Patient@12345', 12);
  await prisma.user.upsert({
    where: { email: 'john.doe@example.com' },
    update: {},
    create: {
      email: 'john.doe@example.com',
      passwordHash: patientHash,
      name: 'John Doe',
      role: 'PATIENT',
    },
  });
  console.log('✅ Patient: john.doe@example.com');

  console.log('\n🎉 Seed complete!');
  console.log('\n📋 Credentials:');
  console.log('   Admin:   admin@clinic.com     / Admin@12345');
  console.log('   Doctors: [name]@clinic.com    / Doctor@12345');
  console.log('   Patient: john.doe@example.com / Patient@12345');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
