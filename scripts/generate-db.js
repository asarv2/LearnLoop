#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');

// --- Configuration ---

const OUTPUT_DIR = path.join(__dirname, '../utils');
const QUERIES_DIR = path.join(OUTPUT_DIR, 'queries');
const MUTATIONS_DIR = path.join(OUTPUT_DIR, 'mutations');

const SUPABASE_SERVER_IMPORT_PATH = '@/utils/supabase/supabase-server';
const SCHEMA_IMPORT_PATH = '@/database.types';
const LOGGER_IMPORT_PATH = '@/utils/logger';


// --- Schema Definition ---
const schema = {
    public: {
        tables: {
            chats: {
                pk: 'id',
                pkType: 'string',
                columns: ['id', 'created_at', 'completed_at', 'completed', 'feedback', 'title'],
                relationships: [],
            },
            logs: {
                pk: 'id',
                pkType: 'string',
                columns: ['id', 'created_at', 'level', 'message'],
                relationships: [],
            },
            messages: {
                pk: 'id',
                pkType: 'string',
                columns: ['id', 'created_at', 'content', 'role', 'chat_id', 'completed', 'completed_at'],
                relationships: [
                    {
                        column: 'chat_id',
                        references: 'chats',
                        references_column: 'id',
                    },
                ],
            },
        },
    },
};

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

const getQueryByFkTemplate = (tableName, fk) => {
    const relatedTable = toSingular(fk.references);
    const functionName = `get${toPascalCase(tableName)}By${toPascalCase(relatedTable)}`;
    const paramName = `${relatedTable}Id`;
    const paramType = schema.public.tables[fk.references].pkType;

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

function main() {
    console.log('🚀 Starting Supabase SDK generation...');

    ensureDirExists(QUERIES_DIR);
    ensureDirExists(MUTATIONS_DIR);

    for (const tableName in schema.public.tables) {
        const table = schema.public.tables[tableName];
        const singularName = toSingular(tableName);

        const tableQueryDir = path.join(QUERIES_DIR, tableName);
        const tableMutationDir = path.join(MUTATIONS_DIR, tableName);
        ensureDirExists(tableQueryDir);
        ensureDirExists(tableMutationDir);

        if (table.pk) {
            const getByIdContent = getQueryByIdTemplate(tableName, singularName, table.pk, table.pkType);
            writeFile(path.join(tableQueryDir, `get-${singularName}.ts`), getByIdContent);
        }

        const getAllContent = getQueryAllTemplate(tableName);
        writeFile(path.join(tableQueryDir, `get-all-${tableName}.ts`), getAllContent);

        if (table.relationships && table.relationships.length > 0) {
            for (const rel of table.relationships) {
                const getByFkContent = getQueryByFkTemplate(tableName, rel);
                const relatedSingular = toSingular(rel.references);
                writeFile(path.join(tableQueryDir, `get-${tableName}-by-${relatedSingular}.ts`), getByFkContent);
            }
        }

        const createContent = getCreateMutationTemplate(tableName, singularName);
        writeFile(path.join(tableMutationDir, `create-${singularName}.ts`), createContent);

        if (table.pk) {
            const updateContent = getUpdateMutationTemplate(tableName, singularName, table.pk, table.pkType);
            writeFile(path.join(tableMutationDir, `update-${singularName}.ts`), updateContent);

            const deleteContent = getDeleteMutationTemplate(tableName, singularName, table.pk, table.pkType);
            writeFile(path.join(tableMutationDir, `delete-${singularName}.ts`), deleteContent);
        }
    }

    console.log('\n🎉 SDK generation complete!');
}

main();