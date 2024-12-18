# Express TypeScript API

A robust REST API built with Express.js and TypeScript, featuring authentication, authorization, and CRUD operations.

## Features

- User authentication with JWT
- Role-based authorization (User/Admin)
- Email verification
- CRUD operations for posts and comments
- Rate limiting
- Error handling
- Request logging with rotation
- PostgreSQL database with Prisma ORM
- OpenAPI/Swagger documentation
- Test environment setup
- Docker support

## Prerequisites

- Node.js (v18+)
- PostgreSQL (v15)
- npm/yarn

## Getting Started

1. Clone the repository

```bash
git clone https://github.com/oluwadamilarey/api-interview
cd api-interview
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/api_db"
JWT_SECRET=your_secret_key_at_least_32_characters_long
JWT_EXPIRES_IN=7d
LOG_LEVEL=debug
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

4. Start PostgreSQL

```bash
docker compose up -d
```

5. Run database migrations

```bash
npx prisma generate
npx prisma migrate dev
```

6. Start the server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Documentation

- User Documentation: `http://localhost:3000/api/docs/user`
- Admin Documentation: `http://localhost:3000/api/docs/admin`

## API Endpoints

### Authentication

```
POST /api/auth/signup         # Register a new user
POST /api/auth/login          # Login user
POST /api/auth/admin         # Create admin (Admin only)
```

### Posts

```
GET    /api/posts            # Get all posts
GET    /api/posts/:id        # Get single post
POST   /api/posts            # Create post (Auth required)
PATCH  /api/posts/:id        # Update post (Auth required)
DELETE /api/posts/:id        # Delete post (Auth required)
```

### Comments

```
GET    /api/posts/:postId/comments     # Get post comments
POST   /api/posts/:postId/comments     # Create comment (Auth required)
PATCH  /api/comments/:id              # Update comment (Auth required)
DELETE /api/comments/:id              # Delete comment (Auth required)
```

### User Management (Admin only)

```
GET    /api/users            # Get all users
PATCH  /api/users/:id/role   # Update user role
DELETE /api/users/:id        # Delete user
```

## Testing

1. Set up test environment

Create a `.env.test` file:

```env
NODE_ENV=test
DATABASE_URL="postgresql://test_user:test_password@localhost:5433/test_db"
```

2. Run tests

```bash
npm test
```

## Error Handling

The API uses a centralized error handling mechanism:

- Validation errors: 400
- Authentication errors: 401
- Authorization errors: 403
- Not found: 404
- Server errors: 500

## Rate Limiting

- Global rate limit: 100 requests per 15 minutes
- Stricter limits for auth routes: 5 requests per 15 minutes
- Custom limits for post/comment creation

## Project Structure

```
├── src/
│   ├── app.ts                 # Express app setup
│   ├── server.ts              # Server startup
│   ├── config.ts              # Configurations
│   ├── routes.ts              # Route definitions
│   ├── auth.ts                # Authentication logic
│   ├── posts.ts               # Posts logic
│   ├── comments.ts            # Comments logic
│   ├── users.ts               # User management
│   ├── types.ts               # TypeScript types
│   ├── utils.ts               # Utilities
│   └── swagger.ts             # API documentation
├── prisma/
│   └── schema.prisma          # Database schema
├── tests/
│   └── ...                    # Test files
└── docker-compose.yml         # Docker configuration
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to branch
5. Open a Pull Request

## License

[MIT License](LICENSE)# api-interview
