# Dynamic Supabase Code Generation

This directory contains scripts that automatically generate TypeScript types and database utility functions based on your Supabase schema.

## Overview

The generation system consists of two main scripts:

1. **`generate-types.js`** - Generates TypeScript types from database schema
2. **`generate-db.js`** - Generates query and mutation functions for database operations

Both scripts are **dynamic** and automatically discover your database schema, so you don't need to manually maintain static configurations.

## How It Works

### 1. Schema Discovery

The scripts use two methods to discover your database schema:

**Primary Method (with Supabase credentials):**
- Connects directly to Supabase using the Management API
- Queries `information_schema` tables to get real-time schema information
- Discovers tables, columns, primary keys, and relationships automatically

**Fallback Method (without credentials):**
- Parses your existing `database.types.ts` file
- Extracts table names and relationships from TypeScript definitions
- Works offline and doesn't require database access

### 2. Code Generation

Based on the discovered schema, the scripts generate:

**Types (`generate-types.js`):**
- Individual TypeScript types for each table (e.g., `Chat`, `Message`, `User`)
- Exported from `types.ts` for use throughout your application

**Database Utilities (`generate-db.js`):**
- **Queries:** `get-{singular}`, `get-all-{plural}`, `get-{plural}-by-{relation}`
- **Mutations:** `create-{singular}`, `update-{singular}`, `delete-{singular}`
- All functions include proper TypeScript types and error handling

## Usage

### Basic Commands

```bash
# Generate everything (recommended)
npm run gen:all

# Generate individual components
npm run gen:db      # Generate database.types.ts from Supabase
npm run gen:types   # Generate types.ts from database.types.ts  
npm run gen:queries # Generate query/mutation functions
```

### Development Workflow

```bash
# Start development (auto-generates on startup)
npm run dev
```

The `dev` command automatically runs all generation scripts before starting the development server.

## Generated File Structure

```
utils/
├── queries/
│   ├── chats/
│   │   ├── get-chat.ts
│   │   ├── get-all-chats.ts
│   │   └── ...
│   ├── messages/
│   │   ├── get-message.ts
│   │   ├── get-all-messages.ts
│   │   ├── get-messages-by-chat.ts  # Relationship-based query
│   │   └── ...
│   └── ...
├── mutations/
│   ├── chats/
│   │   ├── create-chat.ts
│   │   ├── update-chat.ts
│   │   ├── delete-chat.ts
│   │   └── ...
│   └── ...
└── ...

types.ts  # Generated TypeScript types
```

## Example Generated Code

### Types (`types.ts`)

```typescript
// Auto-generated from your database schema
export type Chat = Tables<'chats'>;
export type Message = Tables<'messages'>;
export type User = Tables<'users'>;
```

### Query Function

```typescript
// utils/queries/messages/get-message.ts
export const getMessage = async (id: string) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching message", error);
    throw new Error("Failed to fetch message.");
  }

  return data;
};
```

### Relationship Query

```typescript
// utils/queries/messages/get-messages-by-chat.ts
export const getMessagesByChat = async (chatId: string) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId);

  if (error) {
    logError("Error fetching messages by chat", error);
    throw new Error("Failed to fetch messages.");
  }

  return data || [];
};
```

## Environment Variables

For full functionality, set up these environment variables in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SERVICE_ROLE_KEY=your_service_role_key
```

**Note:** The scripts work in fallback mode without these variables, but with limited relationship discovery.

## Customization

### Adding New Tables

1. Create the table in your Supabase database
2. Run `npm run gen:all`
3. The scripts automatically detect and generate code for the new table

### Modifying Relationships

1. Update foreign key constraints in your database
2. Run `npm run gen:all`
3. Relationship-based queries are automatically updated

### Custom Query Logic

The generated functions are basic CRUD operations. For complex queries:

1. Use the generated functions as a foundation
2. Create custom query functions in the same directory structure
3. Import and combine generated utilities as needed

## Troubleshooting

### "Could not find Tables interface"

- Ensure `database.types.ts` exists and is properly formatted
- Run `npm run gen:db` to regenerate the types file

### Missing Relationship Queries

- Check that foreign key constraints are properly set in your database
- Verify the relationship is reflected in `database.types.ts`
- Re-run `npm run gen:all`

### Environment Variable Issues

- The scripts work without environment variables in fallback mode
- For full functionality, ensure your `.env.local` file contains the required variables
- Check that your Supabase service role key has the necessary permissions

## Benefits

✅ **Automatic Discovery** - No manual schema configuration required  
✅ **Type Safety** - Full TypeScript support with proper inference  
✅ **Relationship Aware** - Automatically generates foreign key queries  
✅ **Error Handling** - Built-in error logging and user-friendly messages  
✅ **Consistent API** - Standardized function signatures across all tables  
✅ **Development Speed** - Instant CRUD operations for any table  
✅ **Schema Evolution** - Automatically adapts to database changes  

## Migration from Static Generation

If you were previously using static schema definitions:

1. Remove any hardcoded table configurations from the scripts
2. Run `npm run gen:all` to regenerate everything dynamically
3. Update any custom code that referenced the old static schema

The new dynamic system is backward compatible and will generate the same function signatures. 