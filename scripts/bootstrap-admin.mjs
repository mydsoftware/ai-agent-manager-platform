import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()

if (!adminEmail) {
  console.log('Admin bootstrap skipped: ADMIN_EMAIL is not set.')
  process.exit(0)
}

try {
  const user = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!user) {
    console.log(`Admin bootstrap skipped: ${adminEmail} does not exist yet.`)
  } else if (user.role !== 'ADMIN') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
    console.log(`Admin role granted to ${adminEmail}`)
  } else {
    console.log(`Admin role already active for ${adminEmail}`)
  }
} finally {
  await prisma.$disconnect()
}
