#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');

// --- Configuration ---

// Define the path for the output file.
const OUTPUT_FILE = path.join(__dirname, '../types.ts');

// Define the path alias to your main database types file.
const DB_TYPES_IMPORT_PATH = '@/database.types';

// Define the path to the actual database types file for parsing
const DB_TYPES_FILE_PATH = path.join(__dirname, '../database.types.ts');

// --- Helper Functions ---

/** Converts a string to PascalCase */
const toPascalCase = (str) =>
    str.replace(/(^\w|-\w|_\w)/g, (c) => c.replace(/[-_]/, '').toUpperCase());

/** Converts a plural table name to its singular form (simple version) */
const toSingular = (tableName) => {
    if (tableName.endsWith('ies')) return tableName.slice(0, -3) + 'y';
    if (tableName.endsWith('s')) return tableName.slice(0, -1);
    return tableName;
};

/** 
 * Dynamically extracts table names and schema information from database.types.ts
 * This creates a temporary JavaScript file to import the types and extract the schema
 */
const extractSchemaFromDatabaseTypes = async () => {
    console.log('📖 Reading database types from:', DB_TYPES_FILE_PATH);
    
    if (!fs.existsSync(DB_TYPES_FILE_PATH)) {
        console.error('❌ Database types file not found:', DB_TYPES_FILE_PATH);
        console.error('   Please run: npm run gen:db first to generate database types');
        process.exit(1);
    }
    
    // Read the database types file
    const content = fs.readFileSync(DB_TYPES_FILE_PATH, 'utf8');
    
    // Extract the Constants object which contains the actual schema information
    const constantsMatch = content.match(/export const Constants = ({[\s\S]*?}) as const/);
    
    if (constantsMatch) {
        console.log('📊 Found Constants object, using it for schema extraction');
        try {
            // Create a temporary file to evaluate the Constants object
            const tempFile = path.join(__dirname, 'temp-constants.js');
            const tempContent = `
                const Constants = ${constantsMatch[1]};
                console.log(JSON.stringify(Constants, null, 2));
            `;
            
            fs.writeFileSync(tempFile, tempContent);
            
            // Execute the temp file to get the Constants object
            const { execSync } = require('child_process');
            const result = execSync(`node ${tempFile}`, { encoding: 'utf8' });
            
            // Clean up temp file
            fs.unlinkSync(tempFile);
            
            const constants = JSON.parse(result);
            
            // Extract table names from the constants if available
            if (constants.public && constants.public.Enums) {
                console.log('📋 Found schema enums:', Object.keys(constants.public.Enums));
            }
        } catch {
            console.log('⚠️  Could not parse Constants object, falling back to regex parsing');
        }
    }
    
    // Fallback: Extract table names from the Tables interface using regex
    const tablesMatch = content.match(/Tables:\s*{([\s\S]*?)}\s*Views:/);
    
    if (!tablesMatch) {
        console.error('❌ Could not find Tables interface in database types file');
        process.exit(1);
    }
    
    const tablesContent = tablesMatch[1];
    
    // Extract individual table names - look for table definitions (not Row, Insert, Update, etc.)
    const tableMatches = tablesContent.match(/^\s+(\w+):\s*{$/gm);
    
    if (!tableMatches) {
        console.error('❌ Could not find any table definitions');
        process.exit(1);
    }
    
    const tableNames = tableMatches.map(match => {
        const name = match.replace(/^\s+/, '').replace(/:\s*{$/, '').trim();
        return name;
    }).filter(name => !['Row', 'Insert', 'Update', 'Relationships'].includes(name));
    
    console.log('📋 Found tables:', tableNames);
    
    // Extract relationships for each table
    const schema = { tables: {} };
    
    for (const tableName of tableNames) {
        const relationships = extractTableRelationships(content, tableName);
        schema.tables[tableName] = {
            relationships
        };
    }
    
    return schema;
};

/**
 * Extract relationships for a specific table from the database types content
 */
const extractTableRelationships = (content, tableName) => {
    // Find the table definition
    const tableStartIndex = content.indexOf(`${tableName}: {`);
    if (tableStartIndex === -1) {
        return [];
    }
    
    // Find the end of this table definition by counting braces
    let braceCount = 0;
    let tableEndIndex = tableStartIndex;
    let inTableDef = false;
    
    for (let i = tableStartIndex; i < content.length; i++) {
        const char = content[i];
        if (char === '{') {
            braceCount++;
            inTableDef = true;
        } else if (char === '}') {
            braceCount--;
            if (inTableDef && braceCount === 0) {
                tableEndIndex = i;
                break;
            }
        }
    }
    
    const tableContent = content.substring(tableStartIndex, tableEndIndex + 1);
    
    // Look for Relationships section
    const relationshipsMatch = tableContent.match(/Relationships:\s*\[([\s\S]*?)\]/);
    
    if (!relationshipsMatch) {
        return [];
    }
    
    const relationshipsContent = relationshipsMatch[1];
    
    // Extract foreign key relationships
    const relationships = [];
    const fkRegex = /foreignKeyName:\s*"([^"]+)"[\s\S]*?columns:\s*\["([^"]+)"\][\s\S]*?referencedRelation:\s*"([^"]+)"[\s\S]*?referencedColumns:\s*\["([^"]+)"\]/g;
    
    let match;
    while ((match = fkRegex.exec(relationshipsContent)) !== null) {
        relationships.push({
            column: match[2],
            references: match[3],
            references_column: match[4]
        });
    }
    
    return relationships;
};

// --- Main Generation Logic ---

async function main() {
    console.log('🚀 Generating dynamic database types...');

    try {
        // Dynamically extract schema from database.types.ts
        const schema = await extractSchemaFromDatabaseTypes();
        const tableNames = Object.keys(schema.tables);

        // Start with the static prefix content
        let content = `// This file is auto-generated by scripts/generate-types.js
// Do not edit this file directly.

import { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "${DB_TYPES_IMPORT_PATH}";

export type TypedSupabaseClient = SupabaseClient<Database>;
export type SchemaName = keyof Database;

// =============================================
// ================ TABLE TYPES ================
// =============================================

`;

        // Generate types for each table
        for (const tableName of tableNames) {
            const singularName = toSingular(tableName);
            const pascalName = toPascalCase(singularName);

            content += `// --- ${tableName.toUpperCase()} ---\n`;
            content += `export type ${pascalName} = Tables<'${tableName}'>;\n`;
        }

        // Add additional utility types
        content += `
// =============================================
// ============= UTILITY TYPES =============
// =============================================

// Union type of all table names
export type TableName = ${tableNames.map(name => `'${name}'`).join(' | ')};

// Union type of all entity types
export type Entity = ${tableNames.map(name => `${toPascalCase(toSingular(name))}`).join(' | ')};
`;

        // Write the final content to the output file
        fs.writeFileSync(OUTPUT_FILE, content);
        console.log(`✅ Successfully generated: ${path.relative(process.cwd(), OUTPUT_FILE)}`);
        console.log(`📊 Generated types for ${tableNames.length} tables: ${tableNames.join(', ')}`);

    } catch (error) {
        console.error('❌ Error generating types file:', error);
        process.exit(1);
    }

    console.log('\n🎉 Dynamic type generation complete!');
}

main();