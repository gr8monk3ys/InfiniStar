# InfiniStar

A real-time messaging and AI chatbot application built with Next.js, featuring subscription-based access, Stripe payments, and a modern dashboard for seamless conversations.

## ✨ Features

- **Real-time Messaging**: Instant message delivery using Pusher WebSockets
- **AI Chat Interface**: Modern, responsive chat interface for conversations
- **Subscription Management**: Stripe integration for premium subscriptions
- **Multiple Auth Methods**: Email/password, GitHub OAuth, and Google OAuth
- **Modern UI**: Built with Tailwind CSS and Radix UI primitives
- **Dark Mode**: Support for light/dark themes using next-themes
- **Database**: MongoDB integration with Prisma ORM
- **Type Safety**: Full TypeScript support with strict type checking
- **Responsive Design**: Mobile-first approach for all screen sizes
- **Group Chats**: Support for multi-user conversations
- **Message Status**: See when messages are read by recipients

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Database**: MongoDB
- **ORM**: Prisma
- **Authentication**: NextAuth.js
- **Payment Processing**: Stripe
- **Real-time**: Pusher
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI Primitives
- **Icons**: Lucide Icons
- **Form Handling**: React Hook Form
- **Validation**: Zod
- **State Management**: Zustand

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/infinistar.git
cd infinistar
npm install

# Set up environment
cp .env.template .env.local
# Edit .env.local with your credentials

# Set up database
npx prisma generate
npx prisma db push

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

**📖 For detailed setup instructions, see [SETUP.md](SETUP.md)**

## 🔧 Environment Variables

All required environment variables are documented in [.env.template](.env.template).

**Essential services:**

- **MongoDB**: Database (`DATABASE_URL`)
- **NextAuth**: Authentication (`NEXTAUTH_SECRET`)
- **Pusher**: Real-time messaging (4 variables)
- **Stripe**: Subscriptions (3 variables)
- **Postmark**: Email notifications (4 variables)
- **OAuth**: GitHub and Google (optional, 4 variables)

See [SETUP.md](SETUP.md) for detailed configuration of each service.

## 📚 Documentation

- **[SETUP.md](SETUP.md)** - Complete setup and configuration guide
- **[CLAUDE.md](CLAUDE.md)** - Codebase architecture and patterns
- **[TODO.md](TODO.md)** - Known issues and planned features
- **[MIGRATION.md](MIGRATION.md)** - Recent fixes and changes

## 🛠️ Development

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run typecheck    # Run TypeScript type checking
npm run lint:fix     # Fix linting issues
npm run format:write # Format code
```

## 🧪 Recent Fixes (January 2025)

This codebase recently underwent major fixes to make it fully functional:

- ✅ Fixed duplicate directory structure issues
- ✅ Implemented real-time messaging with Pusher
- ✅ Fixed authentication session management
- ✅ Added input validation and security improvements
- ✅ Resolved all TypeScript errors
- ✅ Fixed Stripe webhook handlers
- ✅ Consolidated duplicate code

See [MIGRATION.md](MIGRATION.md) for complete details.

## 📝 License

Licensed under the [MIT license](LICENSE.md).

## Tags

```
#nextjs #typescript #ai #chatbot #stripe #tailwindcss #prisma #mongodb #react #subscription-saas #real-time #authentication #dashboard #web-application #messaging
```
