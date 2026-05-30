import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const salt = await bcrypt.genSalt(10)
  const passwordHash = await bcrypt.hash('password123', salt)

  // Seed Free User
  const freeUser = await prisma.user.upsert({
    where: { email: 'free@finscreen.in' },
    update: {},
    create: {
      email: 'free@finscreen.in',
      name: 'Free Investor',
      passwordHash,
      plan: 'FREE',
      watchlists: {
        create: {
          name: 'My Watchlist',
          items: {
            createMany: {
              data: [
                { symbol: 'RELIANCE', targetPrice: 3200, alertEnabled: true },
                { symbol: 'TCS', targetPrice: 3800, alertEnabled: false },
                { symbol: 'HDFCBANK', targetPrice: 1800, alertEnabled: true }
              ]
            }
          }
        }
      },
      savedScreens: {
        createMany: {
          data: [
            {
              name: 'Debt Free Companies',
              description: 'Companies with zero long-term debt and strong cash flows',
              queryText: 'debtToEquity < 0.1 AND interestCoverage > 10',
              alertEnabled: false
            },
            {
              name: 'High Dividend Yield',
              description: 'Consistent high dividend payers with dividend yield > 3%',
              queryText: 'dividendYield > 3 AND pe < 20',
              alertEnabled: true,
              alertFrequency: 'DAILY'
            }
          ]
        }
      }
    }
  })

  // Seed Pro User
  const proUser = await prisma.user.upsert({
    where: { email: 'pro@finscreen.in' },
    update: {},
    create: {
      email: 'pro@finscreen.in',
      name: 'Pro Trader',
      passwordHash,
      plan: 'PRO',
      watchlists: {
        create: {
          name: 'Growth Watch',
          items: {
            createMany: {
              data: [
                { symbol: 'INFY', targetPrice: 1600, alertEnabled: true },
                { symbol: 'ICICIBANK', targetPrice: 1150, alertEnabled: true },
                { symbol: 'SBIN', targetPrice: 850, alertEnabled: false }
              ]
            }
          }
        }
      },
      savedScreens: {
        createMany: {
          data: [
            {
              name: 'Magic Formula',
              description: 'High ROCE + Low EV/EBITDA',
              queryText: 'roce > 20 AND pe < 15',
              alertEnabled: true,
              alertFrequency: 'IMMEDIATE'
            }
          ]
        }
      }
    }
  })

  console.log('Database seeded successfully!')
  console.log('Free User: free@finscreen.in / password123')
  console.log('Pro User: pro@finscreen.in / password123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
