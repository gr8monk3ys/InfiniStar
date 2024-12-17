# InfiniStar 

An AI chatbot application built with Next.js, featuring subscription-based access, Stripe payments, and a modern dashboard for seamless AI interactions.

## Features

- **AI Chat Interface**: Modern, responsive chat interface for AI interactions
- **Subscription Management**: Stripe integration for handling premium subscriptions
- **Real-time Updates**: Pusher integration for instant message updates
- **Authentication**: Secure user authentication with NextAuth.js
- **Modern UI**: Built with Tailwind CSS and Radix UI primitives
- **Dark Mode**: Support for light/dark themes using next-themes
- **Database**: MongoDB integration with Prisma ORM
- **Type Safety**: Full TypeScript support
- **Responsive Design**: Mobile-first approach for all screen sizes

## Tech Stack

- **Framework**: Next.js 13 with App Directory
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

## Getting Started

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/infinistar.git
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.template .env.local
```
Fill in your environment variables in `.env.local`

4. **Set up the database**
```bash
npx prisma generate
npx prisma db push
```

5. **Run the development server**
```bash
npm run dev
```

## Environment Variables

Required environment variables:
- `DATABASE_URL`: MongoDB connection string
- `NEXTAUTH_SECRET`: NextAuth.js secret
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret
- `PUSHER_APP_ID`: Pusher app ID
- `PUSHER_SECRET`: Pusher secret
- `NEXT_PUBLIC_PUSHER_KEY`: Pusher public key

## License

Licensed under the [MIT license](LICENSE.md).

## Tags
```
#nextjs #typescript #ai #chatbot #stripe #tailwindcss #prisma #mongodb #react #subscription-saas #real-time #authentication #dashboard #web-application #openai
```
