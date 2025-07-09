#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// --- Configuration ---

const OUTPUT_DIR = path.join(__dirname, '../utils');
const QUERIES_DIR = path.join(OUTPUT_DIR, 'queries');
const MUTATIONS_DIR = path.join(OUTPUT_DIR, 'mutations');

const SUPABASE_SERVER_IMPORT_PATH = '@/utils/supabase/supabase-server';
const SCHEMA_IMPORT_PATH = '@/database.types';
const LOGGER_IMPORT_PATH = '@/utils/logger';

// Define the path to the actual database types file for parsing
const DB_TYPES_FILE_PATH = path.join(__dirname, '../database.types.ts');

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

// --- Helper Functions ---

const toPascalCase = (str) =>
    str.replace(/(^\w|-\w|_\w)/g, (c) => c.replace(/[-_]/, '').toUpperCase());

const toSingular = (tableName) => {
    if (tableName.endsWith('ies')) return tableName.slice(0, -3) + 'y';
    if (tableName.endsWith('s')) return tableName.slice(0, -1);
    return tableName;
};

const ensureDirExists = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const writeFile = (filePath, content) => {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Generated: ${path.relative(process.cwd(), filePath)}`);
};

/** 
 * Fallback: Extract table names from database.types.ts when Supabase is not available
 */
const extractTableNamesFromDatabaseTypes = () => {
    console.log('📖 Reading database types from:', DB_TYPES_FILE_PATH);
    
    if (!fs.existsSync(DB_TYPES_FILE_PATH)) {
        console.error('❌ Database types file not found:', DB_TYPES_FILE_PATH);
        console.error('   Please run: npm run gen:db first to generate database types');
        process.exit(1);
    }
    
    const content = fs.readFileSync(DB_TYPES_FILE_PATH, 'utf8');
    
    // Extract table names from the Tables interface
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
    return tableNames;
};

/**
 * Extract relationships from database.types.ts
 */
const extractRelationshipsFromDatabaseTypes = (tableName) => {
    const content = fs.readFileSync(DB_TYPES_FILE_PATH, 'utf8');
    
    // Debug: Check if we can find the table at all
    if (!content.includes(`${tableName}:`)) {
        console.log(`   DEBUG: Table ${tableName} not found in content`);
        return [];
    }
    
    // Find the specific table definition using a simpler approach
    const tableStartIndex = content.indexOf(`${tableName}: {`);
    if (tableStartIndex === -1) {
        console.log(`   DEBUG: Table start not found for ${tableName}`);
        return [];
    }
    
    // Find the end of this table definition by looking for the next table or end of Tables section
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
    console.log(`   DEBUG: Found table content length: ${tableContent.length}`);
    
    // Look for Relationships section
    const relationshipsMatch = tableContent.match(/Relationships:\s*\[([\s\S]*?)\]/);
    
    if (!relationshipsMatch) {
        console.log(`   DEBUG: No Relationships section found for ${tableName}`);
        return [];
    }
    
    const relationshipsContent = relationshipsMatch[1];
    console.log(`   DEBUG: Relationships content: ${relationshipsContent.substring(0, 200)}...`);
    
    // Extract foreign key relationships with a more specific regex
    const relationships = [];
    const fkRegex = /foreignKeyName:\s*"([^"]+)"[\s\S]*?columns:\s*\["([^"]+)"\][\s\S]*?referencedRelation:\s*"([^"]+)"[\s\S]*?referencedColumns:\s*\["([^"]+)"\]/g;
    
    let match;
    while ((match = fkRegex.exec(relationshipsContent)) !== null) {
        console.log(`   DEBUG: Found relationship match:`, match.slice(1, 5));
        relationships.push({
            column: match[2],
            references: match[3],
            references_column: match[4]
        });
    }
    
    return relationships;
};

/**
 * Create fallback schema from database.types.ts
 */
const createFallbackSchema = (tableNames) => {
    const schema = { public: { tables: {} } };
    
    for (const tableName of tableNames) {
        console.log(`📋 Processing table: ${tableName}`);
        
        // Extract relationships
        const relationships = extractRelationshipsFromDatabaseTypes(tableName);
        console.log(`   Found ${relationships.length} relationships for ${tableName}:`, relationships);
        
        schema.public.tables[tableName] = {
            pk: 'id', // Default assumption
            pkType: 'string', // Default assumption
            columns: [], // We don't need this for generation
            relationships
        };
    }
    
    return schema;
};

// --- Schema Introspection Functions ---

async function buildSchemaFromTableNames(supabase, tableNames) {
    const schema = { public: { tables: {} } };
    
    for (const tableName of tableNames) {
        console.log(`📋 Processing table: ${tableName}`);
        
        // Get columns information
        const { data: columns, error: columnsError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type, is_nullable, column_default')
            .eq('table_schema', 'public')
            .eq('table_name', tableName)
            .order('ordinal_position');
            
        if (columnsError) {
            console.warn(`⚠️  Could not fetch columns for ${tableName}:`, columnsError);
            continue;
        }
        
        // Get primary key information
        const { data: primaryKeys } = await supabase
            .from('information_schema.key_column_usage')
            .select('column_name')
            .eq('table_schema', 'public')
            .eq('table_name', tableName)
            .not('constraint_name', 'is', null);
            
        // Get foreign key relationships
        const { data: foreignKeys, error: fkError } = await supabase
            .from('information_schema.referential_constraints')
            .select(`
                constraint_name,
                information_schema.key_column_usage!inner(
                    column_name,
                    referenced_table_name,
                    referenced_column_name
                )
            `)
            .eq('constraint_schema', 'public')
            .eq('information_schema.key_column_usage.table_name', tableName);
        
        // Determine primary key
        let primaryKey = 'id';
        let primaryKeyType = 'string';
        
        if (primaryKeys && primaryKeys.length > 0) {
            primaryKey = primaryKeys[0].column_name;
        }
        
        // Determine primary key type from columns
        const pkColumn = columns?.find(col => col.column_name === primaryKey);
        if (pkColumn) {
            if (pkColumn.data_type.includes('uuid')) {
                primaryKeyType = 'string';
            } else if (pkColumn.data_type.includes('integer') || pkColumn.data_type.includes('bigint')) {
                primaryKeyType = 'number';
            }
        }
        
        // Build relationships
        const relationships = [];
        if (foreignKeys && !fkError) {
            for (const fk of foreignKeys) {
                if (fk.information_schema?.key_column_usage) {
                    relationships.push({
                        column: fk.information_schema.key_column_usage.column_name,
                        references: fk.information_schema.key_column_usage.referenced_table_name,
                        references_column: fk.information_schema.key_column_usage.referenced_column_name
                    });
                }
            }
        }
        
        schema.public.tables[tableName] = {
            pk: primaryKey,
            pkType: primaryKeyType,
            columns: columns ? columns.map(col => col.column_name) : [],
            relationships
        };
    }
    
    return schema;
}

// --- Template Generation Functions ---

const getQueryByIdTemplate = (tableName, singularName, pk, pkType) => {
    const functionName = `get${toPascalCase(singularName)}`;
    return `// ${path.join('utils', 'queries', tableName, `get-${singularName}.ts`).replace(/\\/g, '/')}
"use server";

import { cookies } from "next/headers";
import supabaseServer from "${SUPABASE_SERVER_IMPORT_PATH}";
import { logError } from "${LOGGER_IMPORT_PATH}";

/**
 * Fetches a single ${singularName} by its primary key.
 * @param ${pk} The primary key of the ${singularName}.
 * @returns The ${singularName} object or null if not found. The return type is inferred.
 */
export const ${functionName} = async (${pk}: ${pkType}) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("${tableName}")
    .select("*")
    .eq("${pk}", ${pk})
    .single();

  if (error) {
    logError("Error fetching ${singularName}", error);
    throw new Error("Failed to fetch ${singularName}.");
  }

  return data;
};
`;
};

const getQueryAllTemplate = (tableName) => {
    const functionName = `get${toPascalCase(tableName)}`;
    return `// ${path.join('utils', 'queries', tableName, `get-all-${tableName}.ts`).replace(/\\/g, '/')}
"use server";

import { cookies } from "next/headers";
import supabaseServer from "${SUPABASE_SERVER_IMPORT_PATH}";
import { logError } from "${LOGGER_IMPORT_PATH}";

/**
 * Fetches all records from the ${tableName} table.
 * @returns An array of ${tableName}. The return type is inferred.
 */
export const ${functionName} = async () => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("${tableName}").select("*");

  if (error) {
    logError("Error fetching ${tableName}", error);
    throw new Error("Failed to fetch ${tableName}.");
  }

  return data || [];
};
`;
};

const getQueryByFkTemplate = (tableName, fk, schemaInfo) => {
    const relatedTable = toSingular(fk.references);
    const functionName = `get${toPascalCase(tableName)}By${toPascalCase(relatedTable)}`;
    const paramName = `${relatedTable}Id`;
    const paramType = schemaInfo.public.tables[fk.references]?.pkType || 'string';

    return `// ${path.join('utils', 'queries', tableName, `get-${tableName}-by-${relatedTable}.ts`).replace(/\\/g, '/')}
"use server";

import { cookies } from "next/headers";
import supabaseServer from "${SUPABASE_SERVER_IMPORT_PATH}";
import { logError } from "${LOGGER_IMPORT_PATH}";

/**
 * Fetches all ${tableName} related to a specific ${relatedTable}.
 * @param ${paramName} The ID of the related ${relatedTable}.
 * @returns An array of ${tableName}. The return type is inferred.
 */
export const ${functionName} = async (${paramName}: ${paramType}) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("${tableName}")
    .select("*")
    .eq("${fk.column}", ${paramName});

  if (error) {
    logError("Error fetching ${tableName} by ${relatedTable}", error);
    throw new Error("Failed to fetch ${tableName}.");
  }

  return data || [];
};
`;
};

const getCreateMutationTemplate = (tableName, singularName) => {
    const functionName = `create${toPascalCase(singularName)}`;
    return `// ${path.join('utils', 'mutations', tableName, `create-${singularName}.ts`).replace(/\\/g, '/')}
"use server";

import { cookies } from "next/headers";
import supabaseServer from "${SUPABASE_SERVER_IMPORT_PATH}";
import { logError } from "${LOGGER_IMPORT_PATH}";
import type { TablesInsert } from "${SCHEMA_IMPORT_PATH}";

/**
 * Creates a new ${singularName} in the database.
 * @param newData The data for the new ${singularName}.
 * @returns The newly created ${singularName}. The return type is inferred.
 */
export const ${functionName} = async (newData: TablesInsert<'${tableName}'>) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("${tableName}")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating ${singularName}", error);
    throw new Error("Failed to create ${singularName}.");
  }

  return data;
};
`;
};

const getUpdateMutationTemplate = (tableName, singularName, pk, pkType) => {
    const functionName = `update${toPascalCase(singularName)}`;
    return `// ${path.join('utils', 'mutations', tableName, `update-${singularName}.ts`).replace(/\\/g, '/')}
"use server";

import { cookies } from "next/headers";
import supabaseServer from "${SUPABASE_SERVER_IMPORT_PATH}";
import { logError } from "${LOGGER_IMPORT_PATH}";
import type { TablesUpdate } from "${SCHEMA_IMPORT_PATH}";

/**
 * Updates an existing ${singularName}.
 * @param ${pk} The primary key of the ${singularName} to update.
 * @param updates The data to update.
 * @returns The updated ${singularName}. The return type is inferred.
 */
export const ${functionName} = async (${pk}: ${pkType}, updates: TablesUpdate<'${tableName}'>) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("${tableName}")
    .update(updates)
    .eq("${pk}", ${pk})
    .select()
    .single();

  if (error) {
    logError("Error updating ${singularName}", error);
    throw new Error("Failed to update ${singularName}.");
  }
  
  return data;
};
`;
};

const getDeleteMutationTemplate = (tableName, singularName, pk, pkType) => {
    const functionName = `delete${toPascalCase(singularName)}`;
    return `// ${path.join('utils', 'mutations', tableName, `delete-${singularName}.ts`).replace(/\\/g, '/')}
"use server";

import { cookies } from "next/headers";
import supabaseServer from "${SUPABASE_SERVER_IMPORT_PATH}";
import { logError } from "${LOGGER_IMPORT_PATH}";

/**
 * Deletes a ${singularName} from the database.
 * @param ${pk} The primary key of the ${singularName} to delete.
 * @returns The deleted data. The return type is inferred.
 */
export const ${functionName} = async (${pk}: ${pkType}) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("${tableName}")
    .delete()
    .eq("${pk}", ${pk})
    .select()
    .single();

  if (error) {
    logError("Error deleting ${singularName}", error);
    throw new Error("Failed to delete ${singularName}.");
  }
  
  return data;
};
`;
};

// --- Main Generation Logic ---

async function main() {
    console.log('🚀 Starting dynamic Supabase SDK generation...');

    try {
        let schema;
        
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            console.log('⚠️  Supabase credentials not found, using fallback mode...');
            console.log('   Reading schema information from database.types.ts');
            
            // Fallback: Extract table names from database.types.ts
            const tableNames = extractTableNamesFromDatabaseTypes();
            schema = createFallbackSchema(tableNames);
        } else {
            console.log('🔗 Connecting to Supabase...');
            
            // Initialize Supabase client
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
            
            // Get dynamic schema information from Supabase
            const tableNames = extractTableNamesFromDatabaseTypes(); // Still get table names from types file
            schema = await buildSchemaFromTableNames(supabase, tableNames);
        }
        
        console.log('📊 Schema information retrieved:', Object.keys(schema.public.tables));

        ensureDirExists(QUERIES_DIR);
        ensureDirExists(MUTATIONS_DIR);

        for (const tableName in schema.public.tables) {
            const table = schema.public.tables[tableName];
            const singularName = toSingular(tableName);

            console.log(`\n🔧 Generating files for table: ${tableName}`);

            const tableQueryDir = path.join(QUERIES_DIR, tableName);
            const tableMutationDir = path.join(MUTATIONS_DIR, tableName);
            ensureDirExists(tableQueryDir);
            ensureDirExists(tableMutationDir);

            // Generate query by ID (if primary key exists)
            if (table.pk) {
                const getByIdContent = getQueryByIdTemplate(tableName, singularName, table.pk, table.pkType);
                writeFile(path.join(tableQueryDir, `get-${singularName}.ts`), getByIdContent);
            }

            // Generate get all query
            const getAllContent = getQueryAllTemplate(tableName);
            writeFile(path.join(tableQueryDir, `get-all-${tableName}.ts`), getAllContent);

            // Generate queries by foreign key relationships
            if (table.relationships && table.relationships.length > 0) {
                for (const rel of table.relationships) {
                    const getByFkContent = getQueryByFkTemplate(tableName, rel, schema);
                    const relatedSingular = toSingular(rel.references);
                    writeFile(path.join(tableQueryDir, `get-${tableName}-by-${relatedSingular}.ts`), getByFkContent);
                }
            }

            // Generate create mutation
            const createContent = getCreateMutationTemplate(tableName, singularName);
            writeFile(path.join(tableMutationDir, `create-${singularName}.ts`), createContent);

            // Generate update and delete mutations (if primary key exists)
            if (table.pk) {
                const updateContent = getUpdateMutationTemplate(tableName, singularName, table.pk, table.pkType);
                writeFile(path.join(tableMutationDir, `update-${singularName}.ts`), updateContent);

                const deleteContent = getDeleteMutationTemplate(tableName, singularName, table.pk, table.pkType);
                writeFile(path.join(tableMutationDir, `delete-${singularName}.ts`), deleteContent);
            }
        }

        console.log('\n🎉 Dynamic SDK generation complete!');
    } catch (error) {
        console.error('❌ Error during generation:', error);
        process.exit(1);
    }
}

main();